using Microsoft.Extensions.Logging.Abstractions;
using SignalingServerTests.Mocks.SIPRequests;
using SignalingServerTests.SIPConnection.Mocks.SIPTransport;
using SIPSignalingServer;
using SIPSignalingServer.Models;
using SIPSignalingServer.Transactions;
using SIPSorcery.SIP;
using System.Net;
using Advokat.WebRTC.Library.SIP;
using Advokat.WebRTC.Library.SIP.Models;

namespace SignalingServerTests.SIPConnection
{
    [Collection("Sequential")]
    public class Cannot_Send_4Notify_Remote
    {
        [Fact]
        public async Task Remote_Is_Not_Connected()
        {
            SIPEndPoint sipEndPoint = new SIPEndPoint(IPEndPoint.Parse("1.1.1.1:1"));
            SIPParticipant client = new SIPParticipant("caller-12345ab", sipEndPoint);
            SIPParticipant remote = new SIPParticipant("remote-fsf1234", sipEndPoint);

            ServerSideTransactionParams callerParams = new ServerSideTransactionParams(
                remote,
                client,
                callId: CallProperties.CreateNewCallId(),
                remoteTag: null,
                clientTag: CallProperties.CreateNewTag());

            ServerSideTransactionParams remoteParams = new ServerSideTransactionParams(
                client,
                remote,
                callId: CallProperties.CreateNewCallId(),
                remoteTag: null,
                clientTag: CallProperties.CreateNewTag());

            SIPMemoryRegistry sipRegistry = new(NullLoggerFactory.Instance);
            SIPMemoryConnectionPool connectionPool = new SIPMemoryConnectionPool(NullLoggerFactory.Instance);

            SIPConnectionTransaction callerConnectionTransaction = new SIPConnectionTransaction(
                SIPSchemesEnum.sip,
                new SIPTransport_Registration_And_Connection_Working(),
                callerParams,
                sipRegistry,
                connectionPool,
                NullLoggerFactory.Instance);

            callerConnectionTransaction.Config = new SIPConfig()
            {
                ReceiveTimeout = 100
            };

            SIPConnectionTransaction remoteConnectionTransaction = new SIPConnectionTransaction(
                SIPSchemesEnum.sip,
                new SIPTransport_Registration_And_Connection_Working(),
                remoteParams,
                sipRegistry,
                connectionPool,
                NullLoggerFactory.Instance);

            remoteConnectionTransaction.Config = new SIPConfig()
            {
                ReceiveTimeout = 100
            };

            _ = Task.Run(async () => await callerConnectionTransaction.Start());
            _ = Task.Run(async () => await remoteConnectionTransaction.Start());

            await Task.Delay(300);

            Assert.False(remoteConnectionTransaction.Connected);

            Assert.False(callerConnectionTransaction.Connected); // for redundancy
        }

        //[Fact]
        //public async Task Remote_Is_Registered()
        //{
        //    SIPEndPoint sipEndPoint = new SIPEndPoint(IPEndPoint.Parse("1.1.1.1:1"));
        //    SIPParticipant client = new SIPParticipant("caller-12345ab", sipEndPoint);
        //    SIPParticipant remote = new SIPParticipant("remote-fsf1234", sipEndPoint);

        //    ServerSideTransactionParams callerParams = new ServerSideTransactionParams(
        //        remote,
        //        client,
        //        callId: CallProperties.CreateNewCallId(),
        //        remoteTag: null,
        //        clientTag: CallProperties.CreateNewTag());

        //    ServerSideTransactionParams remoteParams = new ServerSideTransactionParams(
        //        client,
        //        remote,
        //        callId: CallProperties.CreateNewCallId(),
        //        remoteTag: null,
        //        clientTag: CallProperties.CreateNewTag());

        //    MockSIPRequest callerRequest = this.GetMockSIPRequest(SIPMethodsEnum.REGISTER, sipEndPoint, callerParams);
        //    MockSIPRequest remoteRequest = this.GetMockSIPRequest(SIPMethodsEnum.REGISTER, sipEndPoint, remoteParams);

        //    SIPMemoryRegistry sipRegistry = new(NullLoggerFactory.Instance);
        //    SIPMemoryConnectionPool connectionPool = new SIPMemoryConnectionPool(NullLoggerFactory.Instance);

        //    SIPDialog callerDialog = new SIPDialog(
        //        SIPSchemesEnum.sip,
        //        new SIPTransport_Registration_And_Connection_Working(),
        //        callerRequest,
        //        sipEndPoint,
        //        sipRegistry,
        //        connectionPool,
        //        NullLoggerFactory.Instance);

        //    callerDialog.SendTimeout = 100;
        //    callerDialog.ReceiveTimeout = 100;

        //    SIPDialog remoteDialog = new SIPDialog(
        //        SIPSchemesEnum.sip,
        //        new SIPTransport_Registration_And_Connection_Working(),
        //        remoteRequest,
        //        sipEndPoint,
        //        sipRegistry,
        //        connectionPool,
        //        NullLoggerFactory.Instance);

        //    remoteDialog.SendTimeout = 100;
        //    remoteDialog.ReceiveTimeout = 100;

        //    _ = Task.Run(async () => await callerDialog.Start());
        //    _ = Task.Run(async () => await remoteDialog.Start());

        //    await Task.Delay(300);

        //    Assert.True(sipRegistry.IsRegistered(new SIPSignalingServer.Models.SIPRegistration(remoteParams)));
        //    Assert.False(sipRegistry.IsRegistered(new SIPSignalingServer.Models.SIPRegistration(callerParams))); // for redundancy
        //}

        private MockSIPRequest GetMockSIPRequest(SIPMethodsEnum method, SIPEndPoint sipEndPoint, ServerSideTransactionParams callParams)
        {
            SIPURI sipUri = new SIPURI(SIPSchemesEnum.sip, sipEndPoint);

            MockSIPRequest request = new MockSIPRequest(method, sipUri);

            request.Header = new SIPHeader(
                new SIPFromHeader(callParams.ClientParticipant.Name, sipUri, callParams.ClientTag),
                new SIPToHeader(callParams.RemoteParticipant.Name, sipUri, string.Empty),
                1,
                callId: callParams.CallId);

            request.SetRemoteEndPoint(sipEndPoint);
            request.SetLocalEndPoint(sipEndPoint);

            return request;
        }
    }
}
