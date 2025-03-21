using SIPSorcery.SIP;
using System.Net.Sockets;
using WebRTCLibrary.SIP;
using WebRTCLibrary.SIP.Models;
using WebRTCLibrary.Utils;

using static WebRTCLibrary.Utils.TaskHelpers;

//using static WebRTCLibrary.SIP.SIPConnection;


namespace WebRTCLibrary.Dialogs.ClientDialogs
{
    internal class RegistrationDialog : SIPDialog, IAsyncDisposable
    {
        public bool Registered { get; private set; }

        private bool Registering { get; set; }

        public event Action<RegistrationDialog, SIPDialogEventArgs> OnRegistered;

        public event Action<RegistrationDialog, SIPDialogEventArgs> OnUnRegistered;

        public RegistrationDialog(
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
            if (Registered || Registering)
            {
                // TODO: log. already registered or registering
                return;
            }

            Registering = true;
            this.SourceTag = CallProperties.CreateNewTag();

            // set response delegate
            Connection.SIPResponseReceived += this.ListenForRegistrationAccept;

            // send request
            await SendSIPMessage(SIPMethodsEnum.REGISTER);

            await WaitFor(
                () => Registered && !Registering,
                failureCallback: RegistrationFailed,
                timeOut: ReceiveTimeout);

            // TODO: make sure this happens after timeout / failure or success
            // remove listener
            Connection.SIPResponseReceived -= this.ListenForRegistrationAccept;

        }

        private async Task ListenForRegistrationAccept(SIPEndPoint localEndPoint, SIPEndPoint remoteEndPoint, SIPResponse sipResponse)
        {
            if (sipResponse.Status == SIPResponseStatusCodesEnum.Accepted
                && RemoteParticipant != null
                // TODO: implement this comparison better - is it even needed?
                //&& remoteEndPoint.GetIPEndPoint().ToString() == this.RemoteParticipant.Endpoint.GetIPEndPoint().ToString()

                //&& sipResponse.Header.To.ToTag == this.SourceTag // TODO: activate. Signaling server does currently not respond with the correct tag
                )
            {
                RemoteTag = sipResponse.Header.From.FromTag;

                await SendSIPMessage(SIPMethodsEnum.ACK, GetHeaderParams(cSeq: sipResponse.Header.CSeq + 1));

                // success
                Registered = true;
                Registering = false;

                // SourceTag should always be set here. 
                OnRegistered?.Invoke(this, new SIPDialogEventArgs(this.SourceTag, this.RemoteTag));
                return;
            }

            // Signaling server sends not found if the other peer is not present
            // TODO: remove afte it has been fixed.
            if (sipResponse.Status == SIPResponseStatusCodesEnum.NotFound)
            {
                return;
            }

            //TODO: Only fail if response is for this dialog (tag matches)

            // failure
            RegistrationFailed();
        }

        public async Task Unregister()
        {
            if (!Registered)
            {
                // TODO: log. Not registered
                return;
            }

            if (Registering)
            {
                // TODO: cancel registering and check if we have to continue
                return;
            }

            string tag = CallProperties.CreateNewTag();

            // set response listener
            Connection.SIPResponseReceived += ListenForDisconnectAccept;

            // send disconnect message
            await SendSIPMessage(SIPMethodsEnum.BYE);

            // TODO: add failurecallback --> log failure to disconnect. Retry?
            await WaitFor(() => !Registered, timeOut: ReceiveTimeout);

            // TODO: will this always run after previous task is finished?
            // remove listener
            Connection.SIPResponseReceived -= ListenForDisconnectAccept; // remove listener
        }

        private async Task ListenForDisconnectAccept(
            SIPEndPoint localEndPoint,
            SIPEndPoint remoteEndPoint,
            SIPResponse sipResponse)
        {
            if (sipResponse.Status == SIPResponseStatusCodesEnum.Accepted
                && RemoteParticipant != null
                // TODO: implement this comparison better - is it even needed?
                //&& remoteEndPoint.GetIPEndPoint().ToString() == this.RemoteParticipant.Endpoint.GetIPEndPoint().ToString()

                //&& sipResponse.Header.To.ToTag == requestFromTag // TODO: activate. Signaling server does currently not respond with the correct tag
                )
            {
                // TODO should this be Acknowledged aswell? What if the accept doesn't reach the peer. We still think we are registered.

                ResetRegistration();
                return;
            }

            // failed
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

            SocketError result = await Connection.SendSIPRequest(
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
