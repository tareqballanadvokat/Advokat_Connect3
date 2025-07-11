using Microsoft.Extensions.Logging;
using SIPSorcery.SIP;
using System.Net.Sockets;
using System.Runtime.CompilerServices;
using WebRTCClient.Transactions.SIP.Interfaces;
using WebRTCLibrary.SIP.Interfaces;
using WebRTCLibrary.SIP.Models;

using static WebRTCLibrary.Utils.TaskHelpers;

[assembly: InternalsVisibleTo("SIPClientTests")]
namespace WebRTCClient.Transactions.SIP
{
    internal class SIPRegistrationTransaction : WebRTCLibrary.SIP.SIPTransaction, ISIPRegistrationTransaction // , IAsyncDisposable
    {
        private readonly ILogger<SIPRegistrationTransaction> logger;

        public bool Registered { get; private set; }

        private bool UnregisteredByServer { get; set; }

        public SIPRegistrationTransaction(ISIPConnection connection, TransactionParams dialogParams, ILoggerFactory loggerFactory)
            : base(connection, dialogParams, loggerFactory)
        {
            this.logger = loggerFactory.CreateLogger<SIPRegistrationTransaction>();
        }

        public SIPRegistrationTransaction(SIPSchemesEnum sipScheme, ISIPTransport transport, TransactionParams dialogParams, ILoggerFactory loggerFactory)
            : base(sipScheme, transport, dialogParams, loggerFactory)
        {
            this.logger = loggerFactory.CreateLogger<SIPRegistrationTransaction>();
        }

        protected override async Task StartRunning()
        {
            await this.Register();
        }

        protected override async Task Finish()
        {
            await this.Unregister();
        }

        private async Task Register()
        {
            this.Params.SourceTag = CallProperties.CreateNewTag();

            // set response delegates
            this.Connection.SIPResponseReceived += this.ListenForRegistrationAccept;
            this.Connection.SIPRequestReceived += this.ListenForDisconnect;

            bool success = await this.SendRegisterMessage();
            if (!success) return;

            await WaitForAsync(
                () => this.Registered,
                timeOut: this.ReceiveTimeout,
                ct: this.Ct,
                timeoutCallback: async () => await this.RegistrationFailed("Registration Timeout. Signaling server took too long to respond."),
                cancellationCallback: async () => await this.RegistrationFailed($"Registration was cancelled.")
                );
        }

        private async Task<bool> SendRegisterMessage()
        {
            SocketError result;
            int registerCseq = this.CurrentCseq;
            
            // increment before call. A fast response would get rejected before currentCseq is updated.
            this.CurrentCseq++;
            try
            {
                result = await this.Connection.SendSIPRequest(
                    SIPMethodsEnum.REGISTER,
                    this.GetHeaderParams(registerCseq),
                    this.Ct
                    );
            }
            catch (OperationCanceledException)
            {
                // Request did not get sent.
                this.CurrentCseq--;
                await this.RegistrationFailed($"Registration was cancelled.");
                return false;
            }

            if (result != SocketError.Success)
            {
                // request did not get sent.
                this.CurrentCseq--;
                await this.RegistrationFailed($"Failed to send Registration. {result}.");
                return false;
            }

            return true;
        }

        private async Task ListenForRegistrationAccept(SIPEndPoint localEndPoint, SIPEndPoint remoteEndPoint, SIPResponse sipResponse)
        {
            if (sipResponse.Status != SIPResponseStatusCodesEnum.Accepted)
            {
                await this.RegistrationFailed($"Wrong status code. {sipResponse.StatusCode} expected 202.");
                return;
            }

            if (sipResponse.Header.CSeq != this.CurrentCseq)
            {
                await this.RegistrationFailed($"Header is invalid. Expected CSeq {this.CurrentCseq} got {sipResponse.Header.CSeq}.");
                return;
            }

            this.Connection.SIPResponseReceived -= this.ListenForRegistrationAccept;
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

            bool ackSent = await this.SendACK();

            if (ackSent)
            {
                this.Registered = true;
                this.logger.LogInformation("Successfully registered. \"{fromName}\" - \"{toName}\"",
                    this.Params.SourceParticipant.Name,
                    this.Params.RemoteParticipant.Name);
            }
        }

        private async Task<bool> SendACK()
        {
            SocketError result;

            this.CurrentCseq++;
            try
            {
                result = await this.Connection.SendSIPRequest(
                    SIPMethodsEnum.ACK,
                    this.GetHeaderParams(),
                    this.Ct);
            }
            catch (OperationCanceledException)
            {
                // Request did not get sent.
                this.CurrentCseq--;
                await this.RegistrationFailed($"Registration was cancelled.");
                return false;
            }

            if (result != SocketError.Success)
            {
                // request did not get sent.
                this.CurrentCseq--;
                await this.RegistrationFailed($"Failed to send ACK. {result}.");
                return false;
            }

            return true;
        }

        public async Task Unregister()
        {
            this.logger.LogDebug("Unregistering. From:\"{fromName}\" tag:\"{fromTag}\"; to:\"{toName}\" tag:\"{toTag}\"",
                this.Params.SourceParticipant.Name,
                this.Params.SourceTag,

                this.Params.RemoteParticipant.Name,
                this.Params.RemoteTag);

            if (!this.UnregisteredByServer)
            {
                // TODO: listen for bye from server?
                await this.SendBYEMessage(CancellationToken.None); // no cancellation for bye
            }

            this.ResetRegistration();
        }

        private async Task ListenForDisconnect(SIPEndPoint localEndPoint, SIPEndPoint remoteEndPoint, SIPRequest sipRequest)
        {
            if (sipRequest.Method != SIPMethodsEnum.BYE)
            {
                // wrong method
                return;
            }

            if (sipRequest.Header.CSeq != this.CurrentCseq)
            {
                // bad request - header is invalid
                // TODO: Unregister failed? - Server sent an invalid bye

                return;
            }

            this.UnregisteredByServer = true;
            await this.Stop();

            this.logger.LogInformation("Unregistered. \"{fromName}\" - \"{toName}\"",
                this.Params.SourceParticipant.Name,
                this.Params.RemoteParticipant.Name);

            this.Connection.SIPRequestReceived -= this.ListenForDisconnect;
        }

        private async Task RegistrationFailed(string message)
        {
            this.Connection.SIPResponseReceived -= this.ListenForRegistrationAccept;
            this.Connection.SIPRequestReceived -= this.ListenForDisconnect;

            this.logger.LogDebug("Registration failed. {message} From:\"{fromName}\" tag:\"{fromTag}\"; to:\"{toName}\" tag:\"{toTag}\"",
                message,
                this.Params.SourceParticipant.Name,
                this.Params.SourceTag,

                this.Params.RemoteParticipant.Name,
                this.Params.RemoteTag);

            await this.Stop();
        }

        private void ResetRegistration()
        {
            // TODO: remove all listeners?
            // TODO: event that Registration was reset?
            this.Params.SourceTag = null;
            this.Params.RemoteTag = null;
            this.Registered = false;
            this.UnregisteredByServer = false;
        }

        // TODO: Remove ct as parameter and use Cancellationtoken None?
        private async Task SendBYEMessage(CancellationToken ct)
        {
            SocketError result = await this.Connection.SendSIPRequest(
                SIPMethodsEnum.BYE,
                this.GetHeaderParams(),
                ct);

            if (result != SocketError.Success)
            {
                // TODO: Do something. BYE message could not be sent. Retry?
            }
        }

        //public async ValueTask DisposeAsync()
        //{
        //    await this.Unregister();
        //}
    }
}
