using SIPSorcery.SIP;
using System.Security.Cryptography.X509Certificates;

namespace WebRTCLibrary.SIP.Interfaces
{
    public interface ISIPChannelFactory
    {
        public SIPProtocolsEnum Protocol { get; }

        public SIPChannel GetChannelInstance(SIPEndPoint endpoint, X509Certificate2? sslCertificate = null);
    }
}
