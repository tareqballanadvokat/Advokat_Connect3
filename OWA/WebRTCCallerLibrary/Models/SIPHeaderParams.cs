using SIPSorcery.SIP;

namespace WebRTCCallerLibrary.Models
{
    public class SIPHeaderParams
    {
        public string? FromTag { get; set; }

        public string? ToTag { get; set; }

        public int CSeq { get; set; } = 1;
        
        public SIPHeaderParams()
        {
        }

        public SIPHeaderParams(string? fromTag = null, string? toTag = null, int cSeq = 1)
        {
            FromTag = fromTag;
            ToTag = toTag;
            CSeq = cSeq;
        }
    }
}
