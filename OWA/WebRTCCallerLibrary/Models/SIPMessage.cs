using SIPSorcery.SIP;
using WebRTCCallerLibrary.Utils;

namespace WebRTCCallerLibrary.Models
{
    public class SIPMessage
    {
        public SIPParticipant To { get; set; }

        public string? Message { get; set; }

        public string? Tag { get; set; }

        public int? CSeq { get; set; }

        internal SIPMessage(SIPParticipant to)
        {
            this.To = to;
        }

        internal SIPMessage(SIPParticipant to, string? message = null, string? tag = null, int? CSeq = null)
        {
            this.To = to;
            this.Message = message;
            this.Tag = tag;
            this.CSeq = CSeq;
        }
    }
}
