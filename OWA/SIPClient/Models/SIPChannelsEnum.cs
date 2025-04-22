using SIPSorcery.SIP;
using System.Net;
using WebRTCLibrary.SIP.Models;

namespace WebRTCClient.Models
{
    /// <summary>Type safe enum pattern.
    ///          Can be used just like an enum. With the added method of GetChannelInstance that creates a corresponding SIPChannel instance.</summary>
    /// <version date="22.04.2025" sb="MAC">Created.</version>
    public sealed class SIPChannelsEnum
    {
        private readonly string name;

        public static readonly SIPChannelsEnum UDP = new SIPChannelsEnum("UDP");
        public static readonly SIPChannelsEnum TCP = new SIPChannelsEnum("TCP");
        public static readonly SIPChannelsEnum TLS = new SIPChannelsEnum("TLS");
        public static readonly SIPChannelsEnum WebSocket = new SIPChannelsEnum("WebSocket");

        private SIPChannelsEnum(string name)
        {
            this.name = name;
        }

        public SIPChannel GetChannelInstance(SIPParticipant caller)
        {
            switch (this)
            {
                case var _ when this == UDP:
                    return new SIPUDPChannel(caller.Endpoint.GetIPEndPoint());

                case var _ when this == TCP:
                    return new SIPTCPChannel(caller.Endpoint.GetIPEndPoint());

                case var _ when this == TLS:
                    return new SIPTLSChannel(caller.Endpoint.GetIPEndPoint());

                case var _ when this == WebSocket:
                    // TODO: check if this works. Should we use SIPClientWebSocketChannel?
                    IPEndPoint ipEndpoint = caller.Endpoint.GetIPEndPoint();
                    return new SIPWebSocketChannel(ipEndpoint.Address, ipEndpoint.Port);

                default:
                    // This can never happen. Constructor is private. An instance of SIPChannelsEnum must always be one of the four options above.
                    throw new Exception();
            }
        }
    }

}
