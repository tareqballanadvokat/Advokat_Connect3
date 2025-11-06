using Microsoft.Extensions.Logging.Abstractions;
using SIPClientTests.RegistrationTests.Mocks;
using SIPSorcery.SIP;
using System.Net;
using WebRTCClient.Transactions.SIP;
using Advokat.WebRTC.Library.SIP.Models;
using Advokat.WebRTC.Library.SIP;

namespace SIPClientTests.RegistrationTests
{
    public class Timeout_1Register
    {
        [Fact]
        public async Task Is_Not_Registered()
        {
            SIPParticipant participant = new(string.Empty, new SIPEndPoint(new IPEndPoint(IPAddress.Parse("1.1.1.1"), 1)));
            SIPConnection_Does_Not_Send_Request mockConnection = new SIPConnection_Does_Not_Send_Request();
            
            TransactionParams transactionParams = new TransactionParams(participant, participant, callId: CallProperties.CreateNewCallId());

            SIPRegistrationTransaction sipRegistrationTransaction = new(mockConnection, transactionParams, NullLoggerFactory.Instance);

            sipRegistrationTransaction.Config = new SIPDialogConfig()
            {
                ReceiveTimeout = 100
            };

            await sipRegistrationTransaction.Start();

            Assert.False(sipRegistrationTransaction.Registered);

            await Task.Delay(150);
            Assert.False(sipRegistrationTransaction.Registered);
        }

        [Fact]
        public async Task Can_Start_Again()
        {
            SIPParticipant participant = new(string.Empty, new SIPEndPoint(new IPEndPoint(IPAddress.Parse("1.1.1.1"), 1)));
            SIPConnection_Does_Not_Send_Request mockConnection = new SIPConnection_Does_Not_Send_Request();

            TransactionParams transactionParams = new TransactionParams(participant, participant, callId: CallProperties.CreateNewCallId());

            SIPRegistrationTransaction sipRegistrationTransaction = new(mockConnection, transactionParams, NullLoggerFactory.Instance);
            
            sipRegistrationTransaction.Config = new SIPDialogConfig()
            {
                ReceiveTimeout = 100
            };
            
            await sipRegistrationTransaction.Start();

            Assert.Single(mockConnection.SentRequests);

            await sipRegistrationTransaction.Start();

            Assert.Equal(2, mockConnection.SentRequests.Count);
        }
    }
}
