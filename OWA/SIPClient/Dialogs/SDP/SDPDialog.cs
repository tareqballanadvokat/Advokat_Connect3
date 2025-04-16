using SIPSorcery.Net;
using WebRTCLibrary.SIP;

namespace WebRTCClient.Dialogs.SDP
{
    internal abstract class SDPDialog
    {
        protected RTCPeerConnection PeerConnection { get; private set; }

        protected int StartCSeq { get; private set; }

        protected ISIPMessager Connection {  get; private set; }

        // list can be changed from the outside...
        public SDPDialog(ISIPMessager connection, RTCPeerConnection peerConnection, int startCSeq = 1)
        {
            this.Connection = connection;
            this.PeerConnection = peerConnection;
            this.StartCSeq = startCSeq;
        }

        public abstract Task Start();
    }
}
