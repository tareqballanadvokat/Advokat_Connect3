using Advokat.WebRTC.Client.Utils;
using Microsoft.Extensions.Logging.Abstractions;
using SIPClientTests.SDPExchangeTests.Mocks.PeerConnection;
using SIPClientTests.SDPExchangeTests.Mocks.SIPClient;
using WebRTCClient;

namespace SIPClientTests.SDPExchangeTests
{
    [Collection("Sequential")]
    public class Before_SIP_Connecting
    {
        [Fact]
        public async Task Does_Not_Start_Connectivity_Checks()
        {
            Mock_SIPClient mockSipClient = new Mock_SIPClient();
            PeerConnection_Logs_Method_Calls mockPeerConnection = new PeerConnection_Logs_Method_Calls();

            P2PConnection p2pConnection = new P2PConnection(
                mockSipClient,
                mockPeerConnection,
                NullLoggerFactory.Instance);

            await p2pConnection.Start();

            mockSipClient.ConnectionState = SIPConnectionState.Disconnected;
            await Task.Delay(10);

            Assert.Equal(0, mockPeerConnection.StartConnectivityChecksAsync_Called);

            mockSipClient.ConnectionState = SIPConnectionState.Registered;
            await Task.Delay(10);

            Assert.Equal(0, mockPeerConnection.StartConnectivityChecksAsync_Called);
        }
    }
}
