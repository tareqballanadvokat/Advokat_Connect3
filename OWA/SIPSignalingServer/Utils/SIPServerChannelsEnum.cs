using SIPSorcery.SIP;
using System.Net;
using System.Security.Authentication;
using System.Security.Cryptography.X509Certificates;
using WebRTCLibrary.SIP.Interfaces;
using WebSocketSharp.Net;

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
            IPEndPoint ipEndpoint = endpoint.GetIPEndPoint();

            switch (this)
            {
                case var _ when this == UDP:
                    return new SIPUDPChannel(ipEndpoint);

                case var _ when this == TCP:
                    return new SIPTCPChannel(ipEndpoint);

                case var _ when this == TLS:
                    return new SIPTLSChannel(sslCertificate, ipEndpoint);

                case var _ when this == WebSocket:
                    return new SIPWebSocketChannel(ipEndpoint.Address, ipEndpoint.Port);

                case var _ when this == WebSocketSSL:

                    if (sslCertificate == null)
                    {
                        throw new ArgumentException("You need to supply a certificate in order to create a secure server websocket channel.");
                    }

                    ServerSslConfiguration sslConfig = new ServerSslConfiguration();
                    sslConfig.ServerCertificate = sslCertificate;
                    sslConfig.CheckCertificateRevocation = true;
                    sslConfig.EnabledSslProtocols = SslProtocols.None; // lets the OS choose the TLS version

                    return new SIPWebSocketChannel(ipEndpoint, SIPConstants.DEFAULT_ENCODING, SIPConstants.DEFAULT_ENCODING, sslConfig);

                default:
                    throw new ArgumentException("Not a valid SIPChannel. Valid SIPChannels are limited to UDP, TCP, TLS, WebSocket and WebSocketSSL.");
            }
        }
    }
}
