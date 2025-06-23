using Microsoft.Extensions.Logging.Abstractions;
using SignalingServerTests.SIPConnection.Mocks.SIPRegistrationTransaction;
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
    public class Timeout_5Ack_Client
    {
        [Fact]
        public async Task Client_Is_Not_Connected()
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

            SIPTransport_No_5Ack mockSIPTransport = new SIPTransport_No_5Ack();

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

            await sipDialog.Start();
            Assert.False(sipDialog.Connected);
        }

        // TODO: Check connectionPool. Make subclass and look inside. Create Interface?

        [Fact]
        public async Task Client_Is_Not_Registered()
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

            SIPTransport_No_5Ack mockSIPTransport = new SIPTransport_No_5Ack();

            SIPDialog sipDialog = new SIPDialog(
                SIPSchemesEnum.sip,
                mockSIPTransport,
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

            Assert.True(sipRegistrationTransaction.Registered);

            await sipDialog.Start();
            await Task.Delay(100); // TODO: get it to the point so we can remove this (using events instead of waitForAsync)

            // Unregister of registrationTransaction gets called.
            Assert.False(sipRegistrationTransaction.Registered);
        }

        [Fact]
        public async Task Client_Is_Not_In_Registry()
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

            // register peer
            sipRegistry.Register(new SIPSignalingServer.Models.SIPRegistration(peerRegistrationParams));
            sipRegistry.Confirm(new SIPSignalingServer.Models.SIPRegistration(peerRegistrationParams));

            SIPMemoryConnectionPool connectionPool = new SIPMemoryConnectionPool(NullLoggerFactory.Instance);

            MockSIPRequest initialRequest = new MockSIPRequest(SIPMethodsEnum.REGISTER, new SIPURI(SIPSchemesEnum.sip, sipEndPoint));
            initialRequest.Header = new SIPHeader(
                new SIPFromHeader(registrationParams.ClientParticipant.Name, new SIPURI(SIPSchemesEnum.sip, sipEndPoint), registrationParams.ClientTag),
                new SIPToHeader(registrationParams.RemoteParticipant.Name, new SIPURI(SIPSchemesEnum.sip, sipEndPoint), null),
                1,
                registrationParams.CallId);
            initialRequest.SetRemoteEndPoint(sipEndPoint);

            SIPTransport_No_5Ack mockSIPTransport = new SIPTransport_No_5Ack();

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

            // timeout needs to be triggered for bye and removal of registry
            // cutoff thime seems to be between 115 and 120
            await Task.Delay(150);

            Assert.False(sipRegistry.IsRegistered(new SIPSignalingServer.Models.SIPRegistration(registrationParams)));
        }

        [Fact]
        public async Task Sends_5BYE_Connection()
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

            // register peer
            sipRegistry.Register(new SIPSignalingServer.Models.SIPRegistration(peerRegistrationParams));
            sipRegistry.Confirm(new SIPSignalingServer.Models.SIPRegistration(peerRegistrationParams));

            SIPMemoryConnectionPool connectionPool = new SIPMemoryConnectionPool(NullLoggerFactory.Instance);

            MockSIPRequest initialRequest = new MockSIPRequest(SIPMethodsEnum.REGISTER, new SIPURI(SIPSchemesEnum.sip, sipEndPoint));
            initialRequest.Header = new SIPHeader(
                new SIPFromHeader(registrationParams.ClientParticipant.Name, new SIPURI(SIPSchemesEnum.sip, sipEndPoint), registrationParams.ClientTag),
                new SIPToHeader(registrationParams.RemoteParticipant.Name, new SIPURI(SIPSchemesEnum.sip, sipEndPoint), null),
                1,
                registrationParams.CallId);
            initialRequest.SetRemoteEndPoint(sipEndPoint);

            SIPTransport_No_5Ack mockSIPTransport = new SIPTransport_No_5Ack();

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

            Assert.Equal(3, mockSIPTransport.SentRequests.Count);

            SIPRequest notify4 = mockSIPTransport.SentRequests[0];
            SIPRequest bye5 = mockSIPTransport.SentRequests[1];


            Assert.Equal(SIPMethodsEnum.NOTIFY, notify4.Method);
            Assert.Equal(SIPMethodsEnum.BYE,bye5.Method);

            Assert.Equal(5, bye5.Header.CSeq);

            // Should have unique callId for connection
            Assert.NotEqual(initialRequest.Header.CallId,bye5.Header.CallId);
            // Should be same as Notify
            Assert.Equal(notify4.Header.CallId, bye5.Header.CallId);

            Assert.Equal(initialRequest.Header.From.FromName, bye5.Header.To.ToName);
            Assert.Equal(initialRequest.Header.To.ToName, bye5.Header.From.FromName);

            Assert.Equal(initialRequest.Header.From.FromTag, bye5.Header.To.ToTag);
            Assert.Equal(notify4.Header.To.ToTag, bye5.Header.To.ToTag);

            Assert.Equal(peerRegistrationParams.ClientTag, bye5.Header.From.FromTag);
            Assert.Equal(notify4.Header.From.FromTag, bye5.Header.From.FromTag);

            SIPResponse accepted2 = mockSIPTransport.SentResponses[0];
            Assert.NotEqual(accepted2.Header.From.FromTag, bye5.Header.From.FromTag);
        }

        [Fact]
        public async Task Sends_4BYE_Registration()
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

            // register peer
            sipRegistry.Register(new SIPSignalingServer.Models.SIPRegistration(peerRegistrationParams));
            sipRegistry.Confirm(new SIPSignalingServer.Models.SIPRegistration(peerRegistrationParams));

            SIPMemoryConnectionPool connectionPool = new SIPMemoryConnectionPool(NullLoggerFactory.Instance);

            MockSIPRequest initialRequest = new MockSIPRequest(SIPMethodsEnum.REGISTER, new SIPURI(SIPSchemesEnum.sip, sipEndPoint));
            initialRequest.Header = new SIPHeader(
                new SIPFromHeader(registrationParams.ClientParticipant.Name, new SIPURI(SIPSchemesEnum.sip, sipEndPoint), registrationParams.ClientTag),
                new SIPToHeader(registrationParams.RemoteParticipant.Name, new SIPURI(SIPSchemesEnum.sip, sipEndPoint), null),
                1,
                registrationParams.CallId);
            initialRequest.SetRemoteEndPoint(sipEndPoint);

            SIPTransport_No_5Ack mockSIPTransport = new SIPTransport_No_5Ack();

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

            Assert.Equal(3, mockSIPTransport.SentRequests.Count);

            SIPRequest notify4 = mockSIPTransport.SentRequests[0];
            SIPRequest bye4 = mockSIPTransport.SentRequests[2];


            Assert.Equal(SIPMethodsEnum.NOTIFY, notify4.Method);
            Assert.Equal(SIPMethodsEnum.BYE, bye4.Method);

            Assert.Equal(4, bye4.Header.CSeq);

            Assert.Equal(initialRequest.Header.CallId, bye4.Header.CallId);
            Assert.NotEqual(notify4.Header.CallId, bye4.Header.CallId);

            Assert.Equal(initialRequest.Header.From.FromName, bye4.Header.To.ToName);
            Assert.Equal(initialRequest.Header.To.ToName, bye4.Header.From.FromName);

            Assert.Equal(initialRequest.Header.From.FromTag, bye4.Header.To.ToTag);

            Assert.NotEqual(peerRegistrationParams.ClientTag, bye4.Header.To.ToTag);
            Assert.NotEqual(peerRegistrationParams.RemoteTag, bye4.Header.To.ToTag);
            Assert.Equal(notify4.Header.To.ToTag, bye4.Header.To.ToTag);
            Assert.Equal(registrationParams.ClientTag, bye4.Header.To.ToTag);

            Assert.NotEqual(peerRegistrationParams.ClientTag, bye4.Header.From.FromTag);
            Assert.NotEqual(peerRegistrationParams.RemoteTag, bye4.Header.From.FromTag);
            Assert.NotEqual(notify4.Header.From.FromTag, bye4.Header.From.FromTag);

            SIPResponse accepted2 = mockSIPTransport.SentResponses[0];
            Assert.Equal(accepted2.Header.From.FromTag, bye4.Header.From.FromTag);
        }

        [Fact]
        public async Task Sends_4BYE_Registration_After_ReceiveTimeout()
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

            // register peer
            sipRegistry.Register(new SIPSignalingServer.Models.SIPRegistration(peerRegistrationParams));
            sipRegistry.Confirm(new SIPSignalingServer.Models.SIPRegistration(peerRegistrationParams));

            SIPMemoryConnectionPool connectionPool = new SIPMemoryConnectionPool(NullLoggerFactory.Instance);

            MockSIPRequest initialRequest = new MockSIPRequest(SIPMethodsEnum.REGISTER, new SIPURI(SIPSchemesEnum.sip, sipEndPoint));
            initialRequest.Header = new SIPHeader(
                new SIPFromHeader(registrationParams.ClientParticipant.Name, new SIPURI(SIPSchemesEnum.sip, sipEndPoint), registrationParams.ClientTag),
                new SIPToHeader(registrationParams.RemoteParticipant.Name, new SIPURI(SIPSchemesEnum.sip, sipEndPoint), null),
                1,
                registrationParams.CallId);
            initialRequest.SetRemoteEndPoint(sipEndPoint);

            SIPTransport_No_5Ack mockSIPTransport = new SIPTransport_No_5Ack();

            SIPDialog sipDialog = new SIPDialog(
                SIPSchemesEnum.sip,
                mockSIPTransport,
                initialRequest,
                sipEndPoint,
                sipRegistry,
                connectionPool,
                NullLoggerFactory.Instance);

            sipDialog.RegistrationTimeout = 10000;
            sipDialog.ConnectionTimeout = 10000;
            sipDialog.SendTimeout = 10000;
            sipDialog.ReceiveTimeout = 100;

            _ = Task.Run(async () => await sipDialog.Start());
            await Task.Delay(150);

            Assert.Equal(3, mockSIPTransport.SentRequests.Count);

            SIPRequest notify4 = mockSIPTransport.SentRequests[0];
            SIPRequest bye4 = mockSIPTransport.SentRequests[2];

            Assert.Equal(SIPMethodsEnum.NOTIFY, notify4.Method);
            
            Assert.Equal(SIPMethodsEnum.BYE, bye4.Method);
            Assert.Equal(4, bye4.Header.CSeq); ;
        }

        [Fact]
        public async Task Sends_5BYE_Connection_After_ReceiveTimeout()
        {
            SIPEndPoint sipEndPoint = new SIPEndPoint(IPEndPoint.Parse("1.1.1.1:1"));
            SIPParticipant client = new SIPParticipant("caller-12345aba", sipEndPoint);
            SIPParticipant remote = new SIPParticipant("remote-fsf12345", sipEndPoint);

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

            // register peer
            sipRegistry.Register(new SIPSignalingServer.Models.SIPRegistration(peerRegistrationParams));
            sipRegistry.Confirm(new SIPSignalingServer.Models.SIPRegistration(peerRegistrationParams));

            SIPMemoryConnectionPool connectionPool = new SIPMemoryConnectionPool(NullLoggerFactory.Instance);

            MockSIPRequest initialRequest = new MockSIPRequest(SIPMethodsEnum.REGISTER, new SIPURI(SIPSchemesEnum.sip, sipEndPoint));
            initialRequest.Header = new SIPHeader(
                new SIPFromHeader(registrationParams.ClientParticipant.Name, new SIPURI(SIPSchemesEnum.sip, sipEndPoint), registrationParams.ClientTag),
                new SIPToHeader(registrationParams.RemoteParticipant.Name, new SIPURI(SIPSchemesEnum.sip, sipEndPoint), null),
                1,
                registrationParams.CallId);
            initialRequest.SetRemoteEndPoint(sipEndPoint);

            SIPTransport_No_5Ack mockSIPTransport = new SIPTransport_No_5Ack();

            SIPDialog sipDialog = new SIPDialog(
                SIPSchemesEnum.sip,
                mockSIPTransport,
                initialRequest,
                sipEndPoint,
                sipRegistry,
                connectionPool,
                NullLoggerFactory.Instance);

            sipDialog.RegistrationTimeout = 10000;
            sipDialog.ConnectionTimeout = 10000;
            sipDialog.SendTimeout = 10000;
            sipDialog.ReceiveTimeout = 100;

            _ = Task.Run(async () => await sipDialog.Start());
            await Task.Delay(150);

            Assert.Equal(3, mockSIPTransport.SentRequests.Count);

            SIPRequest notify4 = mockSIPTransport.SentRequests[0];
            SIPRequest bye5 = mockSIPTransport.SentRequests[1];

            Assert.Equal(SIPMethodsEnum.NOTIFY, notify4.Method);

            Assert.Equal(SIPMethodsEnum.BYE, bye5.Method);
            Assert.Equal(5, bye5.Header.CSeq);
        }

        //[Fact]
        //public async Task Sends_5BYE_Connection_After_ConnectionTimout()
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

        //    // register peer
        //    sipRegistry.Register(new SIPSignalingServer.Models.SIPRegistration(peerRegistrationParams));
        //    sipRegistry.Confirm(new SIPSignalingServer.Models.SIPRegistration(peerRegistrationParams));

        //    SIPMemoryConnectionPool connectionPool = new SIPMemoryConnectionPool(NullLoggerFactory.Instance);

        //    MockSIPRequest initialRequest = new MockSIPRequest(SIPMethodsEnum.REGISTER, new SIPURI(SIPSchemesEnum.sip, sipEndPoint));
        //    initialRequest.Header = new SIPHeader(
        //        new SIPFromHeader(registrationParams.ClientParticipant.Name, new SIPURI(SIPSchemesEnum.sip, sipEndPoint), registrationParams.ClientTag),
        //        new SIPToHeader(registrationParams.RemoteParticipant.Name, new SIPURI(SIPSchemesEnum.sip, sipEndPoint), null),
        //        1,
        //        registrationParams.CallId);
        //    initialRequest.SetRemoteEndPoint(sipEndPoint);

        //    SIPTransport_No_5Ack mockSIPTransport = new SIPTransport_No_5Ack();

        //    SIPDialog sipDialog = new SIPDialog(
        //        SIPSchemesEnum.sip,
        //        mockSIPTransport,
        //        initialRequest,
        //        sipEndPoint,
        //        sipRegistry,
        //        connectionPool,
        //        NullLoggerFactory.Instance);

        //    sipDialog.RegistrationTimeout = 10000;
        //    sipDialog.ConnectionTimeout = 100;
        //    sipDialog.SendTimeout = 10000;
        //    sipDialog.ReceiveTimeout = 10000;

        //    _ = Task.Run(async () => await sipDialog.Start());
        //    await Task.Delay(1000); // DEBUG real 150

        //    Assert.Equal(3, mockSIPTransport.SentRequests.Count);

        //    SIPRequest notify4 = mockSIPTransport.SentRequests[0];
        //    SIPRequest bye5 = mockSIPTransport.SentRequests[1];

        //    Assert.Equal(SIPMethodsEnum.NOTIFY, notify4.Method);

        //    Assert.Equal(SIPMethodsEnum.BYE, bye5.Method);
        //    Assert.Equal(5, bye5.Header.CSeq);
        //}

        //[Fact]
        //public async Task Sends_4BYE_Registration_After_ConnectionTimout()
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

        //    // register peer
        //    sipRegistry.Register(new SIPSignalingServer.Models.SIPRegistration(peerRegistrationParams));
        //    sipRegistry.Confirm(new SIPSignalingServer.Models.SIPRegistration(peerRegistrationParams));

        //    SIPMemoryConnectionPool connectionPool = new SIPMemoryConnectionPool(NullLoggerFactory.Instance);

        //    MockSIPRequest initialRequest = new MockSIPRequest(SIPMethodsEnum.REGISTER, new SIPURI(SIPSchemesEnum.sip, sipEndPoint));
        //    initialRequest.Header = new SIPHeader(
        //        new SIPFromHeader(registrationParams.ClientParticipant.Name, new SIPURI(SIPSchemesEnum.sip, sipEndPoint), registrationParams.ClientTag),
        //        new SIPToHeader(registrationParams.RemoteParticipant.Name, new SIPURI(SIPSchemesEnum.sip, sipEndPoint), null),
        //        1,
        //        registrationParams.CallId);
        //    initialRequest.SetRemoteEndPoint(sipEndPoint);

        //    SIPTransport_No_5Ack mockSIPTransport = new SIPTransport_No_5Ack();

        //    SIPDialog sipDialog = new SIPDialog(
        //        SIPSchemesEnum.sip,
        //        mockSIPTransport,
        //        initialRequest,
        //        sipEndPoint,
        //        sipRegistry,
        //        connectionPool,
        //        NullLoggerFactory.Instance);

        //    sipDialog.RegistrationTimeout = 10000;
        //    sipDialog.ConnectionTimeout = 100;
        //    sipDialog.SendTimeout = 10000;
        //    sipDialog.ReceiveTimeout = 10000;

        //    _ = Task.Run(async () => await sipDialog.Start());
        //    await Task.Delay(150);

        //    Assert.Equal(3, mockSIPTransport.SentRequests.Count);

        //    SIPRequest notify4 = mockSIPTransport.SentRequests[0];
        //    SIPRequest bye4 = mockSIPTransport.SentRequests[2];

        //    Assert.Equal(SIPMethodsEnum.NOTIFY, notify4.Method);

        //    Assert.Equal(SIPMethodsEnum.BYE, bye4.Method);
        //    Assert.Equal(4, bye4.Header.CSeq);
        //}

        //[Theory]
        //[InlineData(100, 1000)]
        //[InlineData(100, 500)]
        //[InlineData(100, 200)]
        //[InlineData(100, 100)]
        //[InlineData(100, 10)]
        //[InlineData(100, 1)]
        //[InlineData(100, 0)]
        //[InlineData(1000, 1)]
        //[InlineData(1000, 10)]
        //[InlineData(1000, 100)]
        //[InlineData(1000, 200)]
        //[InlineData(1000, 500)]
        //public async Task Does_Not_Accept_Ack_After_ReceiveTimeout(int receiveTimeout, int delay)
        //    // TODO: this test does not test anything concrete.
        //    //       The test should test if the ACK is accepted
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

        //    // register peer
        //    sipRegistry.Register(new SIPSignalingServer.Models.SIPRegistration(peerRegistrationParams));
        //    sipRegistry.Confirm(new SIPSignalingServer.Models.SIPRegistration(peerRegistrationParams));

        //    SIPMemoryConnectionPool connectionPool = new SIPMemoryConnectionPool(NullLoggerFactory.Instance);

        //    MockSIPRequest initialRequest = new MockSIPRequest(SIPMethodsEnum.REGISTER, new SIPURI(SIPSchemesEnum.sip, sipEndPoint));
        //    initialRequest.Header = new SIPHeader(
        //        new SIPFromHeader(registrationParams.ClientParticipant.Name, new SIPURI(SIPSchemesEnum.sip, sipEndPoint), registrationParams.ClientTag),
        //        new SIPToHeader(registrationParams.RemoteParticipant.Name, new SIPURI(SIPSchemesEnum.sip, sipEndPoint), null),
        //        1,
        //        registrationParams.CallId);
        //    initialRequest.SetRemoteEndPoint(sipEndPoint);

        //    SIPTransport_5Ack_After_Timeout mockSIPTransport = new SIPTransport_5Ack_After_Timeout(receiveTimeout, delay);

        //    SIPDialog sipDialog = new SIPDialog(
        //        SIPSchemesEnum.sip,
        //        mockSIPTransport,
        //        initialRequest,
        //        sipEndPoint,
        //        sipRegistry,
        //        connectionPool,
        //        NullLoggerFactory.Instance);

        //    sipDialog.RegistrationTimeout = 1000;
        //    sipDialog.ConnectionTimeout = 1000;
        //    sipDialog.SendTimeout = 1000;
        //    sipDialog.ReceiveTimeout = receiveTimeout;
        //    sipDialog.PeerRegistrationTimeout = 1000; // this is actually the important one

        //    _ = Task.Run(async () => await sipDialog.Start());
        //    await Task.Delay(receiveTimeout + delay);

        //    Assert.False(sipDialog.Connected);

        //    // TODO: make childclass of connectionPool to look inside. 

        //    //
        //    await Task.Delay(1200); // wait for all potential requests

        //    Assert.Equal(3, mockSIPTransport.SentRequests.Count);

        //    //await Task.Delay(1200); // wait for all potential requests
        //}

        //[Theory]
        //[InlineData(100, 1000)]
        //[InlineData(100, 500)]
        //[InlineData(100, 200)]
        //[InlineData(100, 100)]
        //[InlineData(100, 10)]
        //[InlineData(100, 1)]
        //[InlineData(100, 0)]
        //[InlineData(1000, 1)]
        //[InlineData(1000, 10)]
        //[InlineData(1000, 100)]
        //[InlineData(1000, 200)]
        //[InlineData(1000, 500)]
        //public async Task Does_Not_Accept_Ack_After_ConnectionTimeout(int connectionTimeout, int delay)
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

        //    // register peer
        //    sipRegistry.Register(new SIPSignalingServer.Models.SIPRegistration(peerRegistrationParams));
        //    sipRegistry.Confirm(new SIPSignalingServer.Models.SIPRegistration(peerRegistrationParams));

        //    SIPMemoryConnectionPool connectionPool = new SIPMemoryConnectionPool(NullLoggerFactory.Instance);

        //    MockSIPRequest initialRequest = new MockSIPRequest(SIPMethodsEnum.REGISTER, new SIPURI(SIPSchemesEnum.sip, sipEndPoint));
        //    initialRequest.Header = new SIPHeader(
        //        new SIPFromHeader(registrationParams.ClientParticipant.Name, new SIPURI(SIPSchemesEnum.sip, sipEndPoint), registrationParams.ClientTag),
        //        new SIPToHeader(registrationParams.RemoteParticipant.Name, new SIPURI(SIPSchemesEnum.sip, sipEndPoint), null),
        //        1,
        //        registrationParams.CallId);
        //    initialRequest.SetRemoteEndPoint(sipEndPoint);

        //    SIPTransport_5Ack_After_Timeout mockSIPTransport = new SIPTransport_5Ack_After_Timeout(connectionTimeout, delay);

        //    SIPDialog sipDialog = new SIPDialog(
        //        SIPSchemesEnum.sip,
        //        mockSIPTransport,
        //        initialRequest,
        //        sipEndPoint,
        //        sipRegistry,
        //        connectionPool,
        //        NullLoggerFactory.Instance);

        //    sipDialog.RegistrationTimeout = 1000;
        //    sipDialog.ConnectionTimeout = connectionTimeout;
        //    sipDialog.SendTimeout = 1000;
        //    sipDialog.ReceiveTimeout = 1000;
        //    sipDialog.PeerRegistrationTimeout = 1000; // this is the important timeout

        //    _ = Task.Run(async () => await sipDialog.Start());
        //    await Task.Delay(connectionTimeout + delay);

        //    Assert.False(sipDialog.Connected);

        //    // TODO: make childclass of connectionPool to look inside. 

        //    await Task.Delay(1200); // wait for all potential requests


        //    Assert.Equal(3, mockSIPTransport.SentRequests.Count);
        //}
    }
}