using Advokat.WebRTC.Client.Utils;
using Advokat.WebRTC.Library.SIP;
using Advokat.WebRTC.Library.SIP.Models;
using Microsoft.Extensions.Logging.Abstractions;
using SIPClientTests.SIPConnectionTests.Mocks.SIPTransport;
using SIPClientTests.SIPConnectionTests.Mocks.TransactionFactories;
using SIPClientTests.SIPConnectionTests.Mocks.Transactions;
using SIPSorcery.SIP;
using System.Net;
using WebRTCClient.Transactions.SIP;

namespace SIPClientTests.SIPConnectionTests.SIPConnectionTransactionTests
{
    [Collection("Sequential")]
    public class Timeout_6Notify
    {
        [Fact]
        public async Task Is_Not_Connected()
        {
            SIPParticipant participant = new SIPParticipant(string.Empty, new SIPEndPoint(IPEndPoint.Parse("1.1.1.1:1")));

            SIPEndPoint remoteEndpoint = new SIPEndPoint(new IPEndPoint(IPAddress.Parse("1.1.1.1"), 1));
            SIPEndPoint callerEndpoint = new SIPEndPoint(new IPEndPoint(IPAddress.Parse("1.1.1.1"), 2));


            SIPTransport_Logs_Messages mockTransport = new SIPTransport_Logs_Messages();
            TransactionParams transactionParams = new TransactionParams(
                new SIPParticipant("remote-123", remoteEndpoint),
                new SIPParticipant("caller-456", callerEndpoint),
                sourceTag: CallProperties.CreateNewTag(),
                remoteTag: CallProperties.CreateNewTag(),
                callId: CallProperties.CreateNewCallId()
                );

            using Registration registration = new Registration(null);
            registration.SetActive();

            SIPConnectionTransaction connectionTransaction = new SIPConnectionTransaction(
                SIPSchemesEnum.sip,
                mockTransport,
                transactionParams,
                registration,
                NullLoggerFactory.Instance
                );

            connectionTransaction.Config = new SIPDialogConfig()
            {
                ReceiveTimeout = 100,
                PeerRegistrationTimeout = 100,
                RegistrationTimeout = 100,
                ConnectionTimeout = 100
            };

            _ = Task.Run(async () => await connectionTransaction.Start());
            Assert.False(connectionTransaction.Connected);

            await Task.Delay(150);

            Assert.False(connectionTransaction.Connected);
        }

        [Fact]
        public async Task Sends_5ACK()
        {
            SIPEndPoint remoteEndpoint = new SIPEndPoint(new IPEndPoint(IPAddress.Parse("1.1.1.1"), 1));
            SIPEndPoint callerEndpoint = new SIPEndPoint(new IPEndPoint(IPAddress.Parse("1.1.1.1"), 2));

            SIPTransport_Does_Not_Send_6Notify mockTransport = new SIPTransport_Does_Not_Send_6Notify();

            TransactionParams transactionParams = new TransactionParams(
                new SIPParticipant("remote-123", remoteEndpoint),
                new SIPParticipant("caller-456", callerEndpoint),
                sourceTag: CallProperties.CreateNewTag(),
                remoteTag: CallProperties.CreateNewTag(),
                callId: CallProperties.CreateNewCallId()
                );

            Registration registration = new Registration(null);
            registration.SetActive();

            SIPConnectionTransaction connectionTransaction = new SIPConnectionTransaction(
                SIPSchemesEnum.sip,
                mockTransport,
                transactionParams,
                registration,
                NullLoggerFactory.Instance
                );

            connectionTransaction.StartCseq = 4;

            connectionTransaction.Config = new SIPDialogConfig()
            {
                ReceiveTimeout = 100,
                PeerRegistrationTimeout = 100,
                RegistrationTimeout = 100,
                ConnectionTimeout = 100
            };

            _ = Task.Run(async () => await connectionTransaction.Start());

            await Task.Delay(10);
            await mockTransport.Send4Notify(transactionParams);
            await Task.Delay(20);

            Assert.Single(mockTransport.SentRequests);
            SIPRequest ack5Request = mockTransport.SentRequests.Single();

            Assert.Equal(SIPMethodsEnum.ACK, ack5Request.Method);
            Assert.Equal(5, ack5Request.Header.CSeq);

            Assert.Equal(transactionParams.CallId, ack5Request.Header.CallId);
            Assert.Equal(transactionParams.RemoteTag, ack5Request.Header.To.ToTag);
            Assert.Equal(transactionParams.SourceTag, ack5Request.Header.From.FromTag);

            Assert.Equal(transactionParams.RemoteParticipant.Name, ack5Request.Header.To.ToName);
            Assert.Equal(transactionParams.SourceParticipant.Name, ack5Request.Header.From.FromName);
        }
    }
}
