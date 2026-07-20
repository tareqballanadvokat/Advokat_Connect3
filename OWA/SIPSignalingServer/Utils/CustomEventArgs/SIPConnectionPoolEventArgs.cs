using SIPSignalingServer.Models;

namespace SIPSignalingServer.Utils.CustomEventArgs
{
    public class SIPConnectionPoolEventArgs(SIPTunnel tunnel) : EventArgs
    {
        public SIPTunnel Tunnel => tunnel;
    }
}
