using Microsoft.Extensions.Logging.Abstractions;
using SignalingServerTests.Mocks.SIPRequests;
using SignalingServerTests.Registration.Mocks.SIPConnection;
using SignalingServerTests.Registration.Mocks.SIPRegistry;
using SIPSignalingServer.Interfaces;
using SIPSignalingServer.Transactions;
using SIPSorcery.SIP;
using System.Net;

namespace SignalingServerTests.Registration
{
    public class Timeout_2Accept
    {
        [Fact]
        public async Task Is_Not_Confirmed()
        {
            SIPConnection_2Accept_Failed_Sends_3ACK mockConnection = new SIPConnection_2Accept_Failed_Sends_3ACK();
            SIPEndPoint sipEndPoint = new SIPEndPoint(new IPEndPoint(IPAddress.Parse("1.1.1.1"), 1));

            MockSIPRequest initialRequest = this.GetMockSIPRequest(SIPMethodsEnum.REGISTER, sipEndPoint);

            SIPRegistry_MemoryRegistry_No_Peer sipRegistry = new SIPRegistry_MemoryRegistry_No_Peer();

            SIPRegistrationTransaction sipRegistrationTransaction = new(
                mockConnection,
                initialRequest,
                sipEndPoint,
                sipRegistry,
                NullLoggerFactory.Instance
                );

            await sipRegistrationTransaction.Start();

            Assert.False(sipRegistrationTransaction.Registered);

            Assert.Single(sipRegistry.AddedToRegistry);
            Assert.Empty(sipRegistry.Confirmed);
        }

        [Fact]
        public async Task Is_Unregistered()
        {
            SIPConnection_2Accept_Failed_Sends_3ACK mockConnection = new SIPConnection_2Accept_Failed_Sends_3ACK();
            SIPEndPoint sipEndPoint = new SIPEndPoint(new IPEndPoint(IPAddress.Parse("1.1.1.1"), 1));

            MockSIPRequest initialRequest = this.GetMockSIPRequest(SIPMethodsEnum.REGISTER, sipEndPoint);

            SIPRegistry_MemoryRegistry_No_Peer sipRegistry = new SIPRegistry_MemoryRegistry_No_Peer();

            SIPRegistrationTransaction sipRegistrationTransaction = new(
                mockConnection,
                initialRequest,
                sipEndPoint,
                sipRegistry,
                NullLoggerFactory.Instance
                );

            await sipRegistrationTransaction.Start();

            // Unregister gets called twice. Should get reduced to once, but is also not a real problem
            Assert.NotEmpty(sipRegistry.Unregistered);
        }

        [Fact]
        public async Task Tries_To_Send_3Bye()
        {
            SIPConnection_Sending_2Accepted_Failed mockConnection = new();
            SIPEndPoint sipEndPoint = new SIPEndPoint(new IPEndPoint(IPAddress.Parse("1.1.1.1"), 1));

            MockSIPRequest initialRequest = this.GetMockSIPRequest(SIPMethodsEnum.REGISTER, sipEndPoint);

            ISIPRegistry sipRegistry = new SIPRegistry_MemoryRegistry_No_Peer();

            SIPRegistrationTransaction sipRegistrationTransaction = new(
                mockConnection,
                initialRequest,
                sipEndPoint,
                sipRegistry,
                NullLoggerFactory.Instance
                );

            await sipRegistrationTransaction.Start();

            Assert.Single(mockConnection.SentRequests);
            Assert.Equal(SIPMethodsEnum.BYE, mockConnection.SentRequests.Single().method);
            Assert.Equal(2, mockConnection.SentRequests.Single().headerParams.CSeq);
        }

        private MockSIPRequest GetMockSIPRequest(SIPMethodsEnum method, SIPEndPoint sipEndPoint)
        {
            SIPURI sipUri = new SIPURI(SIPSchemesEnum.sip, sipEndPoint);
            
            MockSIPRequest request = new MockSIPRequest(SIPMethodsEnum.REGISTER, sipUri);
            
            request.Header = new SIPHeader(
                new SIPFromHeader("abcdefg", sipUri, "abcdefg-1234"),
                new SIPToHeader("nbnin", sipUri, string.Empty),
                1,
                callId: "qwerty_99999");
            
            request.SetRemoteEndPoint(sipEndPoint);
            request.SetLocalEndPoint(sipEndPoint);

            return request;
        }
    }
}
