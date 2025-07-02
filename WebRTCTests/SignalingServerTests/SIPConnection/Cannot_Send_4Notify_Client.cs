using Microsoft.Extensions.Logging.Abstractions;
using SignalingServerTests.SIPConnection.Mocks.SIPRegistrationTransaction;
using SignalingServerTests.SIPConnection.Mocks.SIPRegistry;
using SignalingServerTests.SIPConnection.Mocks.SIPTransport;
using SignalingServerTests.SIPConnection.Mocks.TransactionFactories;
using SignalingServerTests.Mocks.SIPRequests;
using SIPSignalingServer;
using SIPSignalingServer.Models;
using SIPSignalingServer.Transactions;
using SIPSorcery.SIP;
using System.Net;
using WebRTCLibrary.SIP.Models;

namespace SignalingServerTests.SIPConnection
{
    [Collection("Sequential")]
    public class Cannot_Send_4Notify_Client
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
            SIPMemoryConnectionPool connectionPool = new SIPMemoryConnectionPool(NullLoggerFactory.Instance);

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

            Assert.False(sipConnectionTransaction.Connected);
        }

        [Fact]
        public async Task Client_Is_Not_Registered()
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

            SIPMemoryRegistry sipRegistry = new SIPMemoryRegistry(NullLoggerFactory.Instance);
            sipRegistry.Register(new SIPSignalingServer.Models.SIPRegistration(peerRegistrationParams));
            sipRegistry.Confirm(new SIPSignalingServer.Models.SIPRegistration(peerRegistrationParams));

            SIPMemoryConnectionPool connectionPool = new SIPMemoryConnectionPool(NullLoggerFactory.Instance);
            
            MockSIPRequest initialRequest = new MockSIPRequest(SIPMethodsEnum.REGISTER, new SIPURI(SIPSchemesEnum.sip, sipEndPoint));
            initialRequest.Header = new SIPHeader(
                new SIPFromHeader(client.Name, new SIPURI(SIPSchemesEnum.sip, sipEndPoint), CallProperties.CreateNewTag()),
                new SIPToHeader(remote.Name, new SIPURI(SIPSchemesEnum.sip, sipEndPoint), null),
                1,
                CallProperties.CreateNewCallId());
            initialRequest.SetRemoteEndPoint(sipEndPoint);

            initialRequest.Header = new SIPHeader(
                new SIPFromHeader(registrationParams.ClientParticipant.Name, new SIPURI(SIPSchemesEnum.sip, sipEndPoint), registrationParams.ClientTag),
                new SIPToHeader(registrationParams.RemoteParticipant.Name, new SIPURI(SIPSchemesEnum.sip, sipEndPoint), null),
                1,
                registrationParams.CallId);

            SIPTransport_4Notify_Fails sipTransport = new SIPTransport_4Notify_Fails();

            SIPDialog sipDialog = new SIPDialog(
                SIPSchemesEnum.sip,
                sipTransport,
                initialRequest,
                sipEndPoint,
                sipRegistry,
                connectionPool,
                NullLoggerFactory.Instance);

            SIPRegistrationTransaction_Can_Unregister sipRegistrationTransaction = new(initialRequest, sipEndPoint);

            sipDialog.SIPRegistrationTransactionFactory = new Mock_SIPRegistrationTransactionFactory(sipRegistrationTransaction);
            sipDialog.RegistrationTimeout = 100;
            sipDialog.ConnectionTimeout = 100;
            sipDialog.SendTimeout = 100;
            sipDialog.ReceiveTimeout = 100;
            sipDialog.PeerRegistrationTimeout = 200;

            Assert.True(sipRegistrationTransaction.Registered);

            _ = Task.Run(async () => await sipDialog.Start());
            await Task.Delay(300);

            Assert.False(sipRegistrationTransaction.Registered);
        }

        [Fact]
        public async Task Client_Is_Not_In_Registry()
        {
            SIPEndPoint sipEndPoint = new SIPEndPoint(IPEndPoint.Parse("1.1.1.1:1"));
            SIPParticipant client = new SIPParticipant("caller-12345ab", sipEndPoint);
            SIPParticipant remote = new SIPParticipant("remote-fsf1234", sipEndPoint);

            ServerSideTransactionParams peerRegistrationParams = new ServerSideTransactionParams(
                client,
                remote,
                callId: CallProperties.CreateNewCallId(),
                remoteTag: null,
                clientTag: CallProperties.CreateNewTag());

            SIPMemoryRegistry sipRegistry = new SIPMemoryRegistry(NullLoggerFactory.Instance);

            // register peer
            sipRegistry.Register(new SIPSignalingServer.Models.SIPRegistration(peerRegistrationParams));
            sipRegistry.Confirm(new SIPSignalingServer.Models.SIPRegistration(peerRegistrationParams));

            SIPMemoryConnectionPool connectionPool = new SIPMemoryConnectionPool(NullLoggerFactory.Instance);

            MockSIPRequest initialRequest = new MockSIPRequest(SIPMethodsEnum.REGISTER, new SIPURI(SIPSchemesEnum.sip, sipEndPoint));
            initialRequest.Header = new SIPHeader(
                new SIPFromHeader(client.Name, new SIPURI(SIPSchemesEnum.sip, sipEndPoint), CallProperties.CreateNewTag()),
                new SIPToHeader(remote.Name, new SIPURI(SIPSchemesEnum.sip, sipEndPoint), null),
                1,
                CallProperties.CreateNewCallId());
            initialRequest.SetRemoteEndPoint(sipEndPoint);

            SIPTransport_4Notify_Fails mockSIPTransport = new SIPTransport_4Notify_Fails();

            SIPDialog sipDialog = new SIPDialog(
                SIPSchemesEnum.sip,
                mockSIPTransport,
                initialRequest,
                sipEndPoint,
                sipRegistry,
                connectionPool,
                NullLoggerFactory.Instance);

            sipDialog.RegistrationTimeout = 100;
            sipDialog.ConnectionTimeout = 100;
            sipDialog.SendTimeout = 100;
            sipDialog.ReceiveTimeout = 100;

            _ = Task.Run(async () => await sipDialog.Start());
            await Task.Delay(150);

            Assert.False(sipRegistry.IsRegistered(new SIPSignalingServer.Models.SIPRegistration(sipDialog.Params)));
        }

        [Fact]
        public async Task Sends_4Bye()
        {
            SIPEndPoint sipEndPoint = new SIPEndPoint(IPEndPoint.Parse("1.1.1.1:1"));
            SIPParticipant client = new SIPParticipant("caller-12345ab", sipEndPoint);
            SIPParticipant remote = new SIPParticipant("remote-fsf1234", sipEndPoint);

            ServerSideTransactionParams peerRegistrationParams = new ServerSideTransactionParams(
                client,
                remote,
                callId: CallProperties.CreateNewCallId(),
                remoteTag: null,
                clientTag: CallProperties.CreateNewTag());

            SIPMemoryRegistry sipRegistry = new SIPMemoryRegistry(NullLoggerFactory.Instance);

            // register peer
            sipRegistry.Register(new SIPSignalingServer.Models.SIPRegistration(peerRegistrationParams));
            sipRegistry.Confirm(new SIPSignalingServer.Models.SIPRegistration(peerRegistrationParams));

            SIPMemoryConnectionPool connectionPool = new SIPMemoryConnectionPool(NullLoggerFactory.Instance);

            MockSIPRequest initialRequest = new MockSIPRequest(SIPMethodsEnum.REGISTER, new SIPURI(SIPSchemesEnum.sip, sipEndPoint));
            initialRequest.Header = new SIPHeader(
                new SIPFromHeader(client.Name, new SIPURI(SIPSchemesEnum.sip, sipEndPoint), CallProperties.CreateNewTag()),
                new SIPToHeader(remote.Name, new SIPURI(SIPSchemesEnum.sip, sipEndPoint), null),
                1,
                CallProperties.CreateNewCallId());
            initialRequest.SetRemoteEndPoint(sipEndPoint);

            SIPTransport_4Notify_Fails mockSIPTransport = new SIPTransport_4Notify_Fails();

            SIPDialog sipDialog = new SIPDialog(
                SIPSchemesEnum.sip,
                mockSIPTransport,
                initialRequest,
                sipEndPoint,
                sipRegistry,
                connectionPool,
                NullLoggerFactory.Instance);

            sipDialog.RegistrationTimeout = 100;
            sipDialog.ConnectionTimeout = 100;
            sipDialog.SendTimeout = 100;
            sipDialog.ReceiveTimeout = 100;
            sipDialog.PeerRegistrationTimeout = 100;

            _ = Task.Run(async () => await sipDialog.Start());
            await Task.Delay(150);

            // 4 Notify - failed, 4 Bye
            Assert.Equal(2, mockSIPTransport.SentRequests.Count);

            Assert.Equal(SIPMethodsEnum.NOTIFY, mockSIPTransport.SentRequests.First().Method);
            Assert.Equal(SIPMethodsEnum.BYE, mockSIPTransport.SentRequests.Last().Method);
            
            Assert.Equal(4, mockSIPTransport.SentRequests.Last().Header.CSeq);
            Assert.Equal(initialRequest.Header.CallId, mockSIPTransport.SentRequests.Last().Header.CallId);
 
            Assert.Equal(initialRequest.Header.From.FromName, mockSIPTransport.SentRequests.Last().Header.To.ToName);
            Assert.Equal(initialRequest.Header.To.ToName, mockSIPTransport.SentRequests.Last().Header.From.FromName);

            Assert.Equal(initialRequest.Header.From.FromTag, mockSIPTransport.SentRequests.Last().Header.To.ToTag);
            
            // Should be unique tag
            Assert.NotEqual(peerRegistrationParams.ClientTag, mockSIPTransport.SentRequests.Last().Header.From.FromTag);
            Assert.NotEqual(peerRegistrationParams.RemoteTag, mockSIPTransport.SentRequests.Last().Header.From.FromTag);
        }

        [Fact]
        public async Task Does_Not_Send_ConnectionBye()
        {
            SIPEndPoint sipEndPoint = new SIPEndPoint(IPEndPoint.Parse("1.1.1.1:1"));
            SIPParticipant client = new SIPParticipant("caller-12345ab", sipEndPoint);
            SIPParticipant remote = new SIPParticipant("remote-fsf1234", sipEndPoint);

            ServerSideTransactionParams peerRegistrationParams = new ServerSideTransactionParams(
                client,
                remote,
                callId: CallProperties.CreateNewCallId(),
                remoteTag: null,
                clientTag: CallProperties.CreateNewTag());

            SIPMemoryRegistry sipRegistry = new SIPMemoryRegistry(NullLoggerFactory.Instance);

            // register peer
            sipRegistry.Register(new SIPSignalingServer.Models.SIPRegistration(peerRegistrationParams));
            sipRegistry.Confirm(new SIPSignalingServer.Models.SIPRegistration(peerRegistrationParams));

            SIPMemoryConnectionPool connectionPool = new SIPMemoryConnectionPool(NullLoggerFactory.Instance);

            MockSIPRequest initialRequest = new MockSIPRequest(SIPMethodsEnum.REGISTER, new SIPURI(SIPSchemesEnum.sip, sipEndPoint));
            initialRequest.Header = new SIPHeader(
                new SIPFromHeader(client.Name, new SIPURI(SIPSchemesEnum.sip, sipEndPoint), CallProperties.CreateNewTag()),
                new SIPToHeader(remote.Name, new SIPURI(SIPSchemesEnum.sip, sipEndPoint), null),
                1,
                CallProperties.CreateNewCallId());
            initialRequest.SetRemoteEndPoint(sipEndPoint);

            SIPTransport_4Notify_Fails mockSIPTransport = new SIPTransport_4Notify_Fails();

            SIPDialog sipDialog = new SIPDialog(
                SIPSchemesEnum.sip,
                mockSIPTransport,
                initialRequest,
                sipEndPoint,
                sipRegistry,
                connectionPool,
                NullLoggerFactory.Instance);

            sipDialog.RegistrationTimeout = 100;
            sipDialog.ConnectionTimeout = 100;
            sipDialog.SendTimeout = 100;
            sipDialog.ReceiveTimeout = 100;
            sipDialog.PeerRegistrationTimeout = 100;

            _ = Task.Run(async () => await sipDialog.Start());
            await Task.Delay(150);

            IEnumerable<SIPRequest> byeRequests = mockSIPTransport.SentRequests.Where(r => r.Method == SIPMethodsEnum.BYE);

            Assert.False(byeRequests.Where(r => r.Header.CSeq != 4).Any());

            IEnumerable<SIPRequest> notify4Requests = mockSIPTransport.SentRequests
                .Where(r => r.Header.CSeq == 4 && r.Method == SIPMethodsEnum.NOTIFY);

            Assert.NotEmpty(notify4Requests);
        }
    }
}
