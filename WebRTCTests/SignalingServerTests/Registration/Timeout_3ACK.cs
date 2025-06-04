using Microsoft.Extensions.Logging.Abstractions;
using SignalingServerTests.Registration.Mocks.SIPConnection;
using SIPSignalingServer.Interfaces;
using SIPSignalingServer.Models;
using SIPSignalingServer.Transactions;
using SIPSignalingServer;
using SIPSorcery.SIP;
using System.Net;
using SignalingServerTests.Registration.Mocks.SIPRegistry;
using SignalingServerTests.Mocks.SIPRequests;

namespace SignalingServerTests.Registration
{
    public class Timeout_3ACK
    {
        [Fact]
        public async Task Is_Not_Confirmed()
        {
            SIPConnection_Sends_Requests mockConnection = new SIPConnection_Sends_Requests();
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

            sipRegistrationTransaction.ReceiveTimeout = 100;
            _ = Task.Run(sipRegistrationTransaction.Start);

            await Task.Delay(10);

            // before timeout
            Assert.False(sipRegistrationTransaction.Registered);
            //Assert.False(sipRegistry.IsRegistered(new SIPRegistration(sipRegistrationTransaction.Params)));
            Assert.False(sipRegistry.IsConfirmed(new SIPRegistration(sipRegistrationTransaction.Params)));
        }

        [Fact]
        public async Task Sends_3BYE_After_Timeout()
        {
            SIPConnection_Sends_Requests mockConnection = new SIPConnection_Sends_Requests();
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

            sipRegistrationTransaction.ReceiveTimeout = 100;
            _ = Task.Run(sipRegistrationTransaction.Start);

            await Task.Delay(10);

            // before timeout
            // bye was not sent yet
            Assert.Empty(mockConnection.SentRequests);
            // accepted got sent
            Assert.Single(mockConnection.SentResponses);
            Assert.Equal(SIPResponseStatusCodesEnum.Accepted, mockConnection.SentResponses.Single().statusCode);
            Assert.Equal(2, mockConnection.SentResponses.Single().headerParams.CSeq);

            // wait for timeout
            await Task.Delay(150);

            Assert.Single(mockConnection.SentRequests);
            Assert.Equal(SIPMethodsEnum.BYE, mockConnection.SentRequests.Single().method);
            Assert.Equal(3, mockConnection.SentRequests.Single().headerParams.CSeq);
        }

        [Fact]
        public async Task Is_In_Registry_Before_Bye()
        {
            SIPConnection_Sends_Requests mockConnection = new SIPConnection_Sends_Requests();
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

            sipRegistrationTransaction.ReceiveTimeout = 100;
            _ = Task.Run(sipRegistrationTransaction.Start);

            await Task.Delay(10);

            // before timeout
            Assert.Single(sipRegistry.AddedToRegistry);
            Assert.Empty(sipRegistry.Unregistered);
        }

        [Fact]
        public async Task Is_Unregistered_After_Bye()
        {
            SIPConnection_Sends_Requests mockConnection = new SIPConnection_Sends_Requests();
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

            sipRegistrationTransaction.ReceiveTimeout = 100;
            _ = Task.Run(sipRegistrationTransaction.Start);

            await Task.Delay(10);

            // before timeout
            Assert.Empty(sipRegistry.Unregistered);

            await Task.Delay(150);

            // after bye
            Assert.Single(sipRegistry.Unregistered);
        }


        [Theory]
        [InlineData(100, 1000)]
        [InlineData(100, 500)]
        [InlineData(100, 200)]
        [InlineData(100, 100)]
        [InlineData(100, 10)]
        [InlineData(100, 1)] // generally works. Inconsistent, Fails rarely - too close
        [InlineData(100, 0)]
        [InlineData(1000, 1)] // generally works. Inconsistent, Fails rarely - too close
        [InlineData(1000, 10)]
        [InlineData(1000, 100)]
        [InlineData(1000, 200)]
        [InlineData(1000, 500)]
        public async Task Does_Not_Accept_3ACK_After_Timeout(int messageTimeout, int delayToAck)
        {
            SIPConnection_Sends_3ACK_After_Timeout mockConnection = new SIPConnection_Sends_3ACK_After_Timeout(messageTimeout, delayToAck);
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

            sipRegistrationTransaction.ReceiveTimeout = messageTimeout;
            //_ = Task.Run(sipRegistrationTransaction.Start);
            await sipRegistrationTransaction.Start();
            //await Task.Delay(messageTimeout + 100);

            Assert.Single(sipRegistry.AddedToRegistry);
            Assert.Empty(sipRegistry.Confirmed);
            Assert.Single(sipRegistry.Unregistered);
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
