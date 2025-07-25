using SIPSorcery.Net;
using WebRTCLibrary.SIP.Interfaces;

namespace WebRTCClient.Transactions.SDP
{
    internal abstract class SDPTransaction
    {
        protected static readonly string SDPContentType = "application/sdp";

        protected static readonly string SDPAllocationContentType = "application/json";

        protected RTCPeerConnection PeerConnection { get; private set; }

        public int StartCSeq { get; set; } = 1;

        public int CurrentCSeq { get; private set; }

        protected ISIPMessager Connection {  get; private set; }

        public SDPTransaction(ISIPMessager sipConnection, RTCPeerConnection peerConnection)
        {
            this.Connection = sipConnection;
            this.PeerConnection = peerConnection;
        }

        public async virtual Task Start()
        {
            this.CurrentCSeq = this.StartCSeq;
        }
    }
}
