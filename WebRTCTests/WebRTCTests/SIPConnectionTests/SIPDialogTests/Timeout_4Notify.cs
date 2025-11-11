using Microsoft.Extensions.Logging.Abstractions;
using SIPClientTests.SIPConnectionTests.Mocks.SIPTransport;
using SIPClientTests.SIPConnectionTests.Mocks.TransactionFactories;
using SIPClientTests.SIPConnectionTests.Mocks.Transactions;
using SIPSorcery.SIP;
using System.Net;
using WebRTCClient.Transactions.SIP;
using Advokat.WebRTC.Library.SIP.Models;
using Advokat.WebRTC.Library.SIP;

namespace SIPClientTests.SIPConnectionTests.SIPDialogTests
{
    [Collection("Sequential")]
    public class Timeout_4Notify
    {
        [Fact]
        public async Task Is_Not_Connected()
        {
            SIPParticipant participant = new SIPParticipant(string.Empty, new SIPEndPoint(IPEndPoint.Parse("1.1.1.1:1")));

            SIPDialog sipDialog = new SIPDialog(
                SIPSchemesEnum.sip,
                new SIPTransport_Does_Nothing(),
                participant,
                participant,
                NullLoggerFactory.Instance
                );

            SIPRegistrationTransaction_Factory<SIPRegistrationTransaction_Unregistering_Possible> sIPRegistrationTransaction_Factory = new();

            sipDialog.SIPRegistrationTransactionFactory = sIPRegistrationTransaction_Factory;

            sipDialog.Config = new SIPDialogConfig() 
            {
                ReceiveTimeout = 100,
                PeerRegistrationTimeout = 100,
                RegistrationTimeout = 100,
                ConnectionTimeout = 100
            };

            await sipDialog.Start();

            Assert.False(sipDialog.Connected);

            await Task.Delay(200);
            Assert.False(sipDialog.Connected);
        }

        [Fact]
        public async Task Is_Not_Registered_After_Timeout()
        {
            SIPParticipant participant = new SIPParticipant(string.Empty, new SIPEndPoint(IPEndPoint.Parse("1.1.1.1:1")));

            SIPDialog sipDialog = new SIPDialog(
                SIPSchemesEnum.sip,
                new SIPTransport_Does_Nothing(),
                participant,
                participant,
                NullLoggerFactory.Instance
                );

            SIPRegistrationTransaction_Factory<SIPRegistrationTransaction_Unregistering_Possible> sIPRegistrationTransaction_Factory = new();

            sipDialog.SIPRegistrationTransactionFactory = sIPRegistrationTransaction_Factory;

            sipDialog.Config = new SIPDialogConfig()
            {
                ReceiveTimeout = 1000,
                PeerRegistrationTimeout = 100,
                RegistrationTimeout = 1000,
                ConnectionTimeout = 1000
            };

            _ = Task.Run(async () => await sipDialog.Start());

            await Task.Delay(10);

            Assert.True(sipDialog.Registered);
            Assert.False(sipDialog.Connected);

            await Task.Delay(150);

            Assert.False(sipDialog.Connected);
            Assert.False(sipDialog.Registered);
        }

        [Fact]
        public async Task Stops_Registration_After_RegistrationBye()
        {
            SIPEndPoint remoteEndpoint = new SIPEndPoint(new IPEndPoint(IPAddress.Parse("1.1.1.1"), 1));
            SIPEndPoint callerEndpoint = new SIPEndPoint(new IPEndPoint(IPAddress.Parse("1.1.1.1"), 2));

            SIPParticipant remoteParticipant = new SIPParticipant("remote-1234", remoteEndpoint);
            SIPParticipant callerParticipant = new SIPParticipant("caller-5678", callerEndpoint);

            SIPTransport_Logs_Messages mockTransport = new SIPTransport_Logs_Messages();

            SIPDialog sipDialog = new SIPDialog(
                SIPSchemesEnum.sip,
                mockTransport,
                callerParticipant,
                remoteParticipant,
                NullLoggerFactory.Instance
                );

            SIPRegistrationTransaction_Unregistering_Possible mockRegistrationTransaction = new SIPRegistrationTransaction_Unregistering_Possible();
            SIPRegistrationTransaction_Factory<SIPRegistrationTransaction_Unregistering_Possible> sIPRegistrationTransaction_Factory = new(mockRegistrationTransaction);
            sipDialog.SIPRegistrationTransactionFactory = sIPRegistrationTransaction_Factory;

            sipDialog.Config = new SIPDialogConfig()
            {
                ReceiveTimeout = 1000,
                PeerRegistrationTimeout = 100,
                RegistrationTimeout = 1000,
                ConnectionTimeout = 1000
            };

            _ = Task.Run(async () => await sipDialog.Start());
            await Task.Delay(10);

            Assert.True(mockRegistrationTransaction.Registered); 
            await Task.Delay(150);

            Assert.False(mockRegistrationTransaction.Registered);
        }


        [Fact]
        public async Task Does_Not_Accept_4Notify_After_PeerRegistrationTimeout()
        {
            SIPEndPoint remoteEndpoint = new SIPEndPoint(new IPEndPoint(IPAddress.Parse("1.1.1.1"), 1));
            SIPEndPoint callerEndpoint = new SIPEndPoint(new IPEndPoint(IPAddress.Parse("1.1.1.1"), 2));

            SIPParticipant remoteParticipant = new SIPParticipant("remote-1234", remoteEndpoint);
            SIPParticipant callerParticipant = new SIPParticipant("caller-5678", callerEndpoint);

            SIPTransport_Does_Not_Send_6Notify mockTransport = new SIPTransport_Does_Not_Send_6Notify();

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

            SIPRegistrationTransaction_Unregistering_Possible mockRegistrationTransaction = new SIPRegistrationTransaction_Unregistering_Possible(registrationTransactionParams);
            SIPRegistrationTransaction_Factory<SIPRegistrationTransaction_Unregistering_Possible> sIPRegistrationTransaction_Factory = new(mockRegistrationTransaction);
            sipDialog.SIPRegistrationTransactionFactory = sIPRegistrationTransaction_Factory;

            sipDialog.Config = new SIPDialogConfig()
            {
                ReceiveTimeout = 1000,
                PeerRegistrationTimeout = 100,
                RegistrationTimeout = 1000,
                ConnectionTimeout = 1000
            };

            _ = Task.Run(async () => await sipDialog.Start());
            await Task.Delay(150);
            await mockTransport.Send4Notify(
                new TransactionParams(
                    registrationTransactionParams.SourceParticipant,
                    registrationTransactionParams.RemoteParticipant,
                    sourceTag: registrationTransactionParams.SourceTag,
                    remoteTag: CallProperties.CreateNewTag(),
                    callId: CallProperties.CreateNewCallId()
                ));

            await Task.Delay(50);
            Assert.Empty(mockTransport.SentRequests.Where(r => r.Method == SIPMethodsEnum.ACK && r.Header.CSeq == 5));
        }

        [Fact]
        public async Task Does_Not_Accept_4Notify_After_Receiving_4RegistrationBye()
        {
            SIPEndPoint remoteEndpoint = new SIPEndPoint(new IPEndPoint(IPAddress.Parse("1.1.1.1"), 1));
            SIPEndPoint callerEndpoint = new SIPEndPoint(new IPEndPoint(IPAddress.Parse("1.1.1.1"), 2));

            SIPParticipant remoteParticipant = new SIPParticipant("remote-1234", remoteEndpoint);
            SIPParticipant callerParticipant = new SIPParticipant("caller-5678", callerEndpoint);

            SIPTransport_Sends_RegistrationBye_And_4Notify mockTransport = new SIPTransport_Sends_RegistrationBye_And_4Notify();

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
                ConnectionTimeout = 1000
            };

            _ = Task.Run(async () => await sipDialog.Start());
            await Task.Delay(20);

            await mockTransport.SendRegistrationBye(registrationTransactionParams);
            await Task.Delay(10);

            await mockTransport.Send4Notify(connectionTransactionParams);

            await Task.Delay(50);
            Assert.Empty(mockTransport.SentRequests.Where(r => r.Method == SIPMethodsEnum.ACK && r.Header.CSeq == 5));
        }
    }
}
