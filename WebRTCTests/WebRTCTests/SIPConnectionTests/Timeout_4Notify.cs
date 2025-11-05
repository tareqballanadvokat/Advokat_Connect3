using Microsoft.Extensions.Logging.Abstractions;
using SIPClientTests.SIPConnectionTests.Mocks.SIPTransport;
using SIPClientTests.SIPConnectionTests.Mocks.TransactionFactories;
using SIPClientTests.SIPConnectionTests.Mocks.Transactions;
using SIPSorcery.SIP;
using System.Net;
using WebRTCClient.Transactions.SIP;
using Advokat.WebRTC.Library.SIP.Models;
using Advokat.WebRTC.Library.SIP;

namespace SIPClientTests.SIPConnectionTests
{
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
                ReceiveTimeout = 100,
                PeerRegistrationTimeout = 100,
                RegistrationTimeout = 100,
                ConnectionTimeout = 100
            };

            //_ = Task.Run(sipDialog.Start);

            await sipDialog.Start();

            await Task.Delay(10);

            Assert.True(sipDialog.Registered);
            Assert.False(sipDialog.Connected);

            await Task.Delay(150);

            Assert.False(sipDialog.Connected);
            Assert.False(sipDialog.Registered);
        }

        //[Fact]
        //public async Task Sends_4BYE_For_Registration_After_Timeout()
        //{

        //}


        //[Fact]
        //public async Task Sends_4BYE()
        //{
        //    SIPParticipant participant = new SIPParticipant(string.Empty, new SIPEndPoint(IPEndPoint.Parse("1.1.1.1:1")));

        //    TransactionParams dialogParams = new TransactionParams(
        //        participant,
        //        participant,
        //        sourceTag: "abcdef-source");

        //    SIPConnectionTransaction sipConnection = new SIPConnectionTransaction(
        //        SIPSchemesEnum.sip,
        //        new SIPTransport_Does_Nothing(),
        //        dialogParams,
        //        NullLoggerFactory.Instance);

        //    sipConnection.ReceiveTimeout = 100;

        //    await sipConnection.Start();

        //    Assert.False(sipConnection.Connected);
        //}
    }
}
