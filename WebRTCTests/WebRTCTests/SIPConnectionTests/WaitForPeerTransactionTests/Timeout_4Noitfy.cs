using Advokat.WebRTC.Library.SIP;
using Advokat.WebRTC.Library.SIP.Models;
using Microsoft.Extensions.Logging.Abstractions;
using SIPClientTests.SIPConnectionTests.Mocks.SIPTransport;
using SIPSorcery.SIP;
using System.Net;
using WebRTCClient.Transactions.SIP;

namespace SIPClientTests.SIPConnectionTests.WaitForPeerTransactionTests
{
    [Collection("Sequential")]
    public class Timeout_4Noitfy
    {
        [Fact]
        public async Task Peer_Is_Not_Registered()
        {
            SIPParticipant participant = new SIPParticipant(string.Empty, new SIPEndPoint(IPEndPoint.Parse("1.1.1.1:1")));

            WaitForPeerTransaction waitForPeerTransaction = new WaitForPeerTransaction(
                SIPSchemesEnum.sip,
                new SIPTransport_Does_Nothing(),
                new TransactionParams(participant, participant), // ??
                NullLoggerFactory.Instance
                );

            waitForPeerTransaction.Config = new SIPDialogConfig()
            {
                ReceiveTimeout = 100,
                PeerRegistrationTimeout = 100,
                RegistrationTimeout = 100,
                ConnectionTimeout = 100
            };

            await waitForPeerTransaction.Start();

            Assert.False(waitForPeerTransaction.PeerRegistered);
        }
    }
}
