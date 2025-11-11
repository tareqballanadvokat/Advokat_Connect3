using Advokat.WebRTC.Library.SIP;
using Advokat.WebRTC.Library.SIP.Models;
using Microsoft.Extensions.Logging.Abstractions;
using SIPClientTests.SIPConnectionTests.Mocks.SIPTransport;
using SIPClientTests.SIPConnectionTests.Mocks.TransactionFactories;
using SIPClientTests.SIPConnectionTests.Mocks.Transactions;
using SIPSorcery.SIP;
using System.Net;
using WebRTCClient.Transactions.SIP;

namespace SIPClientTests.SIPConnectionTests.SIPDialogTests
{
    [Collection("Sequential")]
    public class Invalid_6Notify
    {
        [Fact]
        public async Task Does_Not_Accept_Invalid_Caller_Name()
        {
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
                ReceiveTimeout = 100,
                PeerRegistrationTimeout = 100,
                RegistrationTimeout = 100,
                ConnectionTimeout = 100
            };

            _ = Task.Run(async () => await sipDialog.Start());
            await Task.Delay(20);

            await mockTransport.SendNotify(connectionTransactionParams, 4);
            await Task.Delay(10);

            TransactionParams invalidConnectionTransactionParams = new TransactionParams(
                new SIPParticipant("invalid-caller-name", callerEndpoint),
                connectionTransactionParams.RemoteParticipant,
                sourceTag: connectionTransactionParams.SourceTag,
                remoteTag: connectionTransactionParams.RemoteTag,
                callId: connectionTransactionParams.CallId
                );

            await mockTransport.SendNotify(invalidConnectionTransactionParams, 6);

            await Task.Delay(10);
            Assert.False(sipDialog.Connected);
        }

        // TODO: Check if we should validate Endpoint --> dynamic ip address? Shouldn't change while connecting though...
        [Fact]
        public async Task Does_Not_Accept_Invalid_Caller_Endpoint()
        {
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
                ReceiveTimeout = 100,
                PeerRegistrationTimeout = 100,
                RegistrationTimeout = 100,
                ConnectionTimeout = 100
            };

            _ = Task.Run(async () => await sipDialog.Start());
            await Task.Delay(20);

            await mockTransport.SendNotify(connectionTransactionParams, 4);
            await Task.Delay(10);

            TransactionParams invalidConnectionTransactionParams = new TransactionParams(
                new SIPParticipant(callerParticipant.Name, new SIPEndPoint(new IPEndPoint(IPAddress.Parse("126.3.54.4"), 300))),
                connectionTransactionParams.RemoteParticipant,
                sourceTag: connectionTransactionParams.SourceTag,
                remoteTag: connectionTransactionParams.RemoteTag,
                callId: connectionTransactionParams.CallId
                );

            await mockTransport.SendNotify(invalidConnectionTransactionParams, 6);

            await Task.Delay(10);
            Assert.False(sipDialog.Connected);
        }

        [Fact]
        public async Task Does_Not_Accept_Invalid_Caller_Tag()
        {
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
                ReceiveTimeout = 100,
                PeerRegistrationTimeout = 100,
                RegistrationTimeout = 100,
                ConnectionTimeout = 100
            };

            _ = Task.Run(async () => await sipDialog.Start());
            await Task.Delay(20);

            await mockTransport.SendNotify(connectionTransactionParams, 4);
            await Task.Delay(10);

            TransactionParams invalidConnectionTransactionParams = new TransactionParams(
                connectionTransactionParams.SourceParticipant,
                connectionTransactionParams.RemoteParticipant,
                sourceTag: "invalid-caller-tag",
                remoteTag: connectionTransactionParams.RemoteTag,
                callId: connectionTransactionParams.CallId
                );

            await mockTransport.SendNotify(invalidConnectionTransactionParams, 6);

            await Task.Delay(10);
            Assert.False(sipDialog.Connected);
        }

        [Fact]
        public async Task Does_Not_Accept_Invalid_Remote_Name()
        {
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
                ReceiveTimeout = 100,
                PeerRegistrationTimeout = 100,
                RegistrationTimeout = 100,
                ConnectionTimeout = 100
            };

            _ = Task.Run(async () => await sipDialog.Start());
            await Task.Delay(20);

            await mockTransport.SendNotify(connectionTransactionParams, 4);
            await Task.Delay(10);

            TransactionParams invalidConnectionTransactionParams = new TransactionParams(
                connectionTransactionParams.SourceParticipant,
                new SIPParticipant("invalid-remote-name", remoteEndpoint),
                sourceTag: connectionTransactionParams.SourceTag,
                remoteTag: connectionTransactionParams.RemoteTag,
                callId: connectionTransactionParams.CallId
                );

            await mockTransport.SendNotify(invalidConnectionTransactionParams, 6);

            await Task.Delay(10);
            Assert.False(sipDialog.Connected);
        }

        // TODO: Check if we should validate Endpoint --> dynamic ip address? Shouldn't change while connecting though...
        [Fact]
        public async Task Does_Not_Accept_Invalid_Remote_Endpoint()
        {
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
                ReceiveTimeout = 100,
                PeerRegistrationTimeout = 100,
                RegistrationTimeout = 100,
                ConnectionTimeout = 100
            };

            _ = Task.Run(async () => await sipDialog.Start());
            await Task.Delay(20);

            await mockTransport.SendNotify(connectionTransactionParams, 4);
            await Task.Delay(10);

            TransactionParams invalidConnectionTransactionParams = new TransactionParams(
                connectionTransactionParams.SourceParticipant,
                new SIPParticipant(connectionTransactionParams.RemoteParticipant.Name, new SIPEndPoint(new IPEndPoint(IPAddress.Parse("224.4.13.231"), 4042))),
                sourceTag: connectionTransactionParams.SourceTag,
                remoteTag: connectionTransactionParams.RemoteTag,
                callId: connectionTransactionParams.CallId
                );

            await mockTransport.SendNotify(invalidConnectionTransactionParams, 6);

            await Task.Delay(10);
            Assert.False(sipDialog.Connected);
        }

        [Fact]
        public async Task Does_Not_Accept_Invalid_Remote_Tag()
        {
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
                ReceiveTimeout = 100,
                PeerRegistrationTimeout = 100,
                RegistrationTimeout = 100,
                ConnectionTimeout = 100
            };

            _ = Task.Run(async () => await sipDialog.Start());
            await Task.Delay(20);

            await mockTransport.SendNotify(connectionTransactionParams, 4);
            await Task.Delay(10);

            TransactionParams invalidConnectionTransactionParams = new TransactionParams(
                connectionTransactionParams.SourceParticipant,
                connectionTransactionParams.RemoteParticipant,
                sourceTag: connectionTransactionParams.SourceTag,
                remoteTag: "invalid-remote-tag",
                callId: connectionTransactionParams.CallId
                );

            await mockTransport.SendNotify(invalidConnectionTransactionParams, 6);

            await Task.Delay(10);
            Assert.False(sipDialog.Connected);
        }

        [Fact]
        public async Task Does_Not_Accept_Invalid_CallId()
        {
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
                ReceiveTimeout = 100,
                PeerRegistrationTimeout = 100,
                RegistrationTimeout = 100,
                ConnectionTimeout = 100
            };

            _ = Task.Run(async () => await sipDialog.Start());
            await Task.Delay(20);

            await mockTransport.SendNotify(connectionTransactionParams, 4);
            await Task.Delay(10);

            TransactionParams invalidConnectionTransactionParams = new TransactionParams(
                connectionTransactionParams.SourceParticipant,
                connectionTransactionParams.RemoteParticipant,
                sourceTag: connectionTransactionParams.SourceTag,
                remoteTag: connectionTransactionParams.RemoteTag,
                callId: "invalid-callId"
                );

            await mockTransport.SendNotify(invalidConnectionTransactionParams, 6);

            await Task.Delay(10);
            Assert.False(sipDialog.Connected);
        }

        [Theory]
        [InlineData(1)]
        [InlineData(2)]
        [InlineData(0)]
        [InlineData(-1)]
        [InlineData(int.MaxValue)]
        [InlineData(3)]
        [InlineData(5)]
        [InlineData(7)]
        public async Task Does_Not_Accept_Invalid_Cseq(int cSeq)
        {
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
                ReceiveTimeout = 100,
                PeerRegistrationTimeout = 100,
                RegistrationTimeout = 100,
                ConnectionTimeout = 100
            };

            _ = Task.Run(async () => await sipDialog.Start());
            await Task.Delay(20);

            await mockTransport.SendNotify(connectionTransactionParams, 4);
            await Task.Delay(10);

            await mockTransport.SendNotify(connectionTransactionParams, cSeq);

            await Task.Delay(10);
            Assert.False(sipDialog.Connected);
        }


        [Fact]
        public async Task Accepts_Valid_Notify()
        {
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
                ReceiveTimeout = 100,
                PeerRegistrationTimeout = 100,
                RegistrationTimeout = 100,
                ConnectionTimeout = 100
            };

            _ = Task.Run(async () => await sipDialog.Start());
            await Task.Delay(20);

            await mockTransport.SendNotify(connectionTransactionParams, 4);
            await Task.Delay(10);

            await mockTransport.SendNotify(connectionTransactionParams, 6);

            await Task.Delay(10);
            Assert.True(sipDialog.Connected);
        }
    }
}
