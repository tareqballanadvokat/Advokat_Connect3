using SIPSorcery.SIP;
using System.Net;
using WebRTCLibrary.SIP;
using WebRTCLibrary.SIP.Models;
using WebRTCLibrary.Utils;

namespace WebRTCLibrary.Dialogs.ClientDialogs
{
    public class ClientDialog : SIPDialog
    {
        public bool Registered { get => RegistrationDialog.Registered; }

        //public bool Connected { get => false; } // SIPTunnel.Connected

        //public bool ConnectionPending { get => this.Registered && !this.Connected; }

        private RegistrationDialog RegistrationDialog { get; set; }

        public IPEndPoint SignalingServer { get; private set; }

        public ClientDialog(
            SIPParticipant sourceParticipant,
            string remoteUser,
            SIPEndPoint signalingServer,
            SIPConnection connection,
            string? callId = null,
            string? sourceTag = null,
            string? remoteTag = null)
            : base(
                sourceParticipant,
                new(remoteUser, SIPEndPoint.Empty), // we do not know the enpoint ip yet. Not even the public one.
                connection,
                callId,
                sourceTag,
                remoteTag)
        {
            // send registration addressed to SIPParticipant with username of remote and endpoint of signaling server. We don't know the remoteparticipants endpoint yet.
            SIPParticipant signalingServerAsRemote = new SIPParticipant(this.RemoteParticipant.Name, signalingServer);
            RegistrationDialog = new RegistrationDialog(SourceParticipant, signalingServerAsRemote, Connection, CallId);
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

        private void RegistationSuccessful(RegistrationDialog sender, SIPDialogEventArgs eventArgs)
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
