using Advokat.WebRTC.Client.Utils;
using Microsoft.Extensions.Logging.Abstractions;
using SIPClientTests.SDPExchangeTests.Mocks.PeerConnection;
using SIPClientTests.SDPExchangeTests.Mocks.SIPClient;
using SIPSorcery.Net;
using SIPSorcery.SIP;
using WebRTCClient;

namespace SIPClientTests.SDPExchangeTests
{
    [Collection("Sequential")]
    public class After_SDP_Offer
    {
        [Fact]
        public async Task Sets_Offer()
        {
            string sdp = "v=0\r\no=- 41619 0 IN IP4 127.0.0.1\r\ns=sipsorcery\r\nt=0 0\r\na=group:BUNDLE 0\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\nc=IN IP4 0.0.0.0\r\na=ice-ufrag:FAKC\r\na=ice-pwd:RPGFSYXFXVSKBLSOVZOONAOW\r\na=fingerprint:sha-256 BC:24:B9:06:97:A6:A8:FA:3C:B3:39:A1:CC:34:E0:D5:36:74:D2:4C:79:17:F4:53:EF:6F:EF:C4:8E:3C:90:2D\r\na=setup:actpass\r\na=candidate:1818443557 1 udp 2113937663 192.168.1.58 10004 typ host generation 0\r\na=ice-options:ice2,trickle\r\na=mid:0\r\na=end-of-candidates\r\na=sctp-port:5000\r\na=max-message-size:262144\r\n";
            string sdpOffer = $"{{\"type\":\"offer\",\"sdp\":\"{sdp}\"}}";
            string contentType = "application/sdp";

            Mock_SIPClient mockSipClient = new Mock_SIPClient();
            PeerConnection_Logs_Method_Calls mockPeerConnection = new PeerConnection_Logs_Method_Calls();

            P2PConnection p2pConnection = new P2PConnection(
                mockSipClient,
                mockPeerConnection,
                NullLoggerFactory.Instance);

            await p2pConnection.Start();

            mockSipClient.ConnectionState = SIPConnectionState.Connected;
            await Task.Delay(10);

            await mockSipClient.ReceiveSIPRequest(SIPMethodsEnum.SERVICE, sdpOffer, contentType, 1);
            await Task.Delay(10);

            Assert.Equal(0, mockPeerConnection.CreateOffer_Called);

            Assert.Single(mockPeerConnection.SetRemoteDescription_Called);
            Assert.Equal(sdp, mockPeerConnection.SetRemoteDescription_Called.Single().sdp);
            Assert.Equal(RTCSdpType.offer, mockPeerConnection.SetRemoteDescription_Called.Single().type);
        }

        [Fact]
        public async Task Creates_Answer()
        {
            string sdp = "v=0\r\no=- 41619 0 IN IP4 127.0.0.1\r\ns=sipsorcery\r\nt=0 0\r\na=group:BUNDLE 0\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\nc=IN IP4 0.0.0.0\r\na=ice-ufrag:FAKC\r\na=ice-pwd:RPGFSYXFXVSKBLSOVZOONAOW\r\na=fingerprint:sha-256 BC:24:B9:06:97:A6:A8:FA:3C:B3:39:A1:CC:34:E0:D5:36:74:D2:4C:79:17:F4:53:EF:6F:EF:C4:8E:3C:90:2D\r\na=setup:actpass\r\na=candidate:1818443557 1 udp 2113937663 192.168.1.58 10004 typ host generation 0\r\na=ice-options:ice2,trickle\r\na=mid:0\r\na=end-of-candidates\r\na=sctp-port:5000\r\na=max-message-size:262144\r\n";
            string sdpOffer = $"{{\"type\":\"offer\",\"sdp\":\"{sdp}\"}}";
            string contentType = "application/sdp";

            Mock_SIPClient mockSipClient = new Mock_SIPClient();
            PeerConnection_Logs_Method_Calls mockPeerConnection = new PeerConnection_Logs_Method_Calls();

            P2PConnection p2pConnection = new P2PConnection(
                mockSipClient,
                mockPeerConnection,
                NullLoggerFactory.Instance);

            await p2pConnection.Start();

            mockSipClient.ConnectionState = SIPConnectionState.Connected;
            await Task.Delay(10);

            await mockSipClient.ReceiveSIPRequest(SIPMethodsEnum.SERVICE, sdpOffer, contentType, 1);
            await Task.Delay(10);

            Assert.Equal(1, mockPeerConnection.CreateAnswer_Called);
        }

        [Fact]
        public async Task Sets_SDP_Answer()
        {
            string sdp = "v=0\r\no=- 41619 0 IN IP4 127.0.0.1\r\ns=sipsorcery\r\nt=0 0\r\na=group:BUNDLE 0\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\nc=IN IP4 0.0.0.0\r\na=ice-ufrag:FAKC\r\na=ice-pwd:RPGFSYXFXVSKBLSOVZOONAOW\r\na=fingerprint:sha-256 BC:24:B9:06:97:A6:A8:FA:3C:B3:39:A1:CC:34:E0:D5:36:74:D2:4C:79:17:F4:53:EF:6F:EF:C4:8E:3C:90:2D\r\na=setup:actpass\r\na=candidate:1818443557 1 udp 2113937663 192.168.1.58 10004 typ host generation 0\r\na=ice-options:ice2,trickle\r\na=mid:0\r\na=end-of-candidates\r\na=sctp-port:5000\r\na=max-message-size:262144\r\n";
            string sdpOffer = $"{{\"type\":\"offer\",\"sdp\":\"{sdp}\"}}";
            string contentType = "application/sdp";

            Mock_SIPClient mockSipClient = new Mock_SIPClient();
            PeerConnection_Logs_Method_Calls mockPeerConnection = new PeerConnection_Logs_Method_Calls();

            P2PConnection p2pConnection = new P2PConnection(
                mockSipClient,
                mockPeerConnection,
                NullLoggerFactory.Instance);

            await p2pConnection.Start();

            mockSipClient.ConnectionState = SIPConnectionState.Connected;
            await Task.Delay(10);

            await mockSipClient.ReceiveSIPRequest(SIPMethodsEnum.SERVICE, sdpOffer, contentType, 1);
            await Task.Delay(10);

            Assert.Single(mockPeerConnection.SetLocalDescription_Called);
            Assert.Equal(RTCSdpType.answer, mockPeerConnection.SetLocalDescription_Called.Single().type);
        }

        [Fact]
        public async Task Sends_SDP_Answer()
        {
            string sdp = "v=0\r\no=- 41619 0 IN IP4 127.0.0.1\r\ns=sipsorcery\r\nt=0 0\r\na=group:BUNDLE 0\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\nc=IN IP4 0.0.0.0\r\na=ice-ufrag:FAKC\r\na=ice-pwd:RPGFSYXFXVSKBLSOVZOONAOW\r\na=fingerprint:sha-256 BC:24:B9:06:97:A6:A8:FA:3C:B3:39:A1:CC:34:E0:D5:36:74:D2:4C:79:17:F4:53:EF:6F:EF:C4:8E:3C:90:2D\r\na=setup:actpass\r\na=candidate:1818443557 1 udp 2113937663 192.168.1.58 10004 typ host generation 0\r\na=ice-options:ice2,trickle\r\na=mid:0\r\na=end-of-candidates\r\na=sctp-port:5000\r\na=max-message-size:262144\r\n";
            string sdpOffer = $"{{\"type\":\"offer\",\"sdp\":\"{sdp}\"}}";
            string contentType = "application/sdp";

            Mock_SIPClient mockSipClient = new Mock_SIPClient();
            PeerConnection_Logs_Method_Calls mockPeerConnection = new PeerConnection_Logs_Method_Calls();

            P2PConnection p2pConnection = new P2PConnection(
                mockSipClient,
                mockPeerConnection,
                NullLoggerFactory.Instance);

            await p2pConnection.Start();

            mockSipClient.ConnectionState = SIPConnectionState.Connected;
            await Task.Delay(10);

            await mockSipClient.ReceiveSIPRequest(SIPMethodsEnum.SERVICE, sdpOffer, contentType, 1);
            await Task.Delay(10);

            Assert.Single(mockSipClient.SentRequests);
            (SIPMethodsEnum Method, string Message, string ContentType, int Cseq) sdpAnswer = mockSipClient.SentRequests.Single();

            Assert.Equal(SIPMethodsEnum.SERVICE, sdpAnswer.Method);
            Assert.Contains("\"type\":\"answer\",\"sdp\":", sdpAnswer.Message);
            Assert.Equal("application/sdp", sdpAnswer.ContentType);
            Assert.Equal(2, sdpAnswer.Cseq);
        }

        [Fact]
        public async Task Sets_Second_Offer()
        {
            string sdp = "v=0\r\no=- 41619 0 IN IP4 127.0.0.1\r\ns=sipsorcery\r\nt=0 0\r\na=group:BUNDLE 0\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\nc=IN IP4 0.0.0.0\r\na=ice-ufrag:FAKC\r\na=ice-pwd:RPGFSYXFXVSKBLSOVZOONAOW\r\na=fingerprint:sha-256 BC:24:B9:06:97:A6:A8:FA:3C:B3:39:A1:CC:34:E0:D5:36:74:D2:4C:79:17:F4:53:EF:6F:EF:C4:8E:3C:90:2D\r\na=setup:actpass\r\na=candidate:1818443557 1 udp 2113937663 192.168.1.58 10004 typ host generation 0\r\na=ice-options:ice2,trickle\r\na=mid:0\r\na=end-of-candidates\r\na=sctp-port:5000\r\na=max-message-size:262144\r\n";
            string sdpOffer = $"{{\"type\":\"offer\",\"sdp\":\"{sdp}\"}}";
            string contentType = "application/sdp";

            Mock_SIPClient mockSipClient = new Mock_SIPClient();
            PeerConnection_Logs_Method_Calls mockPeerConnection = new PeerConnection_Logs_Method_Calls();

            P2PConnection p2pConnection = new P2PConnection(
                mockSipClient,
                mockPeerConnection,
                NullLoggerFactory.Instance);

            await p2pConnection.Start();

            mockSipClient.ConnectionState = SIPConnectionState.Connected;
            await Task.Delay(10);

            await mockSipClient.ReceiveSIPRequest(SIPMethodsEnum.SERVICE, sdpOffer, contentType, 1);
            await Task.Delay(10);

            Assert.Single(mockPeerConnection.SetRemoteDescription_Called);

            await mockSipClient.ReceiveSIPRequest(SIPMethodsEnum.SERVICE, sdpOffer, contentType, 2);
            await Task.Delay(10);

            Assert.Equal(0, mockPeerConnection.CreateOffer_Called);

            Assert.Equal(2, mockPeerConnection.SetRemoteDescription_Called.Count);
            Assert.All(mockPeerConnection.SetRemoteDescription_Called, (setSdpOffer) =>
            {
                Assert.Equal(sdp, setSdpOffer.sdp);
                Assert.Equal(RTCSdpType.offer, setSdpOffer.type);
            });
        }

        [Fact]
        public async Task Creates_Second_Answer()
        {
            string sdp = "v=0\r\no=- 41619 0 IN IP4 127.0.0.1\r\ns=sipsorcery\r\nt=0 0\r\na=group:BUNDLE 0\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\nc=IN IP4 0.0.0.0\r\na=ice-ufrag:FAKC\r\na=ice-pwd:RPGFSYXFXVSKBLSOVZOONAOW\r\na=fingerprint:sha-256 BC:24:B9:06:97:A6:A8:FA:3C:B3:39:A1:CC:34:E0:D5:36:74:D2:4C:79:17:F4:53:EF:6F:EF:C4:8E:3C:90:2D\r\na=setup:actpass\r\na=candidate:1818443557 1 udp 2113937663 192.168.1.58 10004 typ host generation 0\r\na=ice-options:ice2,trickle\r\na=mid:0\r\na=end-of-candidates\r\na=sctp-port:5000\r\na=max-message-size:262144\r\n";
            string sdpOffer = $"{{\"type\":\"offer\",\"sdp\":\"{sdp}\"}}";
            string contentType = "application/sdp";

            Mock_SIPClient mockSipClient = new Mock_SIPClient();
            PeerConnection_Logs_Method_Calls mockPeerConnection = new PeerConnection_Logs_Method_Calls();

            P2PConnection p2pConnection = new P2PConnection(
                mockSipClient,
                mockPeerConnection,
                NullLoggerFactory.Instance);

            await p2pConnection.Start();

            mockSipClient.ConnectionState = SIPConnectionState.Connected;
            await Task.Delay(10);

            await mockSipClient.ReceiveSIPRequest(SIPMethodsEnum.SERVICE, sdpOffer, contentType, 1);
            await Task.Delay(10);

            Assert.Equal(1, mockPeerConnection.CreateAnswer_Called);

            await mockSipClient.ReceiveSIPRequest(SIPMethodsEnum.SERVICE, sdpOffer, contentType, 2);
            await Task.Delay(10);

            Assert.Equal(2, mockPeerConnection.CreateAnswer_Called);
        }

        [Fact]
        public async Task Sets_Second_SDP_Answer()
        {
            string sdp = "v=0\r\no=- 41619 0 IN IP4 127.0.0.1\r\ns=sipsorcery\r\nt=0 0\r\na=group:BUNDLE 0\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\nc=IN IP4 0.0.0.0\r\na=ice-ufrag:FAKC\r\na=ice-pwd:RPGFSYXFXVSKBLSOVZOONAOW\r\na=fingerprint:sha-256 BC:24:B9:06:97:A6:A8:FA:3C:B3:39:A1:CC:34:E0:D5:36:74:D2:4C:79:17:F4:53:EF:6F:EF:C4:8E:3C:90:2D\r\na=setup:actpass\r\na=candidate:1818443557 1 udp 2113937663 192.168.1.58 10004 typ host generation 0\r\na=ice-options:ice2,trickle\r\na=mid:0\r\na=end-of-candidates\r\na=sctp-port:5000\r\na=max-message-size:262144\r\n";
            string sdpOffer = $"{{\"type\":\"offer\",\"sdp\":\"{sdp}\"}}";
            string contentType = "application/sdp";

            Mock_SIPClient mockSipClient = new Mock_SIPClient();
            PeerConnection_Logs_Method_Calls mockPeerConnection = new PeerConnection_Logs_Method_Calls();

            P2PConnection p2pConnection = new P2PConnection(
                mockSipClient,
                mockPeerConnection,
                NullLoggerFactory.Instance);

            await p2pConnection.Start();

            mockSipClient.ConnectionState = SIPConnectionState.Connected;
            await Task.Delay(10);

            await mockSipClient.ReceiveSIPRequest(SIPMethodsEnum.SERVICE, sdpOffer, contentType, 1);
            await Task.Delay(10);

            Assert.Single(mockPeerConnection.SetLocalDescription_Called);

            await mockSipClient.ReceiveSIPRequest(SIPMethodsEnum.SERVICE, sdpOffer, contentType, 2);
            await Task.Delay(10);

            Assert.Equal(2, mockPeerConnection.SetLocalDescription_Called.Count);
            Assert.All(mockPeerConnection.SetLocalDescription_Called, (setSdp) => { Assert.Equal(RTCSdpType.answer, setSdp.type); });
        }

        [Fact]
        public async Task Sends_Second_SDP_Answer()
        {
            string sdp = "v=0\r\no=- 41619 0 IN IP4 127.0.0.1\r\ns=sipsorcery\r\nt=0 0\r\na=group:BUNDLE 0\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\nc=IN IP4 0.0.0.0\r\na=ice-ufrag:FAKC\r\na=ice-pwd:RPGFSYXFXVSKBLSOVZOONAOW\r\na=fingerprint:sha-256 BC:24:B9:06:97:A6:A8:FA:3C:B3:39:A1:CC:34:E0:D5:36:74:D2:4C:79:17:F4:53:EF:6F:EF:C4:8E:3C:90:2D\r\na=setup:actpass\r\na=candidate:1818443557 1 udp 2113937663 192.168.1.58 10004 typ host generation 0\r\na=ice-options:ice2,trickle\r\na=mid:0\r\na=end-of-candidates\r\na=sctp-port:5000\r\na=max-message-size:262144\r\n";
            string sdpOffer = $"{{\"type\":\"offer\",\"sdp\":\"{sdp}\"}}";
            string contentType = "application/sdp";

            Mock_SIPClient mockSipClient = new Mock_SIPClient();
            PeerConnection_Logs_Method_Calls mockPeerConnection = new PeerConnection_Logs_Method_Calls();

            P2PConnection p2pConnection = new P2PConnection(
                mockSipClient,
                mockPeerConnection,
                NullLoggerFactory.Instance);

            await p2pConnection.Start();

            mockSipClient.ConnectionState = SIPConnectionState.Connected;
            await Task.Delay(10);

            await mockSipClient.ReceiveSIPRequest(SIPMethodsEnum.SERVICE, sdpOffer, contentType, 1);
            await Task.Delay(10);

            Assert.Single(mockSipClient.SentRequests);
            (SIPMethodsEnum Method, string Message, string ContentType, int Cseq) sdpAnswer = mockSipClient.SentRequests.Single();

            await mockSipClient.ReceiveSIPRequest(SIPMethodsEnum.SERVICE, sdpOffer, contentType, 2);
            await Task.Delay(10);

            Assert.Equal(2, mockSipClient.SentRequests.Count);
            (SIPMethodsEnum Method, string Message, string ContentType, int Cseq) secondSdpAnswer = mockSipClient.SentRequests.Last();
            
            Assert.Equal(SIPMethodsEnum.SERVICE, secondSdpAnswer.Method);
            Assert.Contains("\"type\":\"answer\",\"sdp\":", secondSdpAnswer.Message);
            Assert.Equal("application/sdp", sdpAnswer.ContentType);
            Assert.Equal(3, secondSdpAnswer.Cseq);
        }
    }
}
