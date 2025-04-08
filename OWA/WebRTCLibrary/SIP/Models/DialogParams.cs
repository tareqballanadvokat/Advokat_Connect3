using SIPSorcery.SIP;

namespace WebRTCLibrary.SIP.Models
{
    public class DialogParams
    {
        public SIPParticipant SourceParticipant { get; private set; }

        public SIPParticipant RemoteParticipant { get; private set; }

        public string? SourceTag { get; set; } // set as a method - should be discuraged

        public string? RemoteTag { get; set; } // set as a method - should be discuraged

        public string? CallId { get; set; }

        public DialogParams(
            SIPParticipant sourceParticipant,
            SIPParticipant remoteParticipant,
            string? callId = null,
            string? sourceTag = null,
            string? remoteTag = null)
        {
            SourceParticipant = sourceParticipant;
            RemoteParticipant = remoteParticipant;
            CallId = callId;
            SourceTag = sourceTag;
            RemoteTag = remoteTag;
        }
    }
}
