using Advokat.WebRTC.Client.Utils;
using Microsoft.Extensions.Logging.Abstractions;
using SIPClientTests.SDPExchangeTests.Mocks.PeerConnection;
using SIPClientTests.SDPExchangeTests.Mocks.SIPClient;
using SIPSorcery.SIP;
using WebRTCClient;

namespace SIPClientTests.SDPExchangeTests
{
    [Collection("Sequential")]
    public class Before_SIP_Connection
    {
        [Fact]
        public async Task Does_Not_Accept_SDP_Offer()
        {
            string sdpOffer = "{\"type\":\"offer\",\"sdp\":\"v=0\\r\\no=- 41619 0 IN IP4 127.0.0.1\\r\\ns=sipsorcery\\r\\nt=0 0\\r\\na=group:BUNDLE 0\\r\\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\\r\\nc=IN IP4 0.0.0.0\\r\\na=ice-ufrag:FAKC\\r\\na=ice-pwd:RPGFSYXFXVSKBLSOVZOONAOW\\r\\na=fingerprint:sha-256 BC:24:B9:06:97:A6:A8:FA:3C:B3:39:A1:CC:34:E0:D5:36:74:D2:4C:79:17:F4:53:EF:6F:EF:C4:8E:3C:90:2D\\r\\na=setup:actpass\\r\\na=candidate:1818443557 1 udp 2113937663 192.168.1.58 10004 typ host generation 0\\r\\na=ice-options:ice2,trickle\\r\\na=mid:0\\r\\na=end-of-candidates\\r\\na=sctp-port:5000\\r\\na=max-message-size:262144\\r\\n\"}";
            string contentType = "application/sdp";

            Mock_SIPClient mockSipClient = new Mock_SIPClient();
            PeerConnection_Logs_Method_Calls mockPeerConnection = new PeerConnection_Logs_Method_Calls();

            P2PConnection p2pConnection = new P2PConnection(
                mockSipClient,
                mockPeerConnection,
                NullLoggerFactory.Instance);

            await p2pConnection.Start();

            mockSipClient.ConnectionState = SIPConnectionState.Disconnected;
            await Task.Delay(10);

            await mockSipClient.ReceiveSIPRequest(SIPMethodsEnum.SERVICE, sdpOffer, contentType, 1);
            await Task.Delay(10);

            Assert.Equal(0, mockPeerConnection.CreateOffer_Called);
            Assert.Equal(0, mockPeerConnection.CreateAnswer_Called);

            Assert.Empty(mockPeerConnection.SetLocalDescription_Called);
            Assert.Empty(mockPeerConnection.SetRemoteDescription_Called);

            mockSipClient.ConnectionState = SIPConnectionState.Registered;
            await Task.Delay(10);

            await mockSipClient.ReceiveSIPRequest(SIPMethodsEnum.SERVICE, sdpOffer, contentType, 1);
            await Task.Delay(10);

            Assert.Equal(0, mockPeerConnection.CreateOffer_Called);
            Assert.Equal(0, mockPeerConnection.CreateAnswer_Called);

            Assert.Empty(mockPeerConnection.SetLocalDescription_Called);
            Assert.Empty(mockPeerConnection.SetRemoteDescription_Called);

            mockSipClient.ConnectionState = SIPConnectionState.Connecting;
            await Task.Delay(10);

            await mockSipClient.ReceiveSIPRequest(SIPMethodsEnum.SERVICE, sdpOffer, contentType, 1);
            await Task.Delay(10);

            Assert.Equal(0, mockPeerConnection.CreateOffer_Called);
            Assert.Equal(0, mockPeerConnection.CreateAnswer_Called);

            Assert.Empty(mockPeerConnection.SetLocalDescription_Called);
            Assert.Empty(mockPeerConnection.SetRemoteDescription_Called);
        }
    }
}
