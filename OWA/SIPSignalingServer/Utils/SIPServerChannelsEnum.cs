using SIPSorcery.SIP;
using System.Net;
using System.Security.Cryptography.X509Certificates;
using WebRTCLibrary.SIP.Interfaces;

namespace SIPSignalingServer.Utils
{
    /// <summary>Type safe enum pattern.
    ///          Can be used just like an enum. With the added method of GetChannelInstance that creates a corresponding SIPChannel instance.</summary>
    /// <version date="11.06.2025" sb="MAC">Created.</version>
    public sealed class SIPServerChannelsEnum : ISIPChannelFactory
    {
        public SIPProtocolsEnum Protocol { get; private set; }

        public static readonly SIPServerChannelsEnum UDP = new SIPServerChannelsEnum(SIPProtocolsEnum.udp);
        public static readonly SIPServerChannelsEnum TCP = new SIPServerChannelsEnum(SIPProtocolsEnum.tcp);
        public static readonly SIPServerChannelsEnum TLS = new SIPServerChannelsEnum(SIPProtocolsEnum.tls);

        public static readonly SIPServerChannelsEnum WebSocket = new SIPServerChannelsEnum(SIPProtocolsEnum.ws);
        public static readonly SIPServerChannelsEnum WebSocketSSL = new SIPServerChannelsEnum(SIPProtocolsEnum.wss);

        private SIPServerChannelsEnum(SIPProtocolsEnum protocol)
        {
            this.Protocol = protocol;
        }

        public SIPChannel GetChannelInstance(SIPEndPoint endpoint, X509Certificate2? sslCertificate = null)
        {
            switch (this)
            {
                case var _ when this == UDP:
                    return new SIPUDPChannel(endpoint.GetIPEndPoint());

                case var _ when this == TCP:
                    return new SIPTCPChannel(endpoint.GetIPEndPoint());

                case var _ when this == TLS:
                    // TODO: currently not working.
                    return new SIPTLSChannel(sslCertificate, endpoint.GetIPEndPoint());

                case var _ when this == WebSocket:
                    IPEndPoint ipEndpoint = endpoint.GetIPEndPoint();
                    return new SIPWebSocketChannel(ipEndpoint.Address, ipEndpoint.Port);

                case var _ when this == WebSocketSSL:

                    if (sslCertificate == null)
                    {
                        throw new ArgumentException("You need to supply a certificate in order to create a secure server websocket channel.");
                    }

                    return new SIPWebSocketChannel(endpoint.GetIPEndPoint(), sslCertificate);

                default:
                    throw new ArgumentException("Not a valid SIPChannel. Valid SIPChannels are limited to UDP, TCP, TLS, WebSocket and WebSocketSSL.");
            }
        }
    }
}
