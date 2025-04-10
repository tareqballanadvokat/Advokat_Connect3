using WebRTCLibrary.SIP.Models;

namespace SIPSignalingServer.Models
{
    internal class ServerSideDialogParams : DialogParams
    {
        // Signaling server acts as the remote participant
        public new SIPParticipant RemoteParticipant { get => this.SourceParticipant; }

        public SIPParticipant ClientParticipant { get => base.RemoteParticipant; }

        public string? ClientTag
        { 
            get => base.RemoteTag;
            set => base.RemoteTag = value;
        }

        public new string? RemoteTag
        {
            get => this.SourceTag;
            set => this.SourceTag = value;
        }

        public ServerSideDialogParams(
            SIPParticipant remoteParticipant,
            SIPParticipant clientParticipant,
            string? callId = null,
            string? remoteTag = null,
            string? clientTag = null) 
            : base(
                  sourceParticipant: remoteParticipant,
                  remoteParticipant: clientParticipant,
                  remoteTag,
                  clientTag,
                  callId)
        {
        }

        public static ServerSideDialogParams Empty()
        {
            // very experimental
            return new ServerSideDialogParams(null, null);
        }
    }
}
