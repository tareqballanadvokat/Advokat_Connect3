using System.Net;
using WebRTCLibrary.SIP;
using WebRTCLibrary.SIP.Models;
using WebRTCLibrary.Utils;

namespace WebRTCClient.Dialogs.ClientDialogs
{
    internal class ClientDialog : SIPDialog
    {
        public bool Registered { get => RegistrationDialog.Registered; }

        //public bool Connected { get => false; } // SIPTunnel.Connected

        //public bool ConnectionPending { get => this.Registered && !this.Connected; }

        private ClientRegistrationDialog RegistrationDialog { get; set; }

        public IPEndPoint SignalingServer { get; private set; }

        public ClientDialog(
            SIPParticipant sourceParticipant,
            SIPParticipant remoteParticipant,
            SIPConnection connection,
            string? callId = null,
            string? sourceTag = null,
            string? remoteTag = null)
            : base(
                sourceParticipant,
                remoteParticipant,
                connection,
                callId,
                sourceTag,
                remoteTag)
        {
            RegistrationDialog = new ClientRegistrationDialog(this.SourceParticipant, this.RemoteParticipant, Connection, CallId);
            RegistrationDialog.SendTimeout = SendTimeout;
            RegistrationDialog.ReceiveTimeout = ReceiveTimeout;

            RegistrationDialog.OnRegistered += RegistationSuccessful;
            //RegistrationManager.OnUnRegistered += OnUnRegistered;
        }

        public override async Task Start()
        {
            await RegistrationDialog.Start();
        }

        public override async Task Stop()
        {
            await RegistrationDialog.Stop();
        }

        private void RegistationSuccessful(ClientRegistrationDialog sender, SIPDialogEventArgs eventArgs)
        {
            SourceTag = eventArgs.SourceTag;
            RemoteTag = eventArgs.RemoteTag;
        }

        //private void OnUnRegistered(RegistrationManager sender)
        //{
        //    // close SIPTunnel 
        //}
    }
}
