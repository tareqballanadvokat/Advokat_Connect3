using Microsoft.Extensions.Logging.Abstractions;
using SIPClientTests.RegistrationTests.Mocks;
using SIPSorcery.SIP;
using System.Net;
using WebRTCClient.Transactions.SIP;
using WebRTCLibrary.SIP.Models;

namespace SIPClientTests.RegistrationTests
{
    public class Timeout_2Accept
    {
        [Fact]
        public async Task Is_Not_Registered()
        {
            SIPParticipant participant = new(string.Empty, new SIPEndPoint(new IPEndPoint(IPAddress.Parse("1.1.1.1"), 1)));
            SIPConnection_Does_Not_Send_2Accepted mockConnection = new SIPConnection_Does_Not_Send_2Accepted();
            TransactionParams transactionParams = new TransactionParams(participant, participant, callId: CallProperties.CreateNewCallId());

            SIPRegistrationTransaction sipRegistrationTransaction = new(mockConnection, transactionParams, NullLoggerFactory.Instance)
            {
                ReceiveTimeout = 100
            };

            await sipRegistrationTransaction.Start();

            Assert.False(sipRegistrationTransaction.Registered);
        }

        [Fact]
        public async Task Does_Not_Send_3ACK()
        {
            SIPParticipant participant = new(string.Empty, new SIPEndPoint(new IPEndPoint(IPAddress.Parse("1.1.1.1"), 1)));
            SIPConnection_Does_Not_Send_2Accepted mockConnection = new SIPConnection_Does_Not_Send_2Accepted();
            TransactionParams transactionParams = new TransactionParams(participant, participant, callId: CallProperties.CreateNewCallId());

            SIPRegistrationTransaction sipRegistrationTransaction = new(mockConnection, transactionParams, NullLoggerFactory.Instance)
            {
                ReceiveTimeout = 100
            };

            await sipRegistrationTransaction.Start();

            Assert.Equal(2, mockConnection.SentRequests.Count());
            Assert.Equal(SIPMethodsEnum.REGISTER, mockConnection.SentRequests.First().method);
            Assert.Equal(SIPMethodsEnum.BYE, mockConnection.SentRequests.Last().method);
        }

        [Fact]
        public async Task Sends_2BYE_After_Timeout()
        {
            SIPParticipant participant = new(string.Empty, new SIPEndPoint(new IPEndPoint(IPAddress.Parse("1.1.1.1"), 1)));
            SIPConnection_Does_Not_Send_2Accepted mockConnection = new SIPConnection_Does_Not_Send_2Accepted();
            TransactionParams transactionParams = new TransactionParams(participant, participant, callId: CallProperties.CreateNewCallId());

            SIPRegistrationTransaction sipRegistrationTransaction = new(mockConnection, transactionParams, NullLoggerFactory.Instance)
            {
                ReceiveTimeout = 2000
            };

            // Run transaction in background thread
            _ = Task.Run(async () => await sipRegistrationTransaction.Start());

            // wait for register
            await Task.Delay(100);
            
            // register gets sent
            Assert.Single(mockConnection.SentRequests);
            Assert.Equal(SIPMethodsEnum.REGISTER, mockConnection.SentRequests.Single().method);

            // wait for timeout
            await Task.Delay(3000);

            // transaction sends bye after timeout
            Assert.Equal(2, mockConnection.SentRequests.Count());
            Assert.Equal(SIPMethodsEnum.BYE, mockConnection.SentRequests.Last().method);
            Assert.Equal(2, mockConnection.SentRequests.Last().headerParams.CSeq);
        }

        [Theory]
        [InlineData(100, 1000)]
        [InlineData(100, 500)]
        [InlineData(100, 200)]
        [InlineData(100, 100)]
        [InlineData(100, 10)]
        //[InlineData(100, 1)] // generally works. Inconsistent, Fails rarely - too close
        //[InlineData(100, 0)]
        //[InlineData(1000, 1)] // generally works. Inconsistent, Fails rarely - too close
        [InlineData(1000, 10)]
        [InlineData(1000, 100)]
        [InlineData(1000, 200)]
        [InlineData(1000, 500)]
        public async Task Does_Not_Accept_After_Timeout(int messageTimeout, int delay_to_accept)
        {
            SIPParticipant participant = new(string.Empty, new SIPEndPoint(new IPEndPoint(IPAddress.Parse("1.1.1.1"), 1)));
            SIPConnection_Sends_2Accepted_After_Timeout mockConnection = new SIPConnection_Sends_2Accepted_After_Timeout(messageTimeout, delay_to_accept);
            TransactionParams transactionParams = new TransactionParams(participant, participant, callId: CallProperties.CreateNewCallId());

            SIPRegistrationTransaction sipRegistrationTransaction = new(mockConnection, transactionParams, NullLoggerFactory.Instance)
            {
                ReceiveTimeout = messageTimeout
            };

            await sipRegistrationTransaction.Start();

            Assert.False(sipRegistrationTransaction.Registered);

            // No ACK Should be sent
            Assert.Equal(2, mockConnection.SentRequests.Count());
            Assert.Equal(SIPMethodsEnum.REGISTER, mockConnection.SentRequests.First().method);
            Assert.Equal(SIPMethodsEnum.BYE, mockConnection.SentRequests.Last().method);
        }
    }
}
