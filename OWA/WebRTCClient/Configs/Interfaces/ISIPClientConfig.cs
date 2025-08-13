using WebRTCLibrary.SIP.Interfaces;

namespace WebRTCClient.Configs.Interfaces
{
    public interface ISIPClientConfig : ISIPDialogConfig
    {
        //public bool ReconnectSIP { get; set; }

        public int SIPPeerConnectionTimout { get; set; }
    }
}
