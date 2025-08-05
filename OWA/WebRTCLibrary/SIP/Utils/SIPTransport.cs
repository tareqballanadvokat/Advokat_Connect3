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
            foreach (ISIPChannelFactory channelFactory in sipChannels)
            {
                // set listening channels
                // TODO: threw an InvalidOperationException --> probably multiple processes on same socket

                SIPChannel channel = channelFactory.GetChannelInstance(new SIPEndPoint(channelFactory.Protocol, sourceEndpoint), sslCertificate);
                this.AddSIPChannel(channel);
            }
        }
    }
}
