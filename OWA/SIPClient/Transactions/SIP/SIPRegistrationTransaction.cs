using Microsoft.Extensions.Logging;
using SIPSorcery.SIP;
using System.Net.Sockets;
using WebRTCLibrary;
using WebRTCLibrary.SIP.Models;

using static WebRTCLibrary.Utils.TaskHelpers;

namespace WebRTCClient.Transactions.SIP
{
    internal class SIPRegistrationTransaction : WebRTCLibrary.SIP.SIPTransaction, IAsyncDisposable
    {
        private readonly ILogger<SIPRegistrationTransaction> logger;

        public bool Registered { get; private set; }

        private bool Registering { get; set; }

        //public event Action<ClientRegistrationDialog, SIPDialogEventArgs>? OnRegistered;

        //public event Action<SIPRegistrationTransaction, SIPDialogEventArgs>? OnUnRegistered;

        private CancellationTokenSource? registrationCts;

        //private CancellationToken? registrationCt;

        public SIPRegistrationTransaction(ISIPConnection connection, TransactionParams dialogParams, ILoggerFactory loggerFactory)
            : base(connection, dialogParams, loggerFactory)
        {
            this.logger = loggerFactory.CreateLogger<SIPRegistrationTransaction>();
        }

        public SIPRegistrationTransaction(SIPSchemesEnum sipScheme, SIPTransport transport, TransactionParams dialogParams, ILoggerFactory loggerFactory)
            : base(sipScheme, transport, dialogParams, loggerFactory)
        {
            this.logger = loggerFactory.CreateLogger<SIPRegistrationTransaction>();
        }

        public override async Task Start()
        {
            this.registrationCts = new CancellationTokenSource();
            await this.Start(this.registrationCts.Token);
        }

        public async Task Start(CancellationToken ct)
        {
            //this.registrationCt = ct;
            await this.Register(ct);
        }

        public override async Task Stop()
        {
            await this.Unregister();
        }

        private async Task Register(CancellationToken ct)
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

            this.Registering = true;
            this.Params.SourceTag = CallProperties.CreateNewTag();

            // set response delegates
            SIPTransportResponseAsyncDelegate acceptDelegate = (localEndPoint, remoteEndPoint, sipResponse) => this.ListenForRegistrationAccept(sipResponse, ct);
            this.Connection.SIPResponseReceived += acceptDelegate;
            this.Connection.SIPRequestReceived += this.ListenForDisconnect;

            try
            {
                SocketError result = await this.Connection.SendSIPRequest(
                    SIPMethodsEnum.REGISTER,
                    this.GetHeaderParams(),
                    ct,
                    this.SendTimeout);

                if (result != SocketError.Success)
                {
                    // request did not get sent.
                    this.Connection.SIPResponseReceived -= acceptDelegate;
                    this.Connection.SIPRequestReceived -= this.ListenForDisconnect;
                    this.RegistrationFailed($"Failed to send Registration. {result}.");
                    return;
                }
            }
            catch (OperationCanceledException)
            {
                // Request did not get sent.
                this.Connection.SIPResponseReceived -= acceptDelegate;
                this.Connection.SIPRequestReceived -= this.ListenForDisconnect;
                this.RegistrationFailed($"Registration was cancelled.");
                return;
            }

            await WaitForAsync(
                () => this.Registered && !this.Registering,
                failureCallback: this.RegistrationTimeout,
                timeOut: this.ReceiveTimeout);

            // TODO: make sure this happens after timeout / failure or success
            // remove listener
            this.Connection.SIPResponseReceived -= acceptDelegate;
        }

        private async Task RegistrationTimeout()
        {
            CancellationToken ct = CancellationToken.None;
            this.RegistrationFailed("Registration Timeout. Signaling server took too long to respond.");
            await this.SendBYEMessage(3, ct);

            // TODO: Listen for server bye? If accepted had a timeout we shouldn't wait for the server to respond with a bye.
            this.Connection.SIPRequestReceived -= this.ListenForDisconnect;
            // TODO: remove acceptDelegate

            this.ResetRegistration();
        }

        private async Task ListenForRegistrationAccept(SIPResponse sipResponse, CancellationToken ct)
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

            await this.RegistrationAccepted(sipResponse, ct);
        }

        private async Task RegistrationAccepted(SIPResponse sipResponse, CancellationToken ct)
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
                    ct,
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
                await this.SendBYEMessage(cSeq, CancellationToken.None); // no cancellation for bye
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

                // TODO: cancel registering and check if we have to continue
                //       Unregister after is has finished?
                //this.registrationCts?.Cancel();

                //await WaitFor(
                //    () => this.Registering == false && this.Registered == true,
                //    timeOut: this.ReceiveTimeout,
                //    successCallback: this.Unregister());
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
                this.ReceiveTimeout
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

                // 2 is a serversided unregister - right after register / instead of accepted
                // 4 is a serversided unregister
                // 5 is an ack of a client sided unregister
                return;
            }

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

            this.Registering = false;
            this.ResetRegistration();
        }

        private void ResetRegistration()
        {
            // TODO: event that Registration was reset?
            this.Params.SourceTag = null;
            this.Params.RemoteTag = null;
            this.Registered = false;
        }

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
