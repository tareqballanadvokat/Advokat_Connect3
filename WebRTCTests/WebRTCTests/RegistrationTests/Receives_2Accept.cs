using Microsoft.Extensions.Logging.Abstractions;
using SIPClientTests.RegistrationTests.Mocks;
using SIPSorcery.SIP;
using System.Net;
using WebRTCClient.Transactions.SIP;
using WebRTCLibrary.SIP.Models;

namespace SIPClientTests.RegistrationTests
{
    public class Receives_2Accept
    {
        [Fact]
        public async Task Sends_3ACK()
        {
            SIPParticipant participant = new(string.Empty, new SIPEndPoint(new IPEndPoint(IPAddress.Parse("1.1.1.1"), 1)));
            SIPConnection_Sends_2Accepted mockConnection = new SIPConnection_Sends_2Accepted();
            TransactionParams transactionParams = new TransactionParams(participant, participant, callId: CallProperties.CreateNewCallId());

            SIPRegistrationTransaction sipRegistrationTransaction = new(mockConnection, transactionParams, NullLoggerFactory.Instance);
            sipRegistrationTransaction.ReceiveTimeout = 100;

            await sipRegistrationTransaction.Start();

            Assert.Equal(2, mockConnection.SentRequests.Count());
            Assert.Equal(SIPMethodsEnum.REGISTER, mockConnection.SentRequests.First().method);
            Assert.Equal(SIPMethodsEnum.ACK, mockConnection.SentRequests.Last().method);
        }

        [Fact]
        public async Task Is_Registered()
        {
            SIPParticipant participant = new(string.Empty, new SIPEndPoint(new IPEndPoint(IPAddress.Parse("1.1.1.1"), 1)));
            SIPConnection_Sends_2Accepted mockConnection = new SIPConnection_Sends_2Accepted();
            TransactionParams transactionParams = new TransactionParams(participant, participant, callId: CallProperties.CreateNewCallId());

            SIPRegistrationTransaction sipRegistrationTransaction = new(mockConnection, transactionParams, NullLoggerFactory.Instance);
            sipRegistrationTransaction.ReceiveTimeout = 100;

            await sipRegistrationTransaction.Start();

            Assert.True(sipRegistrationTransaction.Registered);
        }

        [Theory]
        [InlineData(0)]
        [InlineData(1)]
        [InlineData(10)]
        [InlineData(100)]
        [InlineData(200)]
        [InlineData(500)]
        [InlineData(1000)]
        public async Task Does_Not_Send_Multiple_3ACKs(int second2Accepted_delay)
        {
            SIPParticipant participant = new(string.Empty, new SIPEndPoint(new IPEndPoint(IPAddress.Parse("1.1.1.1"), 1)));
            SIPConnection_Sends_Multiple_2Accepted mockConnection = new SIPConnection_Sends_Multiple_2Accepted(second2Accepted_delay);
            TransactionParams transactionParams = new TransactionParams(participant, participant, callId: CallProperties.CreateNewCallId());

            SIPRegistrationTransaction sipRegistrationTransaction = new(mockConnection, transactionParams, NullLoggerFactory.Instance);
            sipRegistrationTransaction.ReceiveTimeout = 100;

            await sipRegistrationTransaction.Start();

            // Wait for second 2Accepted to potentially be sent and processed
            await Task.Delay(second2Accepted_delay + 100);

            Assert.Equal(2, mockConnection.SentRequests.Count());
            Assert.Equal(SIPMethodsEnum.REGISTER, mockConnection.SentRequests.First().method);
            Assert.Equal(SIPMethodsEnum.ACK, mockConnection.SentRequests.Last().method);
        }
    }
}
