using SIPSorcery.Net;
using WebRTCClient.Transactions.SIP.Interfaces;

namespace WebRTCClient.Transactions.SDP
{
    internal abstract class SDPTransaction //: SIPTransaction
    {
        protected static readonly string SDPContentType = "application/sdp";

        protected static readonly string SDPAllocationContentType = "application/json";

        protected RTCPeerConnection PeerConnection { get; private set; }

        public int StartCSeq { get; set; } = 1;

        public int CurrentCSeq { get; private set; }

        protected ISIPClient Connection {  get; private set; }

        protected CancellationTokenSource Cts { get; private set; }

        protected CancellationToken Ct { get => this.Cts.Token; }

        public SDPTransaction(ISIPClient sipConnection, RTCPeerConnection peerConnection)
            //: base(null)
        {
            this.Connection = sipConnection;
            this.PeerConnection = peerConnection;
        }

        public async virtual Task Start(CancellationToken? ct = null)
        {
            this.Cts = ct == null ? new CancellationTokenSource() : CancellationTokenSource.CreateLinkedTokenSource((CancellationToken)ct);
            this.CurrentCSeq = this.StartCSeq;
        }
    }
}
