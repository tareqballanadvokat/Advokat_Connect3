namespace WebRTCLibrary.SIP.Models
{
    public class TransactionParams
    {
        public SIPParticipant SourceParticipant { get; private set; }

        public SIPParticipant RemoteParticipant { get; private set; }

        public string? SourceTag { get; set; } // set as a method - should be discuraged

        public string? RemoteTag { get; set; } // set as a method - should be discuraged

        public string? CallId { get; set; }

        public TransactionParams(
            SIPParticipant sourceParticipant,
            SIPParticipant remoteParticipant,
            string? sourceTag = null,
            string? remoteTag = null,
            string? callId = null)
        {
            SourceParticipant = sourceParticipant;
            RemoteParticipant = remoteParticipant;
            SourceTag = sourceTag;
            RemoteTag = remoteTag;
            CallId = callId;
        }
    }
}
