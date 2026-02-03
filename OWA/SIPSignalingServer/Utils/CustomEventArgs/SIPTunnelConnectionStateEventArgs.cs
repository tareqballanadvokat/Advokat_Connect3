namespace SIPSignalingServer.Utils.CustomEventArgs
{
    public class SIPTunnelConnectionStateEventArgs(bool connected) : EventArgs
    {
        public bool Connected => connected;
    }
}