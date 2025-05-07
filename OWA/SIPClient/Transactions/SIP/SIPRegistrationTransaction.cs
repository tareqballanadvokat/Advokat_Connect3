using Microsoft.Extensions.Logging;
using SIPSorcery.SIP;
using System.Net.Sockets;
using System.Runtime.CompilerServices;
using WebRTCLibrary;
using WebRTCLibrary.SIP.Models;

using static WebRTCLibrary.Utils.TaskHelpers;

[assembly: InternalsVisibleTo("SIPClientTests")]

namespace WebRTCClient.Transactions.SIP
{
    internal class SIPRegistrationTransaction : WebRTCLibrary.SIP.SIPTransaction, IAsyncDisposable
    {
        private readonly ILogger<SIPRegistrationTransaction> logger;

        public bool Registered { get; private set; }

        private bool Registering { get; set; }

        private bool UnregisteredByServer { get; set; }

        //public event Action<ClientRegistrationDialog, SIPDialogEventArgs>? OnRegistered;

        //public event Action<SIPRegistrationTransaction, SIPDialogEventArgs>? OnUnRegistered;

        private CancellationTokenSource registrationCts;

        private CancellationToken RegistrationCT { get => this.registrationCts.Token; }

        public SIPRegistrationTransaction(ISIPConnection connection, TransactionParams dialogParams, ILoggerFactory loggerFactory)
            : base(connection, dialogParams, loggerFactory)
        {
            this.logger = loggerFactory.CreateLogger<SIPRegistrationTransaction>();
            this.registrationCts = new CancellationTokenSource();
        }

        public SIPRegistrationTransaction(SIPSchemesEnum sipScheme, SIPTransport transport, TransactionParams dialogParams, ILoggerFactory loggerFactory)
            : base(sipScheme, transport, dialogParams, loggerFactory)
        {
            this.logger = loggerFactory.CreateLogger<SIPRegistrationTransaction>();
            this.registrationCts = new CancellationTokenSource();
        }

        public override async Task Start()
        {
            await this.Register();
        }

        public async Task Start(CancellationToken ct)
        {
            this.registrationCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            await this.Start();
        }

        public override async Task Stop()
        {
            await this.Unregister();
        }

        private async Task Register()
        {
            if (this.Registered)
            {
                // TODO: log. already registered
                return;
            }

            if (this.Registering)
            {
                // TODO: log. already registering. Wait for the previous registering to finish. Retry automatically?
                return;
            }

            this.UnregisteredByServer = false;
            this.Registering = true;
            this.Params.SourceTag = CallProperties.CreateNewTag();

            // set response delegates
            this.Connection.SIPResponseReceived += this.ListenForRegistrationAccept;
            this.Connection.SIPRequestReceived += this.ListenForDisconnect;

            try
            {
                SocketError result = await this.Connection.SendSIPRequest(
                    SIPMethodsEnum.REGISTER,
                    this.GetHeaderParams(),
                    this.RegistrationCT,
                    this.SendTimeout);

                if (result != SocketError.Success)
                {
                    // request did not get sent.
                    //this.Connection.SIPResponseReceived -= this.ListenForRegistrationAccept;
                    //this.Connection.SIPRequestReceived -= this.ListenForDisconnect;
                    this.RegistrationFailed($"Failed to send Registration. {result}.");
                    return;
                }
            }
            catch (OperationCanceledException)
            {
                // Request did not get sent.
                //this.Connection.SIPResponseReceived -= this.ListenForRegistrationAccept;
                //this.Connection.SIPRequestReceived -= this.ListenForDisconnect;
                this.RegistrationFailed($"Registration was cancelled.");
                return;
            }

            await WaitForAsync(
                () => this.Registered && !this.Registering,
                this.ReceiveTimeout,
                this.RegistrationCT,
                failureCallback: this.RegistrationTimeout);

            // TODO: make sure this happens after timeout / failure or success
            // remove listener
            this.Connection.SIPResponseReceived -= this.ListenForRegistrationAccept;

            if (this.RegistrationCT.IsCancellationRequested)
            {
                //this.Connection.SIPRequestReceived -= this.ListenForDisconnect;
                this.RegistrationFailed($"Registration was cancelled.");
            }
        }

        private async Task RegistrationTimeout()
        {
            this.RegistrationFailed("Registration Timeout. Signaling server took too long to respond.");
            
            // No cancellation. Bye should get sent even if the registration got cancelled.
            await this.SendBYEMessage(3, CancellationToken.None);

            // TODO: Listen for server bye? If accepted had a timeout we shouldn't wait for the server to respond with a bye.
            //this.Connection.SIPRequestReceived -= this.ListenForDisconnect;
            // TODO: remove acceptDelegate

            this.ResetRegistration();
        }

        private async Task ListenForRegistrationAccept(SIPEndPoint localEndPoint, SIPEndPoint remoteEndPoint, SIPResponse sipResponse)
        {
            if (sipResponse.Status != SIPResponseStatusCodesEnum.Accepted)
            {
                this.RegistrationFailed($"Wrong status code. {sipResponse.StatusCode} expected 202.");
                return;
            }

            if (sipResponse.Header.CSeq != 2)
            {
                this.RegistrationFailed($"Header is invalid. Expected CSeq 2 got {sipResponse.Header.CSeq}.");
                return;
            }

            await this.RegistrationAccepted(sipResponse);
        }

        private async Task RegistrationAccepted(SIPResponse sipResponse)
        {
            this.Params.RemoteTag = sipResponse.Header.From.FromTag;

            this.logger.LogDebug(
                "Server accepted registration. From:\"{fromName}\" tag:\"{fromTag}\"; to:\"{toName}\" tag:\"{toTag}\"",
                this.Params.SourceParticipant.Name,
                this.Params.SourceTag,

                this.Params.RemoteParticipant.Name,
                this.Params.RemoteTag);

            int cSeq = sipResponse.Header.CSeq + 1;

            try
            {
                SocketError result = await this.Connection.SendSIPRequest(
                    SIPMethodsEnum.ACK,
                    this.GetHeaderParams(cSeq),
                    this.RegistrationCT,
                    this.SendTimeout);

                if (result != SocketError.Success)
                {
                    // request did not get sent.
                    this.RegistrationFailed($"Failed to send ACK. {result}.");
                    await this.SendBYEMessage(cSeq, CancellationToken.None); // no cancellation for bye
                    return;
                }

                this.Registered = true;
                this.Registering = false;
                this.logger.LogInformation("Successfully registered. \"{fromName}\" - \"{toName}\"",
                    this.Params.SourceParticipant.Name,
                    this.Params.RemoteParticipant.Name);
            }
            catch (OperationCanceledException)
            {
                // Request did not get sent.
                this.RegistrationFailed($"Registration was cancelled.");

                if (!this.UnregisteredByServer)
                {
                    await this.SendBYEMessage(cSeq, CancellationToken.None); // no cancellation for bye
                }
            }
        }

        private async Task Unregister()
        {
            // TODO: get token passed?
            CancellationTokenSource cts = new CancellationTokenSource();
            CancellationToken ct = cts.Token;

            if (!this.Registered)
            {
                // TODO: log. Not registered
                return;
            }

            if (this.Registering)
            {
                this.registrationCts.Cancel();
                return;
            }

            // send disconnect message
            this.logger.LogDebug("Unregistering. From:\"{fromName}\" tag:\"{fromTag}\"; to:\"{toName}\" tag:\"{toTag}\"",
                this.Params.SourceParticipant.Name,
                this.Params.SourceTag,

                this.Params.RemoteParticipant.Name,
                this.Params.RemoteTag);

            await this.SendBYEMessage(4, ct);

            await WaitFor(
                () => !this.Registered,
                this.ReceiveTimeout,
                ct
                //failureCallback: // TODO: do something on timeout? Server did not send bye. Retry?
                );
        }

        private async Task ListenForDisconnect(SIPEndPoint localEndPoint, SIPEndPoint remoteEndPoint, SIPRequest sipRequest)
        {
            if (sipRequest.Method != SIPMethodsEnum.BYE)
            {
                // wrong status code
                return;
            }

            if (sipRequest.Header.CSeq != 2
                && sipRequest.Header.CSeq != 4
                && sipRequest.Header.CSeq != 5
                )
            {
                // bad request - header is invalid
                // TODO: Unregister failed? - Server sent an invalid bye

                return;
            }

            this.UnregisteredByServer = true;
            this.registrationCts.Cancel();

            this.logger.LogInformation("Unregistered. \"{fromName}\" - \"{toName}\"",
                this.Params.SourceParticipant.Name,
                this.Params.RemoteParticipant.Name);

            this.Connection.SIPRequestReceived -= this.ListenForDisconnect;
            this.ResetRegistration();
        }

        private void RegistrationFailed(string message)
        {
            this.logger.LogDebug("Registration failed. {message} From:\"{fromName}\" tag:\"{fromTag}\"; to:\"{toName}\" tag:\"{toTag}\"",
                message,
                this.Params.SourceParticipant.Name,
                this.Params.SourceTag,

                this.Params.RemoteParticipant.Name,
                this.Params.RemoteTag);

            this.Connection.SIPResponseReceived -= this.ListenForRegistrationAccept;
            this.Connection.SIPRequestReceived -= this.ListenForDisconnect;

            this.Registering = false;
            this.ResetRegistration();
        }

        private void ResetRegistration()
        {
            // TODO: event that Registration was reset?
            this.Params.SourceTag = null;
            this.Params.RemoteTag = null;
            this.Registered = false;

            // reset cancellation
            // TODO: make sure this happens after everything else has been reset.
            //this.registrationCts = new CancellationTokenSource();
        }

        // TODO: Remove ct as parameter and use Cancellationtoken None?
        private async Task SendBYEMessage(int CSeq, CancellationToken ct)
        {
            SIPHeaderParams headerParams = this.GetHeaderParams(CSeq);

            SocketError result = await this.Connection.SendSIPRequest(
                SIPMethodsEnum.BYE,
                headerParams,
                ct,
                this.SendTimeout);

            if (result != SocketError.Success)
            {
                // TODO: Do something. BYE message could not be sent. Retry?
            }
        }

        public async ValueTask DisposeAsync()
        {
            await this.Unregister();
        }
    }
}
