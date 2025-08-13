using SIPSorcery.Sys;
using WebRTCClient.Configs.Interfaces;

namespace WebRTCClient.Configs
{
    public class WebRTCConfig : IWebRTCConfig
    {

        public ISIPClientConfig SIPClientConfig { get; set; }

        public IP2PConnectionConfig P2PConnectionConfig { get; set; }

        public WebRTCConfig()
        {
            this.SIPClientConfig = new SIPClientConfig();
            this.P2PConnectionConfig = new P2PConnectionConfig();
        }   
    }
}
