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
    public class Invalid_4Notify
    {
        [Fact]
        public async Task Does_Not_Accept_Invalid_Caller_Name()
        {
            SIPParticipant participant = new SIPParticipant(string.Empty, new SIPEndPoint(IPEndPoint.Parse("1.1.1.1:1")));

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

            TransactionParams connectionTransactionParams = new TransactionParams(
                callerParticipant,
                remoteParticipant,
                sourceTag: CallProperties.CreateNewTag()
                );

            WaitForPeerTransaction waitForPeerTransaction = new WaitForPeerTransaction(
                SIPSchemesEnum.sip,
                mockTransport,
                connectionTransactionParams,
                NullLoggerFactory.Instance
                );

            waitForPeerTransaction.Config = new SIPDialogConfig()
            {
                ReceiveTimeout = 100,
                PeerRegistrationTimeout = 100,
                RegistrationTimeout = 100,
                ConnectionTimeout = 100
            };

            waitForPeerTransaction.StartCseq = 4;

            await waitForPeerTransaction.Start();

            TransactionParams invalidConnectionTransactionParams = new TransactionParams(
                new SIPParticipant("invalid-caller-name", callerEndpoint),
                connectionTransactionParams.RemoteParticipant,
                sourceTag: connectionTransactionParams.SourceTag,
                remoteTag: CallProperties.CreateNewTag(),
                callId: CallProperties.CreateNewCallId()
                );

            await mockTransport.SendNotify(invalidConnectionTransactionParams, 4);
            await Task.Delay(10);

            Assert.False(waitForPeerTransaction.PeerRegistered);
        }


        // TODO: Check if we should validate Endpoint --> dynamic ip address? Shouldn't change while connecting though...
        [Fact]
        public async Task Does_Not_Accept_Invalid_Caller_Endpoint()
        {
            SIPParticipant participant = new SIPParticipant(string.Empty, new SIPEndPoint(IPEndPoint.Parse("1.1.1.1:1")));

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

            TransactionParams connectionTransactionParams = new TransactionParams(
                callerParticipant,
                remoteParticipant,
                sourceTag: CallProperties.CreateNewTag()
                );

            WaitForPeerTransaction waitForPeerTransaction = new WaitForPeerTransaction(
                SIPSchemesEnum.sip,
                mockTransport,
                connectionTransactionParams,
                NullLoggerFactory.Instance
                );

            waitForPeerTransaction.Config = new SIPDialogConfig()
            {
                ReceiveTimeout = 100,
                PeerRegistrationTimeout = 100,
                RegistrationTimeout = 100,
                ConnectionTimeout = 100
            };

            waitForPeerTransaction.StartCseq = 4;

            await waitForPeerTransaction.Start();

            TransactionParams invalidConnectionTransactionParams = new TransactionParams(
                new SIPParticipant(callerParticipant.Name, new SIPEndPoint(new IPEndPoint(IPAddress.Parse("126.3.54.4"), 300))),
                connectionTransactionParams.RemoteParticipant,
                sourceTag: connectionTransactionParams.SourceTag,
                remoteTag: CallProperties.CreateNewTag(),
                callId: CallProperties.CreateNewCallId()
                );

            await mockTransport.SendNotify(invalidConnectionTransactionParams, 4);
            await Task.Delay(10);

            Assert.False(waitForPeerTransaction.PeerRegistered);
        }

        [Fact]
        public async Task Does_Not_Accept_Invalid_Caller_Tag()
        {
            SIPParticipant participant = new SIPParticipant(string.Empty, new SIPEndPoint(IPEndPoint.Parse("1.1.1.1:1")));

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

            TransactionParams connectionTransactionParams = new TransactionParams(
                callerParticipant,
                remoteParticipant,
                sourceTag: CallProperties.CreateNewTag()
                );

            WaitForPeerTransaction waitForPeerTransaction = new WaitForPeerTransaction(
                SIPSchemesEnum.sip,
                mockTransport,
                connectionTransactionParams,
                NullLoggerFactory.Instance
                );

            waitForPeerTransaction.Config = new SIPDialogConfig()
            {
                ReceiveTimeout = 100,
                PeerRegistrationTimeout = 100,
                RegistrationTimeout = 100,
                ConnectionTimeout = 100
            };

            waitForPeerTransaction.StartCseq = 4;

            await waitForPeerTransaction.Start();

            TransactionParams invalidConnectionTransactionParams = new TransactionParams(
                connectionTransactionParams.SourceParticipant,
                connectionTransactionParams.RemoteParticipant,
                sourceTag: "invalid-caller-tag",
                remoteTag: CallProperties.CreateNewTag(),
                callId: CallProperties.CreateNewCallId()
                );

            await mockTransport.SendNotify(invalidConnectionTransactionParams, 4);
            await Task.Delay(10);

            Assert.False(waitForPeerTransaction.PeerRegistered);
        }

        [Fact]
        public async Task Does_Not_Accept_Invalid_Remote_Name()
        {
            SIPParticipant participant = new SIPParticipant(string.Empty, new SIPEndPoint(IPEndPoint.Parse("1.1.1.1:1")));

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

            TransactionParams connectionTransactionParams = new TransactionParams(
                callerParticipant,
                remoteParticipant,
                sourceTag: CallProperties.CreateNewTag()
                );

            WaitForPeerTransaction waitForPeerTransaction = new WaitForPeerTransaction(
                SIPSchemesEnum.sip,
                mockTransport,
                connectionTransactionParams,
                NullLoggerFactory.Instance
                );

            waitForPeerTransaction.Config = new SIPDialogConfig()
            {
                ReceiveTimeout = 100,
                PeerRegistrationTimeout = 100,
                RegistrationTimeout = 100,
                ConnectionTimeout = 100
            };

            waitForPeerTransaction.StartCseq = 4;

            await waitForPeerTransaction.Start();

            TransactionParams invalidConnectionTransactionParams = new TransactionParams(
                connectionTransactionParams.SourceParticipant,
                new SIPParticipant("invalid-remote-name", remoteEndpoint),
                sourceTag: connectionTransactionParams.SourceTag,
                remoteTag: CallProperties.CreateNewTag(),
                callId: CallProperties.CreateNewCallId()
                );

            await mockTransport.SendNotify(invalidConnectionTransactionParams, 4);
            await Task.Delay(10);

            Assert.False(waitForPeerTransaction.PeerRegistered);
        }

        // TODO: Check if we should validate Endpoint --> dynamic ip address? Shouldn't change while connecting though...
        [Fact]
        public async Task Does_Not_Accept_Invalid_Remote_Endpoint()
        {
            SIPParticipant participant = new SIPParticipant(string.Empty, new SIPEndPoint(IPEndPoint.Parse("1.1.1.1:1")));

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

            TransactionParams connectionTransactionParams = new TransactionParams(
                callerParticipant,
                remoteParticipant,
                sourceTag: CallProperties.CreateNewTag()
                );

            WaitForPeerTransaction waitForPeerTransaction = new WaitForPeerTransaction(
                SIPSchemesEnum.sip,
                mockTransport,
                connectionTransactionParams,
                NullLoggerFactory.Instance
                );

            waitForPeerTransaction.Config = new SIPDialogConfig()
            {
                ReceiveTimeout = 100,
                PeerRegistrationTimeout = 100,
                RegistrationTimeout = 100,
                ConnectionTimeout = 100
            };

            waitForPeerTransaction.StartCseq = 4;

            await waitForPeerTransaction.Start();

            TransactionParams invalidConnectionTransactionParams = new TransactionParams(
                connectionTransactionParams.SourceParticipant,
                new SIPParticipant(connectionTransactionParams.RemoteParticipant.Name, new SIPEndPoint(new IPEndPoint(IPAddress.Parse("224.4.13.231"), 4042))),
                sourceTag: connectionTransactionParams.SourceTag,
                remoteTag: CallProperties.CreateNewTag(),
                callId: CallProperties.CreateNewCallId()
                );

            await mockTransport.SendNotify(invalidConnectionTransactionParams, 4);
            await Task.Delay(10);

            Assert.False(waitForPeerTransaction.PeerRegistered);
        }

        [Theory]
        [InlineData(1)]
        [InlineData(2)]
        [InlineData(0)]
        [InlineData(-1)]
        [InlineData(int.MaxValue)]
        [InlineData(3)]
        [InlineData(5)]
        [InlineData(6)]
        public async Task Does_Not_Accept_Invalid_Cseq(int cSeq)
        {
            SIPParticipant participant = new SIPParticipant(string.Empty, new SIPEndPoint(IPEndPoint.Parse("1.1.1.1:1")));

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

            TransactionParams connectionTransactionParams = new TransactionParams(
                callerParticipant,
                remoteParticipant,
                sourceTag: CallProperties.CreateNewTag()
                );

            WaitForPeerTransaction waitForPeerTransaction = new WaitForPeerTransaction(
                SIPSchemesEnum.sip,
                mockTransport,
                connectionTransactionParams,
                NullLoggerFactory.Instance
                );

            waitForPeerTransaction.Config = new SIPDialogConfig()
            {
                ReceiveTimeout = 100,
                PeerRegistrationTimeout = 100,
                RegistrationTimeout = 100,
                ConnectionTimeout = 100
            };

            waitForPeerTransaction.StartCseq = 4;

            await waitForPeerTransaction.Start();

            TransactionParams invalidConnectionTransactionParams = new TransactionParams(
                connectionTransactionParams.SourceParticipant,
                connectionTransactionParams.RemoteParticipant,
                sourceTag: connectionTransactionParams.SourceTag,
                remoteTag: CallProperties.CreateNewTag(),
                callId: CallProperties.CreateNewCallId()
                );

            await mockTransport.SendNotify(invalidConnectionTransactionParams, cSeq);
            await Task.Delay(10);

            Assert.False(waitForPeerTransaction.PeerRegistered);
        }


        [Fact]
        public async Task Accepts_Valid_Notify()
        {
            SIPParticipant participant = new SIPParticipant(string.Empty, new SIPEndPoint(IPEndPoint.Parse("1.1.1.1:1")));

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

            TransactionParams connectionTransactionParams = new TransactionParams(
                callerParticipant,
                remoteParticipant,
                sourceTag: CallProperties.CreateNewTag(),
                remoteTag: CallProperties.CreateNewTag(),
                callId: CallProperties.CreateNewCallId()
                );

            WaitForPeerTransaction waitForPeerTransaction = new WaitForPeerTransaction(
                SIPSchemesEnum.sip,
                mockTransport,
                connectionTransactionParams,
                NullLoggerFactory.Instance
                );

            waitForPeerTransaction.Config = new SIPDialogConfig()
            {
                ReceiveTimeout = 100,
                PeerRegistrationTimeout = 100,
                RegistrationTimeout = 100,
                ConnectionTimeout = 100
            };

            waitForPeerTransaction.StartCseq = 4;

            await waitForPeerTransaction.Start();

            await mockTransport.SendNotify(connectionTransactionParams, 4);
            await Task.Delay(10);

            Assert.True(waitForPeerTransaction.PeerRegistered);
        }
    }
}
