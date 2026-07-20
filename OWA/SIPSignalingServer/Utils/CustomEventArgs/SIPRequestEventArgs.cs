using SIPSorcery.SIP;

namespace SIPSignalingServer.Utils.CustomEventArgs
{
    public class SIPRequestEventArgs(SIPRequest request) : EventArgs
    {
        public SIPRequest Request { get => request; }
    }
}
