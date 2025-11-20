using Advokat.WebRTC.Library.SIP;
using Advokat.WebRTC.Library.SIP.Models;
using Microsoft.Extensions.Logging.Abstractions;
using SIPClientTests.SIPConnectionTests.Mocks.SIPTransport;
using SIPClientTests.SIPConnectionTests.Mocks.TransactionFactories;
using SIPClientTests.SIPConnectionTests.Mocks.Transactions;
using SIPSorcery.SIP;
using System.Net;
using WebRTCClient.Transactions.SIP;

namespace SIPClientTests.SIPConnectionTests.SIPDialogTests
{
    [Collection("Sequential")]
    public class Timeout_6Notify
    {
        [Fact]
        public async Task Is_Not_Connected()
        {
            SIPEndPoint remoteEndpoint = new SIPEndPoint(new IPEndPoint(IPAddress.Parse("1.1.1.1"), 1));
            SIPEndPoint callerEndpoint = new SIPEndPoint(new IPEndPoint(IPAddress.Parse("1.1.1.1"), 2));

            SIPParticipant remoteParticipant = new SIPParticipant("remote-1234", remoteEndpoint);
            SIPParticipant callerParticipant = new SIPParticipant("caller-5678", callerEndpoint);

            SIPTransport_Can_Send_ConnectionBye_And_Notifies mockTransport = new SIPTransport_Can_Send_ConnectionBye_And_Notifies();

            SIPDialog sipDialog = new SIPDialog(
                SIPSchemesEnum.sip,
                mockTransport,
                callerParticipant,
                remoteParticipant,
                NullLoggerFactory.Instance
                );

            TransactionParams registrationTransactionParams = new TransactionParams(
                callerParticipant,
                remoteParticipant,
                sourceTag: CallProperties.CreateNewTag(),
                remoteTag: CallProperties.CreateNewTag(),
                callId: CallProperties.CreateNewCallId()
                );

            TransactionParams connectionTransactionParams = new TransactionParams(
                registrationTransactionParams.SourceParticipant,
                registrationTransactionParams.RemoteParticipant,
                sourceTag: registrationTransactionParams.SourceTag,
                remoteTag: CallProperties.CreateNewTag(),
                callId: CallProperties.CreateNewCallId()
                );

            SIPRegistrationTransaction_Unregistering_Possible mockRegistrationTransaction = new SIPRegistrationTransaction_Unregistering_Possible(registrationTransactionParams);
            SIPRegistrationTransaction_Factory<SIPRegistrationTransaction_Unregistering_Possible> sIPRegistrationTransaction_Factory = new(mockRegistrationTransaction);
            sipDialog.SIPRegistrationTransactionFactory = sIPRegistrationTransaction_Factory;

            sipDialog.Config = new SIPDialogConfig()
            {
                ReceiveTimeout = 100,
                PeerRegistrationTimeout = 100,
                RegistrationTimeout = 100,
                ConnectionTimeout = 100
            };

            _ = Task.Run(async () => await sipDialog.Start());
            await Task.Delay(20);

            await mockTransport.SendNotify(connectionTransactionParams, 4);
            await Task.Delay(10);

            Assert.False(sipDialog.Connected);
        }

        [Fact]
        public async Task Sends_6Bye_After_ConnectionTimeout()
        {
            SIPEndPoint remoteEndpoint = new SIPEndPoint(new IPEndPoint(IPAddress.Parse("1.1.1.1"), 1));
            SIPEndPoint callerEndpoint = new SIPEndPoint(new IPEndPoint(IPAddress.Parse("1.1.1.1"), 2));

            SIPParticipant remoteParticipant = new SIPParticipant("remote-1234", remoteEndpoint);
            SIPParticipant callerParticipant = new SIPParticipant("caller-5678", callerEndpoint);

            SIPTransport_Can_Send_ConnectionBye_And_Notifies mockTransport = new SIPTransport_Can_Send_ConnectionBye_And_Notifies();

            SIPDialog sipDialog = new SIPDialog(
                SIPSchemesEnum.sip,
                mockTransport,
                callerParticipant,
                remoteParticipant,
                NullLoggerFactory.Instance
                );

            TransactionParams registrationTransactionParams = new TransactionParams(
                callerParticipant,
                remoteParticipant,
                sourceTag: CallProperties.CreateNewTag(),
                remoteTag: CallProperties.CreateNewTag(),
                callId: CallProperties.CreateNewCallId()
                );

            TransactionParams connectionTransactionParams = new TransactionParams(
                registrationTransactionParams.SourceParticipant,
                registrationTransactionParams.RemoteParticipant,
                sourceTag: registrationTransactionParams.SourceTag,
                remoteTag: CallProperties.CreateNewTag(),
                callId: CallProperties.CreateNewCallId()
                );

            SIPRegistrationTransaction_Unregistering_Possible mockRegistrationTransaction = new SIPRegistrationTransaction_Unregistering_Possible(registrationTransactionParams);
            SIPRegistrationTransaction_Factory<SIPRegistrationTransaction_Unregistering_Possible> sIPRegistrationTransaction_Factory = new(mockRegistrationTransaction);
            sipDialog.SIPRegistrationTransactionFactory = sIPRegistrationTransaction_Factory;

            sipDialog.Config = new SIPDialogConfig()
            {
                ReceiveTimeout = 1000,
                PeerRegistrationTimeout = 1000,
                RegistrationTimeout = 1000,
                ConnectionTimeout = 100
            };

            _ = Task.Run(async () => await sipDialog.Start());
            await Task.Delay(20);

            await mockTransport.SendNotify(connectionTransactionParams, 4);

            await Task.Delay(10);

            Assert.Single(mockTransport.SentRequests);
            SIPRequest ack5Request = mockTransport.SentRequests.Single();

            Assert.Equal(SIPMethodsEnum.ACK, ack5Request.Method);
            Assert.Equal(5, ack5Request.Header.CSeq);

            await Task.Delay(100);

            Assert.Equal(2, mockTransport.SentRequests.Count);
            SIPRequest bye6Request = mockTransport.SentRequests.Last();

            Assert.Equal(SIPMethodsEnum.BYE, bye6Request.Method);
            Assert.Equal(6, bye6Request.Header.CSeq);

            Assert.Equal(connectionTransactionParams.CallId, bye6Request.Header.CallId);
            Assert.Equal(connectionTransactionParams.RemoteTag, bye6Request.Header.To.ToTag);
            Assert.Equal(connectionTransactionParams.SourceTag, bye6Request.Header.From.FromTag);

            Assert.Equal(connectionTransactionParams.RemoteParticipant.Name, bye6Request.Header.To.ToName);
            Assert.Equal(connectionTransactionParams.SourceParticipant.Name, bye6Request.Header.From.FromName);
        }
    }
}
