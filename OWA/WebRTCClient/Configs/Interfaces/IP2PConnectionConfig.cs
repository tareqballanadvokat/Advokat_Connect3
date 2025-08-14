using SIPSorcery.Sys;

namespace WebRTCClient.Configs.Interfaces
{
    public interface IP2PConnectionConfig
    {
        public int ConnectionTimeout { get; set; }

        public PortRange PortRange { get; set; }
    }
}
