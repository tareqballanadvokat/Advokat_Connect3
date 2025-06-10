using SIPSorcery.SIP;
using System.Net;
using WebRTCLibrary.SIP.Models;

namespace WebRTCLibrary.SIP.Utils
{
    /// <summary>Type safe enum pattern.
    ///          Can be used just like an enum. With the added method of GetChannelInstance that creates a corresponding SIPChannel instance.</summary>
    /// <version date="22.04.2025" sb="MAC">Created.</version>
    /// <version date="05.06.2025" sb="MAC">Added WebSocket support. Moved to WebRTCLibrary.</version>
    public sealed class SIPChannelsEnum
    {
        public SIPProtocolsEnum Protocol { get; private set; }

        public static readonly SIPChannelsEnum UDP = new SIPChannelsEnum(SIPProtocolsEnum.udp);
        public static readonly SIPChannelsEnum TCP = new SIPChannelsEnum(SIPProtocolsEnum.tcp);
        public static readonly SIPChannelsEnum TLS = new SIPChannelsEnum(SIPProtocolsEnum.tls);

        // Add wss as seperate channel
        public static readonly SIPChannelsEnum WebSocketClient = new SIPChannelsEnum(SIPProtocolsEnum.ws);
        public static readonly SIPChannelsEnum WebSocketServer = new SIPChannelsEnum(SIPProtocolsEnum.ws);

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

                    // TODO: Add Certificate for wss. Only works for ws currently
                    return new SIPWebSocketChannel(ipEndpoint.Address, ipEndpoint.Port);

                default:
                    // This can never happen. Constructor is private. An instance of SIPChannelsEnum must always be one of the four options above.
                    throw new Exception();
            }
        }
    }
}
