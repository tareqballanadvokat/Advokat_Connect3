using WebRTCClient.Configs.Interfaces;
using WebRTCLibrary.SIP;

namespace WebRTCClient.Configs
{
    public class SIPClientConfig : SIPDialogConfig, ISIPClientConfig
    {
        public static int defaultSIPPeerConnectionTimout = 9000;

        public int SIPPeerConnectionTimout { get; set; } = defaultSIPPeerConnectionTimout;
    }
}
