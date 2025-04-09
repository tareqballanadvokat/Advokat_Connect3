namespace SIPSignalingServer.Models
{
    internal class SIPTunnel
    {
        public SIPTunnelEndpoint Left { get; private set; }

        //private DialogRelay LeftRelay 

        public SIPTunnelEndpoint Right { get; private set; }

        public string CallID { get; private set; }

        public bool Confirmed { get; set; }

        public SIPTunnel(SIPTunnelEndpoint left, SIPTunnelEndpoint right, string callID)
        {
            Left = left;
            Right = right;
            CallID = callID;

            //this.Left.
        }
    }
}
