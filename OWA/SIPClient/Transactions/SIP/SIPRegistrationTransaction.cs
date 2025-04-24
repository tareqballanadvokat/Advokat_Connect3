using Microsoft.Extensions.Logging;
using SIPSorcery.SIP;
using System.Diagnostics;
using System.Net.Sockets;
using WebRTCLibrary.SIP;
using WebRTCLibrary.SIP.Models;
using WebRTCLibrary.Utils;

using static WebRTCLibrary.Utils.TaskHelpers;

namespace WebRTCClient.Transactions.SIP
{
    internal class SIPRegistrationTransaction : WebRTCLibrary.SIP.SIPTransaction, IAsyncDisposable
    {
        private readonly ILogger<SIPRegistrationTransaction> logger;

        public bool Registered { get; private set; }

        private bool Registering { get; set; }

        //public event Action<ClientRegistrationDialog, SIPDialogEventArgs>? OnRegistered;

        public event Action<SIPRegistrationTransaction, SIPDialogEventArgs>? OnUnRegistered;

        public SIPRegistrationTransaction(SIPConnection connection, TransactionParams dialogParams, ILoggerFactory loggerFactory)
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
            await this.Register();
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

            this.Registering = true;
            this.Params.SourceTag = CallProperties.CreateNewTag();

            // set response delegate
            this.Connection.SIPResponseReceived += this.ListenForRegistrationAccept;

            // send request
            // TODO: do something with the socekterror
            await this.SendSIPMessage(SIPMethodsEnum.REGISTER);

            await WaitFor(
                () => this.Registered && !this.Registering,
                failureCallback: this.RegistrationFailed,
                timeOut: this.ReceiveTimeout);

            // TODO: make sure this happens after timeout / failure or success
            // remove listener
            this.Connection.SIPResponseReceived -= this.ListenForRegistrationAccept;
        }

        private async Task ListenForRegistrationAccept(SIPEndPoint localEndPoint, SIPEndPoint remoteEndPoint, SIPResponse sipResponse)
        {
            // Old Signaling server sends not found if the other peer is not present
            // TODO: remove when the servers get switched.
            if (sipResponse.Status == SIPResponseStatusCodesEnum.NotFound)
            {
                return;
            }

            if (sipResponse.Status != SIPResponseStatusCodesEnum.Accepted)
            {
                // bad request, wrong status
                this.RegistrationFailed();
                return;
            }

            if (this.Params.RemoteParticipant == null // Why?
                || sipResponse.Header.CSeq != 2)
            {
                // bad request - header is invalid
                this.RegistrationFailed();
                return;
            }

            await this.RegistrationAccepted(sipResponse);
        }

        private async Task RegistrationAccepted(SIPResponse sipResponse)
        {
            Debug.WriteLine($"Client received Accepted."); // DEBUG

            this.Params.RemoteTag = sipResponse.Header.From.FromTag;

            this.logger.LogDebug(
                "Successfully registered. From:\"{fromName}\" tag:\"{fromTag}\"; to:\"{toName}\" tag:\"{toTag}\"",
                this.Params.SourceParticipant.Name,
                this.Params.SourceTag,

                this.Params.RemoteParticipant.Name,
                this.Params.RemoteTag);

            this.Registered = true;
            this.Registering = false;

            // TODO: Do something with the socketerror
            await this.SendSIPMessage(SIPMethodsEnum.ACK, this.GetHeaderParams(cSeq: sipResponse.Header.CSeq + 1));
        }

        private async Task Unregister()
        {
            if (!this.Registered)
            {
                // TODO: log. Not registered
                return;
            }

            if (this.Registering)
            {
                // TODO: cancel registering and check if we have to continue
                //       Unregister after is has finished?

                //await WaitFor(
                //    () => this.Registering == false && this.Registered == true,
                //    timeOut: this.ReceiveTimeout,
                //    successCallback: this.Unregister());
                return;
            }

            // set response listener
            this.Connection.SIPResponseReceived += this.ListenForDisconnectAccept;

            // send disconnect message
            // TODO: do something with the socket error
            await this.SendSIPMessage(SIPMethodsEnum.BYE);

            // TODO: add failurecallback --> log failure to disconnect. Retry?
            await WaitFor(
                () => !this.Registered,
                timeOut: this.ReceiveTimeout,
                successCallback: () =>
                {
                    this.logger.LogDebug(
                        "Successfully unregistered. From:\"{fromName}\" tag:\"{fromTag}\"; to:\"{toName}\" tag:\"{toTag}\"",
                        this.Params.SourceParticipant.Name,
                        this.Params.SourceTag,

                        this.Params.RemoteParticipant.Name,
                        this.Params.RemoteTag);
                });

            // remove listener
            // TODO: will this always run after previous task is finished?
            this.Connection.SIPResponseReceived -= this.ListenForDisconnectAccept; // remove listener
        }

        private async Task ListenForDisconnectAccept(SIPEndPoint localEndPoint, SIPEndPoint remoteEndPoint, SIPResponse sipResponse)
        {
            if (sipResponse.Status != SIPResponseStatusCodesEnum.Accepted)
            {
                // bad request - wrong status code
                
                // TODO: What to do on Unregister failed?
                return;
            }

            if (this.Params.RemoteParticipant == null // why
                || sipResponse.Header.CSeq != 2)
            {
                // bad request - header is invalid
                // TODO: Unregister failed? - Server sent an invalid accepted
                return;
            }
    
            this.ResetRegistration();
        }

        private void RegistrationFailed()
        {
            this.logger.LogDebug("Registration failed. From:\"{fromName}\" tag:\"{fromTag}\"; to:\"{toName}\" tag:\"{toTag}\"",
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

        private async Task SendSIPMessage(SIPMethodsEnum method, SIPHeaderParams? headerParams = null)
        {
            // TODO: Make ct Mandatory

            //if ((!this.Registering && !this.Registered)
            //    || (this.RemoteParticipant == null || this.SourceParticipant == null))
            //{
            //    // TODO: Log - not registered
            //    return;
            //}

            // TODO: Implement cancellation logic. Where to save tokensource? Which requests should use the same token?
            using CancellationTokenSource cts = new CancellationTokenSource();

            SocketError result = await this.Connection.SendSIPRequest(
                method,
                headerParams ?? this.GetHeaderParams(),
                cts.Token,
                this.SendTimeout);

            // should we return socketerror?
            switch (result)
            {
                case SocketError.Success:
                    // Log("✅ SIP request sent successfully. " + method);
                    // success
                    break;

                case SocketError.TimedOut:
                    // timeout
                    break;

                default:
                    // failure to send
                    break;
            }
        }

        public async ValueTask DisposeAsync()
        {
            await this.Unregister();
        }
    }
}
