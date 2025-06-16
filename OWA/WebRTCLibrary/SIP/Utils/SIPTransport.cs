using SIPSorcery.SIP;
using System.Net;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using WebRTCLibrary.SIP.Interfaces;

namespace WebRTCLibrary.SIP.Utils
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

        public SIPTransport(IPEndPoint sourceEndpoint, IEnumerable<ISIPChannelFactory> sipChannels, X509Certificate2? sslCertificate = null)
            : this()
        {
            foreach (ISIPChannelFactory channel in sipChannels)
            {
                // set listening channels
                this.AddSIPChannel(channel.GetChannelInstance(new SIPEndPoint(channel.Protocol, sourceEndpoint), sslCertificate));
            }
        }
    }
}
