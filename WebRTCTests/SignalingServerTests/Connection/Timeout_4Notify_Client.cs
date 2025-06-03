using Microsoft.Extensions.Logging.Abstractions;
using SignalingServerTests.Connection.Mocks.SIPRegistry;
using SignalingServerTests.Connection.Mocks.SIPTransport;
using SIPSignalingServer;
using SIPSignalingServer.Models;
using SIPSignalingServer.Transactions;
using SIPSorcery.SIP;
using System.Net;
using WebRTCLibrary.SIP.Models;

namespace SignalingServerTests.Connection
{
    public class Timeout_4Notify_Client
    {
        [Fact]
        public async Task Client_Is_Not_Connected()
        {
            SIPEndPoint sipEndPoint = new SIPEndPoint(IPEndPoint.Parse("1.1.1.1:1"));
            SIPParticipant client = new SIPParticipant("caller-12345ab", sipEndPoint);
            SIPParticipant remote = new SIPParticipant("remote-fsf1234", sipEndPoint);

            ServerSideTransactionParams registrationParams = new ServerSideTransactionParams(
                remote,
                client,
                callId: CallProperties.CreateNewCallId(),
                remoteTag: null,
                clientTag: CallProperties.CreateNewTag());

            ServerSideTransactionParams peerRegistrationParams = new ServerSideTransactionParams(
                client,
                remote,
                callId: CallProperties.CreateNewCallId(),
                remoteTag: null,
                clientTag: CallProperties.CreateNewTag());

            SIPRegistry_Is_Registered sipRegistration = new SIPRegistry_Is_Registered(peerRegistrationParams);
            SIPConnectionPool connectionPool = new SIPConnectionPool(NullLoggerFactory.Instance);


            SIPConnectionTransaction sipConnectionTransaction = new SIPConnectionTransaction(
                SIPSchemesEnum.sip,
                new SIPTransport_Sending_Fails(),
                registrationParams,
                sipRegistration,
                connectionPool,
                NullLoggerFactory.Instance);

            sipConnectionTransaction.SendTimeout = 100;
            sipConnectionTransaction.ReceiveTimeout = 100;

            await sipConnectionTransaction.Start();

            Assert.False(sipConnectionTransaction.IsConnected());
            //Assert.False(connectionPool.)
        }
    }
}
