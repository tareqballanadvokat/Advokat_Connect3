using SIPSorcery.SIP;
using System.Net;
using System.Security.Cryptography.X509Certificates;
using WebRTCLibrary.SIP.Models;

namespace WebRTCLibrary.SIP.Utils
{
    /// <summary>Type safe enum pattern.
    ///          Can be used just like an enum. With the added method of GetChannelInstance that creates a corresponding SIPChannel instance.</summary>
    /// <version date="22.04.2025" sb="MAC">Created.</version>
    /// <version date="05.06.2025" sb="MAC">Added WebSocket support. Moved to WebRTCLibrary.</version>
    public sealed class SIPChannelsEnum
    {
        public static X509Certificate2? SSLCertificate { get; set; } = null;

        public SIPProtocolsEnum Protocol { get; private set; }

        public static readonly SIPChannelsEnum UDP = new SIPChannelsEnum(SIPProtocolsEnum.udp);
        public static readonly SIPChannelsEnum TCP = new SIPChannelsEnum(SIPProtocolsEnum.tcp);
        public static readonly SIPChannelsEnum TLS = new SIPChannelsEnum(SIPProtocolsEnum.tls);

        public static readonly SIPChannelsEnum WebSocketClient = new SIPChannelsEnum(SIPProtocolsEnum.ws);
        public static readonly SIPChannelsEnum WebSocketServer = new SIPChannelsEnum(SIPProtocolsEnum.ws);

        public static readonly SIPChannelsEnum WebSocketSSLClient = new SIPChannelsEnum(SIPProtocolsEnum.wss);
        public static readonly SIPChannelsEnum WebSocketSSLServer = new SIPChannelsEnum(SIPProtocolsEnum.wss);


        private SIPChannelsEnum(SIPProtocolsEnum protocol)
        {
            this.Protocol = protocol;
        }

        public SIPChannel GetChannelInstance(SIPEndPoint endpoint)
        {
            switch (this)
            {
                case var _ when this == UDP:
                    return new SIPUDPChannel(endpoint.GetIPEndPoint());

                case var _ when this == TCP:
                    return new SIPTCPChannel(endpoint.GetIPEndPoint());

                case var _ when this == TLS:
                    return new SIPTLSChannel(endpoint.GetIPEndPoint());

                case var _ when this == WebSocketClient:
                    return new SIPClientWebSocketChannel();

                case var _ when this == WebSocketServer:
                    IPEndPoint ipEndpoint = endpoint.GetIPEndPoint();
                    return new SIPWebSocketChannel(ipEndpoint.Address, ipEndpoint.Port);

                case var _ when this == WebSocketSSLClient:
                    return new SIPClientWebSocketChannel();

                case var _ when this == WebSocketSSLServer:
                    
                    if (SSLCertificate == null)
                    {
                        throw new ArgumentException("You need to supply a certificate in order to create a secure server websocket channel. Set the SSLCertificate property.");
                    }

                    return new SIPWebSocketChannel(endpoint.GetIPEndPoint(), SSLCertificate);

                default:
                    // This can never happen. Constructor is private. An instance of SIPChannelsEnum must always be one of the options above.
                    throw new Exception();
            }
        }
    }
}
