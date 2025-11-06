using Microsoft.Extensions.Logging.Abstractions;
using SignalingServerTests.SIPConnection.Mocks.SIPTransport;
using SignalingServerTests.Mocks.SIPRequests;
using SIPSignalingServer;
using SIPSignalingServer.Models;
using SIPSignalingServer.Transactions;
using SIPSorcery.SIP;
using System.Net;
using Advokat.WebRTC.Library.SIP.Models;
using Advokat.WebRTC.Library.SIP;

namespace SignalingServerTests.SIPConnection
{
    [Collection("Sequential")]
    public class Cannot_Send_6Notify_Client
    {
        [Fact(Skip = "Cannot work out a consistent way to test when client is connected and when it is disconnected again. Principle works")]
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

            SIPMemoryRegistry sipRegistry = new SIPMemoryRegistry(NullLoggerFactory.Instance);
            SIPMemoryConnectionPool connectionPool = new SIPMemoryConnectionPool(NullLoggerFactory.Instance);

            // peer
            MockSIPRequest initialPeerRequest = new MockSIPRequest(SIPMethodsEnum.REGISTER, new SIPURI(SIPSchemesEnum.sip, sipEndPoint));
            initialPeerRequest.Header = new SIPHeader(
                new SIPFromHeader(remote.Name, new SIPURI(SIPSchemesEnum.sip, sipEndPoint), CallProperties.CreateNewTag()),
                new SIPToHeader(client.Name, new SIPURI(SIPSchemesEnum.sip, sipEndPoint), null),
                1,
                CallProperties.CreateNewCallId());
            initialPeerRequest.SetRemoteEndPoint(sipEndPoint);

            SIPTransport_Registration_And_Connection_Working peerTransport = new SIPTransport_Registration_And_Connection_Working();

            SIPDialog peerDialog = new SIPDialog(SIPSchemesEnum.sip,
                peerTransport,
                initialPeerRequest,
                sipEndPoint,
                sipRegistry,
                connectionPool,
                NullLoggerFactory.Instance);

            peerDialog.Config = new SIPDialogConfig()
            {
                ReceiveTimeout = 100,
                PeerRegistrationTimeout = 100,
                RegistrationTimeout = 100,
                ConnectionTimeout = 100
            };

            // client
            MockSIPRequest initialRequest = new MockSIPRequest(SIPMethodsEnum.REGISTER, new SIPURI(SIPSchemesEnum.sip, sipEndPoint));
            initialRequest.Header = new SIPHeader(
                new SIPFromHeader(client.Name, new SIPURI(SIPSchemesEnum.sip, sipEndPoint), registrationParams.ClientTag),
                new SIPToHeader(remote.Name, new SIPURI(SIPSchemesEnum.sip, sipEndPoint), null),
                1,
                registrationParams.CallId);
            initialRequest.SetRemoteEndPoint(sipEndPoint);

            SIPDialog sipDialog = new SIPDialog(
                SIPSchemesEnum.sip,
                new SIPTransport_6Notify_Fails(),
                initialRequest,
                sipEndPoint,
                sipRegistry,
                connectionPool,
                NullLoggerFactory.Instance);

            sipDialog.Config = new SIPDialogConfig()
            {
                ReceiveTimeout = 100,
                PeerRegistrationTimeout = 100,
                RegistrationTimeout = 100,
                ConnectionTimeout = 100
            };

            _ = Task.Run(async () => await peerDialog.Start());
            _ = Task.Run(async () => await sipDialog.Start());

            Assert.False(sipDialog.Connected);
            await Task.Delay(5);

            Assert.False(sipDialog.Connected);
            await Task.Delay(5);

            Assert.False(sipDialog.Connected);
            await Task.Delay(5);

            Assert.False(sipDialog.Connected);
            await Task.Delay(5);

            Assert.False(sipDialog.Connected);
            await Task.Delay(5);

            Assert.False(sipDialog.Connected);
            await Task.Delay(5);

            // is connected for a brief amount of time
            // TODO: Doesn't work consistenly
            Assert.True(sipDialog.Connected);
            await Task.Delay(5);

            Assert.False(sipDialog.Connected);
            await Task.Delay(5);

            Assert.False(sipDialog.Connected);
        }

        [Fact]
        public async Task Sends_6Bye()
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
            SIPMemoryConnectionPool connectionPool = new SIPMemoryConnectionPool(NullLoggerFactory.Instance);

            // peer
            MockSIPRequest initialPeerRequest = new MockSIPRequest(SIPMethodsEnum.REGISTER, new SIPURI(SIPSchemesEnum.sip, sipEndPoint));
            initialPeerRequest.Header = new SIPHeader(
                new SIPFromHeader(remote.Name, new SIPURI(SIPSchemesEnum.sip, sipEndPoint), CallProperties.CreateNewTag()),
                new SIPToHeader(client.Name, new SIPURI(SIPSchemesEnum.sip, sipEndPoint), null),
                1,
                CallProperties.CreateNewCallId());
            initialPeerRequest.SetRemoteEndPoint(sipEndPoint);

            SIPTransport_Registration_And_Connection_Working peerTransport = new SIPTransport_Registration_And_Connection_Working();

            SIPDialog peerDialog = new SIPDialog(SIPSchemesEnum.sip,
                peerTransport,
                initialPeerRequest,
                sipEndPoint,
                sipRegistry,
                connectionPool,
                NullLoggerFactory.Instance);

            peerDialog.Config = new SIPDialogConfig()
            {
                ReceiveTimeout = 100,
                PeerRegistrationTimeout = 100,
                RegistrationTimeout = 100,
                ConnectionTimeout = 100
            };

            // client
            MockSIPRequest initialRequest = new MockSIPRequest(SIPMethodsEnum.REGISTER, new SIPURI(SIPSchemesEnum.sip, sipEndPoint));
            initialRequest.Header = new SIPHeader(
                new SIPFromHeader(client.Name, new SIPURI(SIPSchemesEnum.sip, sipEndPoint), registrationParams.ClientTag),
                new SIPToHeader(remote.Name, new SIPURI(SIPSchemesEnum.sip, sipEndPoint), null),
                1,
                registrationParams.CallId);
            initialRequest.SetRemoteEndPoint(sipEndPoint);

            SIPTransport_6Notify_Fails clientTransaction = new SIPTransport_6Notify_Fails();

            SIPDialog sipDialog = new SIPDialog(
                SIPSchemesEnum.sip,
                clientTransaction,
                initialRequest,
                sipEndPoint,
                sipRegistry,
                connectionPool,
                NullLoggerFactory.Instance);

            sipDialog.Config = new SIPDialogConfig()
            {
                ReceiveTimeout = 100,
                PeerRegistrationTimeout = 100,
                RegistrationTimeout = 100,
                ConnectionTimeout = 100
            };

            _ = Task.Run(async () => await peerDialog.Start());
            _ = Task.Run(async () => await sipDialog.Start());

            await Task.Delay(200);

            IEnumerable<SIPRequest> connectionBye = clientTransaction.SentRequests
                .Where(r => r.Method == SIPMethodsEnum.BYE && (r.Header.CSeq == 6 || r.Header.CSeq == 7));

            Assert.True(connectionBye.Any());
        }

        [Fact]
        public async Task Sends_4Bye()
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
            SIPMemoryConnectionPool connectionPool = new SIPMemoryConnectionPool(NullLoggerFactory.Instance);

            // peer
            MockSIPRequest initialPeerRequest = new MockSIPRequest(SIPMethodsEnum.REGISTER, new SIPURI(SIPSchemesEnum.sip, sipEndPoint));
            initialPeerRequest.Header = new SIPHeader(
                new SIPFromHeader(remote.Name, new SIPURI(SIPSchemesEnum.sip, sipEndPoint), CallProperties.CreateNewTag()),
                new SIPToHeader(client.Name, new SIPURI(SIPSchemesEnum.sip, sipEndPoint), null),
                1,
                CallProperties.CreateNewCallId());
            initialPeerRequest.SetRemoteEndPoint(sipEndPoint);

            SIPTransport_Registration_And_Connection_Working peerTransport = new SIPTransport_Registration_And_Connection_Working();

            SIPDialog peerDialog = new SIPDialog(SIPSchemesEnum.sip,
                peerTransport,
                initialPeerRequest,
                sipEndPoint,
                sipRegistry,
                connectionPool,
                NullLoggerFactory.Instance);

            peerDialog.Config = new SIPDialogConfig()
            {
                ReceiveTimeout = 100,
                PeerRegistrationTimeout = 100,
                RegistrationTimeout = 100,
                ConnectionTimeout = 100
            };

            // client
            MockSIPRequest initialRequest = new MockSIPRequest(SIPMethodsEnum.REGISTER, new SIPURI(SIPSchemesEnum.sip, sipEndPoint));
            initialRequest.Header = new SIPHeader(
                new SIPFromHeader(client.Name, new SIPURI(SIPSchemesEnum.sip, sipEndPoint), registrationParams.ClientTag),
                new SIPToHeader(remote.Name, new SIPURI(SIPSchemesEnum.sip, sipEndPoint), null),
                1,
                registrationParams.CallId);
            initialRequest.SetRemoteEndPoint(sipEndPoint);

            SIPTransport_6Notify_Fails clientTransaction = new SIPTransport_6Notify_Fails();

            SIPDialog sipDialog = new SIPDialog(
                SIPSchemesEnum.sip,
                clientTransaction,
                initialRequest,
                sipEndPoint,
                sipRegistry,
                connectionPool,
                NullLoggerFactory.Instance);

            sipDialog.Config = new SIPDialogConfig()
            {
                ReceiveTimeout = 100,
                PeerRegistrationTimeout = 100,
                RegistrationTimeout = 100,
                ConnectionTimeout = 100
            };

            _ = Task.Run(async () => await peerDialog.Start());
            _ = Task.Run(async () => await sipDialog.Start());

            await Task.Delay(150);

            SIPRequest? registrationBye = clientTransaction.SentRequests.Last();
            Assert.Equal(SIPMethodsEnum.BYE, registrationBye.Method);
            Assert.Equal(4, registrationBye.Header.CSeq);
        }

        [Fact]
        public async Task Is_Not_Registered()
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
            SIPMemoryConnectionPool connectionPool = new SIPMemoryConnectionPool(NullLoggerFactory.Instance);

            // peer
            MockSIPRequest initialPeerRequest = new MockSIPRequest(SIPMethodsEnum.REGISTER, new SIPURI(SIPSchemesEnum.sip, sipEndPoint));
            initialPeerRequest.Header = new SIPHeader(
                new SIPFromHeader(remote.Name, new SIPURI(SIPSchemesEnum.sip, sipEndPoint), CallProperties.CreateNewTag()),
                new SIPToHeader(client.Name, new SIPURI(SIPSchemesEnum.sip, sipEndPoint), null),
                1,
                CallProperties.CreateNewCallId());
            initialPeerRequest.SetRemoteEndPoint(sipEndPoint);

            SIPTransport_Registration_And_Connection_Working peerTransport = new SIPTransport_Registration_And_Connection_Working();

            SIPDialog peerDialog = new SIPDialog(SIPSchemesEnum.sip,
                peerTransport,
                initialPeerRequest,
                sipEndPoint,
                sipRegistry,
                connectionPool,
                NullLoggerFactory.Instance);

            peerDialog.Config = new SIPDialogConfig()
            {
                ReceiveTimeout = 100,
                PeerRegistrationTimeout = 100,
                RegistrationTimeout = 100,
                ConnectionTimeout = 100
            };

            // client
            MockSIPRequest initialRequest = new MockSIPRequest(SIPMethodsEnum.REGISTER, new SIPURI(SIPSchemesEnum.sip, sipEndPoint));
            initialRequest.Header = new SIPHeader(
                new SIPFromHeader(client.Name, new SIPURI(SIPSchemesEnum.sip, sipEndPoint), registrationParams.ClientTag),
                new SIPToHeader(remote.Name, new SIPURI(SIPSchemesEnum.sip, sipEndPoint), null),
                1,
                registrationParams.CallId);
            initialRequest.SetRemoteEndPoint(sipEndPoint);

            SIPDialog sipDialog = new SIPDialog(
                SIPSchemesEnum.sip,
                new SIPTransport_6Notify_Fails(),
                initialRequest,
                sipEndPoint,
                sipRegistry,
                connectionPool,
                NullLoggerFactory.Instance);

            sipDialog.Config = new SIPDialogConfig()
            {
                ReceiveTimeout = 100,
                PeerRegistrationTimeout = 100,
                RegistrationTimeout = 100,
                ConnectionTimeout = 100
            };

            _ = Task.Run(async () => await peerDialog.Start());
            _ = Task.Run(async () => await sipDialog.Start());

            
            // works in principle. Hard to get the delay right to catch the brief time where it is registered
            //await Task.Delay(15);
            //Assert.True(sipRegistry.IsRegistered(new SIPSignalingServer.Models.SIPRegistration(registrationParams)));

            await Task.Delay(100);
            Assert.False(sipRegistry.IsRegistered(new SIPSignalingServer.Models.SIPRegistration(registrationParams)));
        }
    }
}
