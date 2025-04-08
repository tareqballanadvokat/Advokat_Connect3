namespace SIPSignalingServer.Models
{
    internal class SIPTunnel
    {
        public SIPRegistration Left { get; private set; }

        public SIPRegistration Right { get; private set; }

        public string CallID { get; private set; }

        public SIPTunnel(SIPRegistration left, SIPRegistration right, string callID)
        {
            Left = left;
            Right = right;
            CallID = callID;
        }
    }
}
