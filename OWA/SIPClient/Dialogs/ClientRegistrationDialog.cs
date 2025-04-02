using SIPSorcery.SIP;
using System.Diagnostics;
using System.Net.Sockets;
using WebRTCLibrary.SIP;
using WebRTCLibrary.SIP.Models;
using WebRTCLibrary.Utils;

using static WebRTCLibrary.Utils.TaskHelpers;

//using static WebRTCLibrary.SIP.SIPConnection;


namespace WebRTCClient.Dialogs.ClientDialogs
{
    internal class ClientRegistrationDialog : SIPDialog, IAsyncDisposable
    {
        public bool Registered { get; private set; }

        private bool Registering { get; set; }

        public event Action<ClientRegistrationDialog, SIPDialogEventArgs>? OnRegistered;

        public event Action<ClientRegistrationDialog, SIPDialogEventArgs>? OnUnRegistered;

        public ClientRegistrationDialog(
            SIPParticipant sourceParticipant,
            SIPParticipant signalingServer,
            SIPConnection connection,
            string callId)
            : base(
                  sourceParticipant,
                  signalingServer,
                  connection,
                  callId)
        {
            this.Connection.MessagePredicate = this.IsPartOfDialog;
        }

        public override async Task Start()
        {
            await Register();
        }

        public override async Task Stop()
        {
            await Unregister();
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
            this.SourceTag = CallProperties.CreateNewTag();

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
                RegistrationFailed();
                return;
            }

            if (RemoteParticipant == null // Why?
                || sipResponse.Header.CSeq != 2)
            {
                // bad request - header is invalid
                RegistrationFailed();
                return;
            }

            await this.RegistrationAccepted(sipResponse);
        }

        private async Task RegistrationAccepted(SIPResponse sipResponse)
        {
            Debug.WriteLine($"Client received Accepted."); // DEBUG

            this.RemoteTag = sipResponse.Header.From.FromTag;

            // TODO: Do something with the socketerror
            await this.SendSIPMessage(SIPMethodsEnum.ACK, this.GetHeaderParams(cSeq: sipResponse.Header.CSeq + 1));

            // success
            this.Registered = true;
            this.Registering = false;

            // SourceTag is not null here. Got set on initial request.
            // TODO: what happens if we unregister just before this gets invoked?
            this.OnRegistered?.Invoke(this, new SIPDialogEventArgs(this.SourceTag!, this.RemoteTag));
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
            this.Connection.SIPResponseReceived += ListenForDisconnectAccept;

            // send disconnect message
            // TODO: do something with the socket error
            await this.SendSIPMessage(SIPMethodsEnum.BYE);

            // TODO: add failurecallback --> log failure to disconnect. Retry?
            await WaitFor(
                () => !Registered,
                timeOut: ReceiveTimeout);

            // remove listener
            // TODO: will this always run after previous task is finished?
            Connection.SIPResponseReceived -= ListenForDisconnectAccept; // remove listener
        }

        private async Task ListenForDisconnectAccept(SIPEndPoint localEndPoint, SIPEndPoint remoteEndPoint, SIPResponse sipResponse)
        {
            if (sipResponse.Status != SIPResponseStatusCodesEnum.Accepted)
            {
                // bad request - wrong status code
                
                // TODO: What to do on Unregister failed?
                return;
            }

            if (RemoteParticipant == null
                || sipResponse.Header.CSeq != 2)
            {
                // bad request - header is invalid
                // TODO: Unregister failed? - Server sent an invalid accepted
                return;
            }
    
            ResetRegistration();
        }

        private void RegistrationFailed()
        {
            Registering = false;
            ResetRegistration();
        }

        private void ResetRegistration()
        {
            SourceTag = null;
            RemoteTag = null;
            Registered = false;
        }

        private async Task SendSIPMessage(SIPMethodsEnum method, SIPHeaderParams? headerParams = null, string? message = null, CancellationToken? ct = null)
        {
            // TODO: Make ct Mandatory

            //if ((!this.Registering && !this.Registered)
            //    || (this.RemoteParticipant == null || this.SourceParticipant == null))
            //{
            //    // TODO: Log - not registered
            //    return;
            //}

            Debug.WriteLine($"Client sending {method}."); // DEBUG
            SocketError result = await this.Connection.SendSIPRequest(
                method,
                headerParams ?? this.GetHeaderParams(),
                message,
                ct,
                SendTimeout);

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
            await Unregister();
        }
    }
}
