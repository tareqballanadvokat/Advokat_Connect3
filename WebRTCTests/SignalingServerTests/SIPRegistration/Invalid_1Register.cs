using Microsoft.Extensions.Logging.Abstractions;
using SignalingServerTests.SIPRegistration.Mocks.SIPConnection;
using SignalingServerTests.SIPRegistration.Mocks.SIPRegistry;
using SIPSignalingServer;
using SIPSignalingServer.Interfaces;
using SIPSignalingServer.Transactions;
using SIPSorcery.SIP;
using System.Net;
using WebRTCLibrary.SIP.Models;
using WebRTCLibrary.SIP.Utils;

namespace SignalingServerTests.SIPRegistration
{
    [Collection("Sequential")]
    public class Invalid_1Register
    {
        [Theory]
        [InlineData(SIPMethodsEnum.NONE)]
        [InlineData(SIPMethodsEnum.UNKNOWN)]
        // SIPMethodsEnum.REGISTER would be here
        [InlineData(SIPMethodsEnum.INVITE)]
        [InlineData(SIPMethodsEnum.BYE)]
        [InlineData(SIPMethodsEnum.ACK)]
        [InlineData(SIPMethodsEnum.CANCEL)]
        [InlineData(SIPMethodsEnum.OPTIONS)]
        [InlineData(SIPMethodsEnum.INFO)]
        [InlineData(SIPMethodsEnum.NOTIFY)]
        [InlineData(SIPMethodsEnum.SUBSCRIBE)]
        [InlineData(SIPMethodsEnum.PUBLISH)]
        [InlineData(SIPMethodsEnum.PING)]
        [InlineData(SIPMethodsEnum.REFER)]
        [InlineData(SIPMethodsEnum.MESSAGE)]
        [InlineData(SIPMethodsEnum.PRACK)]
        [InlineData(SIPMethodsEnum.UPDATE)]
        [InlineData(SIPMethodsEnum.SERVICE)]
        public async Task Is_Not_Registered(SIPMethodsEnum method)
        {
            SIPConnection_Sends_Requests mockConnection = new SIPConnection_Sends_Requests();

            SIPEndPoint sipEndPoint = new SIPEndPoint(new IPEndPoint(IPAddress.Parse("1.1.1.1"), 1));
            
            SIPParticipant participant = new(string.Empty, sipEndPoint);
            SIPHeaderParams sipHeaderParams = new SIPHeaderParams(participant, participant);
            SIPRequest invalidRequest = SIPHelper.GetRequest(SIPSchemesEnum.sip, method, sipHeaderParams);

            ISIPRegistry sipRegistry = new SIPRegistry_Can_Ungerigster();

            SIPRegistrationTransaction sipRegistrationTransaction = new(
                mockConnection,
                invalidRequest,
                sipEndPoint,
                sipRegistry,
                NullLoggerFactory.Instance
                );

            // throws NotImplementedException when sipRegistry gets called on any method
            await sipRegistrationTransaction.Start();
        }

        [Fact]
        public async Task Sends_2Bye()
        {
            SIPConnection_Sends_Requests mockConnection = new SIPConnection_Sends_Requests();

            SIPEndPoint sipEndPoint = new SIPEndPoint(new IPEndPoint(IPAddress.Parse("1.1.1.1"), 1));

            SIPParticipant participant = new(string.Empty, sipEndPoint);
            SIPHeaderParams sipHeaderParams = new SIPHeaderParams(participant, participant);
            SIPRequest invalidRequest = SIPHelper.GetRequest(SIPSchemesEnum.sip, SIPMethodsEnum.NONE, sipHeaderParams);

            ISIPRegistry sipRegistry = new SIPRegistry_Can_Ungerigster();

            SIPRegistrationTransaction sipRegistrationTransaction = new(
                mockConnection,
                invalidRequest,
                sipEndPoint,
                sipRegistry,
                NullLoggerFactory.Instance
                );

            await sipRegistrationTransaction.Start();

            Assert.Single(mockConnection.SentRequests);

            Assert.Equal(SIPMethodsEnum.BYE, mockConnection.SentRequests.Single().method);
            Assert.Equal(2, mockConnection.SentRequests.Single().headerParams.CSeq);
        }
    }
}
