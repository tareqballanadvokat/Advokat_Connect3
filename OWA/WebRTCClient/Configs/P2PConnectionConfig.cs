using SIPSorcery.Sys;
using WebRTCClient.Configs.Interfaces;

namespace WebRTCClient.Configs
{
    public class P2PConnectionConfig : IP2PConnectionConfig
    {
        public static int defaultP2PConnectionTimeout = 5000;

        public int ConnectionTimeout { get; set; } = defaultP2PConnectionTimeout;

        public static readonly PortRange defaultP2PPortRange = new PortRange(10000, 10010, true); // TODO: Check which portrange to actually use

        public PortRange PortRange { get; set; } = defaultP2PPortRange;
    }
}
