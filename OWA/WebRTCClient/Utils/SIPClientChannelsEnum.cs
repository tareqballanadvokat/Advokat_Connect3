using SIPSorcery.SIP;
using System.Net;
using System.Security.Cryptography.X509Certificates;
using WebRTCLibrary.SIP.Interfaces;

namespace WebRTCClient.Utils
{
    /// <summary>Type safe enum pattern.
    ///          Can be used just like an enum. With the added method of GetChannelInstance that creates a corresponding SIPChannel instance.</summary>
    /// <version date="11.06.2025" sb="MAC">Created.</version>
    public sealed class SIPClientChannelsEnum : ISIPChannelFactory
    {
        public SIPProtocolsEnum Protocol { get; private set; }

        public static readonly SIPClientChannelsEnum UDP = new SIPClientChannelsEnum(SIPProtocolsEnum.udp);
        public static readonly SIPClientChannelsEnum TCP = new SIPClientChannelsEnum(SIPProtocolsEnum.tcp);
        public static readonly SIPClientChannelsEnum TLS = new SIPClientChannelsEnum(SIPProtocolsEnum.tls);

        public static readonly SIPClientChannelsEnum WebSocket = new SIPClientChannelsEnum(SIPProtocolsEnum.ws);
        public static readonly SIPClientChannelsEnum WebSocketSSL = new SIPClientChannelsEnum(SIPProtocolsEnum.wss);

        private SIPClientChannelsEnum(SIPProtocolsEnum protocol)
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
                    return new SIPTLSChannel(ipEndpoint);

                case var _ when this == WebSocket:
                    return new SIPClientWebSocketChannel();

                case var _ when this == WebSocketSSL:
                    return new SIPClientWebSocketChannel();

                default:
                    throw new ArgumentException("Not a valid SIPChannel. Valid SIPChannels are limited to UDP, TCP, TLS, WebSocket and WebSocketSSL.");
            }
        }
    }
}
