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
    public class ConnectionTimeout
    {
        [Fact]
        public async Task Keep_registration_After_ConnectionTimeout()
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
                PeerRegistrationTimeout = 300,
                RegistrationTimeout = 1000,
                ConnectionTimeout = 100
            };

            _ = Task.Run(async () => await sipDialog.Start());
            await Task.Delay(20);

            await mockTransport.SendNotify(connectionTransactionParams, 4);
            await Task.Delay(120); // ConnectionTimeout hit, peerRegistrationTimeout not

            Assert.True(mockRegistrationTransaction.Registered);
            
            // TODO: Not the right test for this. --> Remove registration after peerregistrationtimeout
            await Task.Delay(400);
            Assert.False(mockRegistrationTransaction.Registered);

        }

        [Fact]
        public async Task Accepts_Connection_Retry_After_ConnectionTimeout()
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

            Assert.Single(mockTransport.SentRequests.Where(r => r.Method == SIPMethodsEnum.ACK));
            SIPRequest firstAck = mockTransport.SentRequests.Single(r => r.Method == SIPMethodsEnum.ACK);

            await Task.Delay(120); // ConnectionTimeout hit, registration is beeing held

            // different connectionParams of new peer registration
            connectionTransactionParams = new TransactionParams(
                registrationTransactionParams.SourceParticipant,
                registrationTransactionParams.RemoteParticipant,
                sourceTag: registrationTransactionParams.SourceTag,
                remoteTag: CallProperties.CreateNewTag(),
                callId: CallProperties.CreateNewCallId()
                );

            await mockTransport.SendNotify(connectionTransactionParams, 4);

            await Task.Delay(10);
            Assert.Equal(2, mockTransport.SentRequests.Where(r => r.Method == SIPMethodsEnum.ACK).Count());
            SIPRequest secondAck = mockTransport.SentRequests.Last(r => r.Method == SIPMethodsEnum.ACK);

            Assert.Equal(firstAck.Header.From.FromTag, secondAck.Header.From.FromTag);
            Assert.Equal(firstAck.Header.From.FromName, secondAck.Header.From.FromName);
            Assert.Equal(firstAck.Header.To.ToName, secondAck.Header.To.ToName);
            Assert.NotEqual(firstAck.Header.To.ToTag, secondAck.Header.To.ToTag);
            Assert.NotEqual(firstAck.Header.CallId, secondAck.Header.CallId);

            await mockTransport.SendNotify(connectionTransactionParams, 6);
            await Task.Delay(10);

            Assert.True(sipDialog.Connected);
        }
    }
}
