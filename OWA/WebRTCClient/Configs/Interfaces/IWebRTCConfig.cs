namespace WebRTCClient.Configs.Interfaces
{
    public interface IWebRTCConfig
    {
        public ISIPClientConfig SIPClientConfig { get; set; }

        public IP2PConnectionConfig P2PConnectionConfig { get; set; }
    }
}
