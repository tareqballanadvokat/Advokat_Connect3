using Advokat.WebRTC.Library.SIP;
using Advokat.WebRTC.Library.SIP.Models;
using Microsoft.Extensions.Logging.Abstractions;
using SIPClientTests.SIPConnectionTests.Mocks.SIPTransport;
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

            SIPConnectionTransaction connectionTransaction = new SIPConnectionTransaction(
                SIPSchemesEnum.sip,
                mockTransport,
                transactionParams,
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

            SIPTransport_Logs_Messages mockTransport = new SIPTransport_Logs_Messages();
            TransactionParams transactionParams = new TransactionParams(
                new SIPParticipant("remote-123", remoteEndpoint),
                new SIPParticipant("caller-456", callerEndpoint),
                sourceTag: CallProperties.CreateNewTag(),
                remoteTag: CallProperties.CreateNewTag(),
                callId: CallProperties.CreateNewCallId()
                );

            SIPConnectionTransaction connectionTransaction = new SIPConnectionTransaction(
                SIPSchemesEnum.sip,
                mockTransport,
                transactionParams,
                NullLoggerFactory.Instance
                );

            connectionTransaction.StartCseq = 5;

            connectionTransaction.Config = new SIPDialogConfig()
            {
                ReceiveTimeout = 100,
                PeerRegistrationTimeout = 100,
                RegistrationTimeout = 100,
                ConnectionTimeout = 100
            };

            _ = Task.Run(async () => await connectionTransaction.Start());
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

        [Fact]
        public async Task Sends_6Bye_After_ConnectionTimeout()
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

            SIPConnectionTransaction connectionTransaction = new SIPConnectionTransaction(
                SIPSchemesEnum.sip,
                mockTransport,
                transactionParams,
                NullLoggerFactory.Instance
                );

            connectionTransaction.StartCseq = 5;

            connectionTransaction.Config = new SIPDialogConfig()
            {
                ReceiveTimeout = 1000,
                PeerRegistrationTimeout = 1000,
                RegistrationTimeout = 1000,
                ConnectionTimeout = 100
            };

            _ = Task.Run(async () => await connectionTransaction.Start());
            await Task.Delay(20);

            Assert.Single(mockTransport.SentRequests);
            SIPRequest ack5Request = mockTransport.SentRequests.Single();

            Assert.Equal(SIPMethodsEnum.ACK, ack5Request.Method);
            Assert.Equal(5, ack5Request.Header.CSeq);

            await Task.Delay(100);

            Assert.Equal(2, mockTransport.SentRequests.Count);
            SIPRequest bye6Request = mockTransport.SentRequests.Last();

            Assert.Equal(SIPMethodsEnum.BYE, bye6Request.Method);
            Assert.Equal(6, bye6Request.Header.CSeq);

            Assert.Equal(transactionParams.CallId, bye6Request.Header.CallId);
            Assert.Equal(transactionParams.RemoteTag, bye6Request.Header.To.ToTag);
            Assert.Equal(transactionParams.SourceTag, bye6Request.Header.From.FromTag);

            Assert.Equal(transactionParams.RemoteParticipant.Name, bye6Request.Header.To.ToName);
            Assert.Equal(transactionParams.SourceParticipant.Name, bye6Request.Header.From.FromName);
        }
    }
}
