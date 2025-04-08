using WebRTCLibrary.SIP.Models;

namespace SIPSignalingServer.Models
{
    internal class ServerSideDialogParams : DialogParams
    {
        // Signaling server acts as the remote participant
        public new SIPParticipant RemoteParticipant { get => this.SourceParticipant; }

        public SIPParticipant ClientParticipant { get => base.RemoteParticipant; }

        public ServerSideDialogParams(
            SIPParticipant remoteParticipant,
            SIPParticipant clientParticipant,
            string? callId = null,
            string? sourceTag = null,
            string? remoteTag = null) 
            : base(
                  remoteParticipant,
                  clientParticipant,
                  callId,
                  sourceTag,
                  remoteTag)
        {
        }

        public static ServerSideDialogParams Empty()
        {
            // very experimental
            return new ServerSideDialogParams(null, null);
        }
    }
}
