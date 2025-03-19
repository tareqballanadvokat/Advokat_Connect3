using SIPSorcery.SIP;

namespace WebRTCCallerLibrary.Models
{
    public class SIPHeaderParams
    {
        public SIPParticipant SourceParticipant { get; set; }

        public SIPParticipant RemoteParticipant { get; set; }

        public string? FromTag { get; set; }

        public string? ToTag { get; set; }

        public int CSeq { get; set; } = 1;

        public string? CallID{ get; set; }

        public SIPHeaderParams(
            SIPParticipant source,
            SIPParticipant remote,
            string? fromTag = null,
            string? toTag = null,
            int cSeq = 1,
            string? callID = null)
        {
            this.SourceParticipant = source;
            this.RemoteParticipant = remote;
            FromTag = fromTag;
            ToTag = toTag;
            CSeq = cSeq;
            CallID = callID;
        }
    }
}
