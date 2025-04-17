using SIPSorcery.Net;
using WebRTCLibrary.SIP;

namespace WebRTCClient.Transactions.SDP
{
    internal abstract class SDPTransaction
    {
        protected static readonly string SDPContentType = "application/sdp";

        protected RTCPeerConnection PeerConnection { get; private set; }

        protected int StartCSeq { get; private set; }

        protected ISIPMessager Connection {  get; private set; }

        // list can be changed from the outside...
        public SDPTransaction(ISIPMessager sipConnection, RTCPeerConnection peerConnection, int startCSeq = 1)
        {
            this.Connection = sipConnection;
            this.PeerConnection = peerConnection;
            this.StartCSeq = startCSeq;
        }

        public abstract Task Start();
    }
}
