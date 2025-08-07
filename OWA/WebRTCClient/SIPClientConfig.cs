using WebRTCLibrary.SIP;

namespace WebRTCClient
{
    public class SIPClientConfig : SIPDialogConfig
    {
        public static int defaultSIPPeerConnectionTimout = 9000;

        public int SIPPeerConnectionTimout { get; set; } = defaultSIPPeerConnectionTimout;
    }
}
