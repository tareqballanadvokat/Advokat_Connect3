using WebRTCLibrary.SIP;

namespace WebRTCClient
{
    public class WebRTCConfig : SIPClientConfig
    {
        //public bool ReconnectSIP { get; set; }

        public static int defaultP2PConnectionTimeout = 5000;

        public int P2PConnectionTimeout { get; set; } = defaultP2PConnectionTimeout;
    }
}
