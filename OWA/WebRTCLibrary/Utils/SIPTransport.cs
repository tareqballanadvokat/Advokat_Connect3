using System.Text;
using WebRTCLibrary.SIP.Interfaces;

namespace WebRTCLibrary.Utils
{
    public class SIPTransport : SIPSorcery.SIP.SIPTransport, ISIPTransport
    {
        public SIPTransport()
            : base()
        {
        }

        public SIPTransport(Encoding sipEncoding, Encoding sipBodyEncoding)
            : base(sipEncoding, sipBodyEncoding)
        {
        }

        public SIPTransport(bool stateless)
            : base(stateless)
        {
        }

        public SIPTransport(bool stateless, Encoding sipEncoding, Encoding sipBodyEncoding)
            : base(stateless, sipEncoding, sipBodyEncoding)
        {
        }
    }
}
