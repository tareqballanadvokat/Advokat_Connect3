using SIPSorcery.SIP;

namespace SIPSignalingServer.Utils.CustomEventArgs
{
    public class SIPResponseEventArgs(SIPResponse response) : EventArgs
    {
        public SIPResponse Response { get => response; }
    }
}
