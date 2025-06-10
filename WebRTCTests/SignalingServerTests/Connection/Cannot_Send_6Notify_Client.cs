using Microsoft.Extensions.Logging.Abstractions;
using SignalingServerTests.Connection.Mocks.SIPTransport;
using SignalingServerTests.Mocks.SIPRequests;
using SIPSignalingServer;
using SIPSignalingServer.Models;
using SIPSignalingServer.Transactions;
using SIPSorcery.SIP;
using System.Net;
using WebRTCLibrary.SIP.Models;

namespace SignalingServerTests.Connection
{
    public class Cannot_Send_6Notify_Client
    {
        //[Fact]
        //public async Task Peers_Are_Not_Connected()
        //{
        //    SIPEndPoint sipEndPoint = new SIPEndPoint(IPEndPoint.Parse("1.1.1.1:1"));
        //    SIPParticipant client = new SIPParticipant("caller-12345ab", sipEndPoint);
        //    SIPParticipant remote = new SIPParticipant("remote-fsf1234", sipEndPoint);

        //    ServerSideTransactionParams peerRegistrationParams = new ServerSideTransactionParams(
        //        client,
        //        remote,
        //        callId: CallProperties.CreateNewCallId(),
        //        remoteTag: null,
        //        clientTag: CallProperties.CreateNewTag());

        //    SIPMemoryRegistry sipRegistry = new SIPMemoryRegistry(NullLoggerFactory.Instance);

        //    // register peer
        //    sipRegistry.Register(new SIPRegistration(peerRegistrationParams));
        //    sipRegistry.Confirm(new SIPRegistration(peerRegistrationParams));

        //    SIPMemoryConnectionPool connectionPool = new SIPMemoryConnectionPool(NullLoggerFactory.Instance);
        //    //connectionPool.Connect(new SIPMessageRelay())

        //    MockSIPRequest initialRequest = new MockSIPRequest(SIPMethodsEnum.REGISTER, new SIPURI(SIPSchemesEnum.sip, sipEndPoint));
        //    initialRequest.Header = new SIPHeader(
        //        new SIPFromHeader(client.Name, new SIPURI(SIPSchemesEnum.sip, sipEndPoint), CallProperties.CreateNewTag()),
        //        new SIPToHeader(remote.Name, new SIPURI(SIPSchemesEnum.sip, sipEndPoint), null),
        //        1,
        //        CallProperties.CreateNewCallId());
        //    initialRequest.SetRemoteEndPoint(sipEndPoint);

        //    SIPTransport_4Notify_Fails mockSIPTransport = new SIPTransport_4Notify_Fails();

        //    SIPDialog sipDialog = new SIPDialog(
        //        SIPSchemesEnum.sip,
        //        mockSIPTransport,
        //        initialRequest,
        //        sipEndPoint,
        //        sipRegistry,
        //        connectionPool,
        //        NullLoggerFactory.Instance);

        //    sipDialog.RegistrationTimeout = 100;
        //    sipDialog.ConnectionTimeout = 100;
        //    sipDialog.SendTimeout = 100;
        //    sipDialog.ReceiveTimeout = 100;

        //    _ = Task.Run(sipDialog.Start);
        //}
    }
}
