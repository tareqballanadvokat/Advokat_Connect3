using Advokat.WebRTC.Client.Interfaces;
using Advokat.WebRTC.Client.Utils;
using SIPSorcery.Net;
using WebRTCClient.Configs.Interfaces;

namespace SIPClientTests.SDPExchangeTests.Mocks.PeerConnection
{
    internal class PeerConnection_Logs_Method_Calls : IPeerConnection
    {
        public DirectConnectionState ConnectionState { get; set; }

        public IP2PConnectionConfig Config { get => throw new NotImplementedException(); set => throw new NotImplementedException(); }

        // Remote is never controlling agent
        public bool IsControllingAgent => false;

        public event IPeerConnection.MessageReceivedDelegate? OnMessageReceived;
        public event EventHandler<DirectConnectionStateEventArgs>? ConnectionStateChanged;

        public int CreateAnswer_Called = 0;
        public int CreateOffer_Called = 0;
        public List<RTCSessionDescriptionInit> SetLocalDescription_Called = [];
        public List<RTCSessionDescriptionInit> SetRemoteDescription_Called = [];
        public int StartConnectivityChecksAsync_Called = 0;
        public int StopAsync_Called = 0;

        public async Task<RTCSessionDescriptionInit?> CreateAnswerAsync()
        {
            this.CreateAnswer_Called++;
            var sdp = new RTCSessionDescriptionInit();
            sdp.type = RTCSdpType.answer;

            return sdp;
        }

        public async Task<RTCSessionDescriptionInit?> CreateOfferAsync()
        {
            this.CreateOffer_Called++;
            var sdp = new RTCSessionDescriptionInit();
            sdp.type = RTCSdpType.offer;

            return sdp;
        }

        public void SendMessage(string message)
        {
            throw new NotImplementedException();
        }

        public async Task SetLocalDescriptionAsync(RTCSessionDescriptionInit sdp)
        {
            this.SetLocalDescription_Called.Add(sdp);
        }

        public async Task SetRemoteDescriptionAsync(RTCSessionDescriptionInit sdp)
        {
            this.SetRemoteDescription_Called.Add(sdp);
        }

        public async Task StartConnectivityChecksAsync(CancellationToken? ct = null)
        {
            this.StartConnectivityChecksAsync_Called++;
        }

        public async Task StopAsync()
        {
            this.StopAsync_Called++;
        }
    }
}
