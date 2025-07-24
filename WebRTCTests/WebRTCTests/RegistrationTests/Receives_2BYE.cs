using Microsoft.Extensions.Logging.Abstractions;
using SIPClientTests.RegistrationTests.Mocks;
using SIPSorcery.SIP;
using System.Net;
using WebRTCClient.Transactions.SIP;
using WebRTCLibrary.SIP;
using WebRTCLibrary.SIP.Models;

namespace SIPClientTests.RegistrationTests
{
    public class Receives_2BYE
    {
        [Fact]
        public async Task Is_Not_Registered()
        {
            SIPParticipant participant = new(string.Empty, new SIPEndPoint(new IPEndPoint(IPAddress.Parse("1.1.1.1"), 1)));
            SIPConnection_Responds_With_2_BYE mockConnection = new SIPConnection_Responds_With_2_BYE();
            TransactionParams transactionParams = new TransactionParams(participant, participant, callId: CallProperties.CreateNewCallId());

            SIPRegistrationTransaction sipRegistrationTransaction = new(mockConnection, transactionParams, NullLoggerFactory.Instance);
            sipRegistrationTransaction.Config = new SIPConfig()
            {
                ReceiveTimeout = 100
            };

            await sipRegistrationTransaction.Start();

            Assert.False(sipRegistrationTransaction.Registered);
            Assert.Equal(1, mockConnection.RequestsSent);
        }

        [Fact]
        public async Task Cancels_all_Tasks()
        {
            SIPParticipant participant = new(string.Empty, new SIPEndPoint(new IPEndPoint(IPAddress.Parse("1.1.1.1"), 1)));
            SIPConnection_Responds_With_2_BYE mockConnection = new SIPConnection_Responds_With_2_BYE();
            TransactionParams transactionParams = new TransactionParams(participant, participant, callId: CallProperties.CreateNewCallId());

            SIPRegistrationTransaction sipRegistrationTransaction = new(mockConnection, transactionParams, NullLoggerFactory.Instance);

            // make timeout extemely long. Waiting for response should get cancelled before
            sipRegistrationTransaction.Config = new SIPConfig()
            {
                ReceiveTimeout = 10000
            };

            Task registrationTask = sipRegistrationTransaction.Start();
            Task timer = Task.Delay(2000);

            bool wasCanceled = (await Task.WhenAny(registrationTask, timer) == registrationTask);

            Assert.True(wasCanceled);
        }

        [Fact]
        public async Task Does_Not_Accept_After_Bye()
        {
            SIPParticipant participant = new(string.Empty, new SIPEndPoint(new IPEndPoint(IPAddress.Parse("1.1.1.1"), 1)));
            SIPConnection_Responds_With_2Bye_And_2Accept mockConnection = new SIPConnection_Responds_With_2Bye_And_2Accept();
            TransactionParams transactionParams = new TransactionParams(participant, participant, callId: CallProperties.CreateNewCallId());

            SIPRegistrationTransaction sipRegistrationTransaction = new(mockConnection, transactionParams, NullLoggerFactory.Instance);

            await sipRegistrationTransaction.Start();

            Assert.False(sipRegistrationTransaction.Registered);

            // should only be one. Transaction should not send ACK
            Assert.Equal(1, mockConnection.RequestsSent);
        }
    }
}