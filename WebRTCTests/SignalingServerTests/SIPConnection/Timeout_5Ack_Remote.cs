using Microsoft.Extensions.Logging.Abstractions;
using SignalingServerTests.Mocks.SIPRequests;
using SignalingServerTests.SIPConnection.Mocks.SIPTransport;
using SIPSignalingServer;
using SIPSignalingServer.Models;
using SIPSignalingServer.Transactions;
using SIPSorcery.SIP;
using System.Net;
using WebRTCLibrary.SIP.Models;

namespace SignalingServerTests.SIPConnection
{
    [Collection("Sequential")]
    public class Timeout_5Ack_Remote
    {
        [Fact]
        public async Task Sends_6Bye_After_ReciveTimeout()
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

            peerDialog.RegistrationTimeout = 1000;
            peerDialog.ConnectionTimeout = 1000;
            peerDialog.SendTimeout = 1000;
            peerDialog.ReceiveTimeout = 1000;
            peerDialog.PeerRegistrationTimeout = 1000;

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
                new SIPTransport_No_5Ack(),
                initialRequest,
                sipEndPoint,
                sipRegistry,
                connectionPool,
                NullLoggerFactory.Instance);

            sipDialog.RegistrationTimeout = 1000;
            sipDialog.ConnectionTimeout = 1000;
            sipDialog.SendTimeout = 1000;
            sipDialog.PeerRegistrationTimeout = 1000;
            sipDialog.ReceiveTimeout = 100; // this is the important timeout

            _ = Task.Run(async () => await peerDialog.Start());
            _ = Task.Run(async () => await sipDialog.Start());

            await Task.Delay(50);
            Assert.Single(peerTransport.SentRequests);
            Assert.Equal(SIPMethodsEnum.NOTIFY, peerTransport.SentRequests[0].Method);

            await Task.Delay(100);

            Assert.Equal(2, peerTransport.SentRequests.Count);
            Assert.Equal(SIPMethodsEnum.NOTIFY, peerTransport.SentRequests[0].Method);
            Assert.Equal(SIPMethodsEnum.BYE, peerTransport.SentRequests[1].Method);
            Assert.Equal(6, peerTransport.SentRequests[1].Header.CSeq);

            await Task.Delay(1100);

            Assert.Equal(3, peerTransport.SentRequests.Count);
            Assert.Equal(SIPMethodsEnum.BYE, peerTransport.SentRequests[2].Method);
        }

        //[Fact]
        //public async Task Sends_6Bye_After_ConnectionTimeout()
        //{
        //    SIPEndPoint sipEndPoint = new SIPEndPoint(IPEndPoint.Parse("1.1.1.1:1"));
        //    SIPParticipant client = new SIPParticipant("caller-12345ab", sipEndPoint);
        //    SIPParticipant remote = new SIPParticipant("remote-fsf1234", sipEndPoint);

        //    ServerSideTransactionParams registrationParams = new ServerSideTransactionParams(
        //        remote,
        //        client,
        //        callId: CallProperties.CreateNewCallId(),
        //        remoteTag: null,
        //        clientTag: CallProperties.CreateNewTag());

        //    ServerSideTransactionParams peerRegistrationParams = new ServerSideTransactionParams(
        //        client,
        //        remote,
        //        callId: CallProperties.CreateNewCallId(),
        //        remoteTag: null,
        //        clientTag: CallProperties.CreateNewTag());

        //    SIPMemoryRegistry sipRegistry = new SIPMemoryRegistry(NullLoggerFactory.Instance);
        //    SIPMemoryConnectionPool connectionPool = new SIPMemoryConnectionPool(NullLoggerFactory.Instance);

        //    // peer
        //    MockSIPRequest initialPeerRequest = new MockSIPRequest(SIPMethodsEnum.REGISTER, new SIPURI(SIPSchemesEnum.sip, sipEndPoint));
        //    initialPeerRequest.Header = new SIPHeader(
        //        new SIPFromHeader(remote.Name, new SIPURI(SIPSchemesEnum.sip, sipEndPoint), CallProperties.CreateNewTag()),
        //        new SIPToHeader(client.Name, new SIPURI(SIPSchemesEnum.sip, sipEndPoint), null),
        //        1,
        //        CallProperties.CreateNewCallId());
        //    initialPeerRequest.SetRemoteEndPoint(sipEndPoint);

        //    SIPTransport_Registration_And_Connection_Working peerTransport = new SIPTransport_Registration_And_Connection_Working();

        //    SIPDialog peerDialog = new SIPDialog(SIPSchemesEnum.sip,
        //        peerTransport,
        //        initialPeerRequest,
        //        sipEndPoint,
        //        sipRegistry,
        //        connectionPool,
        //        NullLoggerFactory.Instance);

        //    peerDialog.RegistrationTimeout = 1000;
        //    peerDialog.ConnectionTimeout = 1000;
        //    peerDialog.SendTimeout = 1000;
        //    peerDialog.ReceiveTimeout = 1000;
        //    peerDialog.PeerRegistrationTimeout = 1000;

        //    // client
        //    MockSIPRequest initialRequest = new MockSIPRequest(SIPMethodsEnum.REGISTER, new SIPURI(SIPSchemesEnum.sip, sipEndPoint));
        //    initialRequest.Header = new SIPHeader(
        //        new SIPFromHeader(client.Name, new SIPURI(SIPSchemesEnum.sip, sipEndPoint), registrationParams.ClientTag),
        //        new SIPToHeader(remote.Name, new SIPURI(SIPSchemesEnum.sip, sipEndPoint), null),
        //        1,
        //        registrationParams.CallId);
        //    initialRequest.SetRemoteEndPoint(sipEndPoint);

        //    SIPDialog sipDialog = new SIPDialog(
        //        SIPSchemesEnum.sip,
        //        new SIPTransport_No_5Ack(),
        //        initialRequest,
        //        sipEndPoint,
        //        sipRegistry,
        //        connectionPool,
        //        NullLoggerFactory.Instance);

        //    sipDialog.RegistrationTimeout = 1000;
        //    sipDialog.ConnectionTimeout = 100;
        //    sipDialog.SendTimeout = 1000;
        //    sipDialog.PeerRegistrationTimeout = 1000;
        //    sipDialog.ReceiveTimeout = 1000; // this is the important timeout

        //    _ = Task.Run(async () => await peerDialog.Start());
        //    _ = Task.Run(async () => await sipDialog.Start());

        //    await Task.Delay(50);
        //    Assert.Single(peerTransport.SentRequests);
        //    Assert.Equal(SIPMethodsEnum.NOTIFY, peerTransport.SentRequests[0].Method);

        //    await Task.Delay(100);

        //    Assert.Equal(2, peerTransport.SentRequests.Count);
        //    Assert.Equal(SIPMethodsEnum.NOTIFY, peerTransport.SentRequests[0].Method);
        //    Assert.Equal(SIPMethodsEnum.BYE, peerTransport.SentRequests[1].Method);
        //    Assert.Equal(6, peerTransport.SentRequests[1].Header.CSeq);

        //    await Task.Delay(1100);

        //    Assert.Equal(3, peerTransport.SentRequests.Count);
        //    Assert.Equal(SIPMethodsEnum.BYE, peerTransport.SentRequests[2].Method);
        //}

        [Fact]
        public async Task Does_Not_Send_6Notify()
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

            peerDialog.RegistrationTimeout = 100;
            peerDialog.ConnectionTimeout = 200;
            peerDialog.SendTimeout = 100;
            peerDialog.ReceiveTimeout = 100;
            peerDialog.PeerRegistrationTimeout = 200;

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
                new SIPTransport_No_5Ack(),
                initialRequest,
                sipEndPoint,
                sipRegistry,
                connectionPool,
                NullLoggerFactory.Instance);

            sipDialog.RegistrationTimeout = 100;
            sipDialog.ConnectionTimeout = 200;
            sipDialog.SendTimeout = 100;
            sipDialog.PeerRegistrationTimeout = 200;
            sipDialog.ReceiveTimeout = 100;

            _ = Task.Run(async () => await peerDialog.Start());
            _ = Task.Run(async () => await sipDialog.Start());

            await Task.Delay(600); // max time it should take is 300ms (100 registration, 100 wait for peer, 100 connection) - still fails sometimes with 400... TODO: fix


            // TODO: This sometimes only sends two requests - find out why
            // it's (4 Notify + 4 bye...)???
            Assert.Equal(3, peerTransport.SentRequests.Count);
            Assert.Equal(SIPMethodsEnum.NOTIFY, peerTransport.SentRequests[0].Method);
            Assert.Equal(4, peerTransport.SentRequests[0].Header.CSeq);

            Assert.Equal(SIPMethodsEnum.BYE, peerTransport.SentRequests[1].Method);
            Assert.Equal(SIPMethodsEnum.BYE, peerTransport.SentRequests[2].Method);
        }

        [Fact]
        public async Task Remote_Is_Not_Connected()
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

            peerDialog.RegistrationTimeout = 100;
            peerDialog.ConnectionTimeout = 100;
            peerDialog.SendTimeout = 100;
            peerDialog.ReceiveTimeout = 100;
            peerDialog.PeerRegistrationTimeout = 100;

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
                new SIPTransport_No_5Ack(),
                initialRequest,
                sipEndPoint,
                sipRegistry,
                connectionPool,
                NullLoggerFactory.Instance);

            sipDialog.RegistrationTimeout = 100;
            sipDialog.ConnectionTimeout = 100;
            sipDialog.SendTimeout = 100;
            sipDialog.PeerRegistrationTimeout = 100;
            sipDialog.ReceiveTimeout = 100;

            _ = Task.Run(async () => await peerDialog.Start());
            _ = Task.Run(async () => await sipDialog.Start());

            Assert.False(peerDialog.Connected);
            await Task.Delay(50);

            Assert.False(peerDialog.Connected);
            await Task.Delay(50);

            Assert.False(peerDialog.Connected);
            await Task.Delay(50);

            Assert.False(peerDialog.Connected);
            await Task.Delay(50);

            Assert.False(peerDialog.Connected);
            await Task.Delay(200);

            Assert.False(peerDialog.Connected);
        }

        [Fact]
        public async Task Uregisters_After_PeerRegistrationTimeout()
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

            peerDialog.RegistrationTimeout = 100;
            peerDialog.ConnectionTimeout = 1000;
            peerDialog.SendTimeout = 1000;

            // these are the important timeouts
            peerDialog.ReceiveTimeout = 100;
            peerDialog.PeerRegistrationTimeout = 500;

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
                new SIPTransport_No_5Ack(),
                initialRequest,
                sipEndPoint,
                sipRegistry,
                connectionPool,
                NullLoggerFactory.Instance);

            sipDialog.RegistrationTimeout = 100;
            sipDialog.ConnectionTimeout = 100;
            sipDialog.SendTimeout = 100;
            sipDialog.PeerRegistrationTimeout = 100;
            sipDialog.ReceiveTimeout = 100;

            _ = Task.Run(async () => await peerDialog.Start());
            _ = Task.Run(async () => await sipDialog.Start());

            await Task.Delay(50);
            SIPSignalingServer.Models.SIPRegistration registration = new(peerDialog.Params);

            Assert.True(sipRegistry.IsRegistered(registration));

            await Task.Delay(100);
            // still registered - after connection timeout
            Assert.True(sipRegistry.IsRegistered(registration));

            await Task.Delay(100);
            // still registered - PeerRegistrationTimeout not yet triggered for peerDialog
            Assert.True(sipRegistry.IsRegistered(registration));

            await Task.Delay(300);
            // PeerRegistrationTimeout triggered for peerDialog
            Assert.False(sipRegistry.IsRegistered(registration));
        }
    }
}
