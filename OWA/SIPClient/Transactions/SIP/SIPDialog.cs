using Microsoft.Extensions.Logging;
using SIPSorcery.SIP;
using System.Diagnostics.CodeAnalysis;
using System.Net.Sockets;
using WebRTCClient.Transactions.SIP.Interfaces;
using WebRTCClient.Transactions.SIP.Interfaces.TransactionFactories;
using WebRTCClient.Transactions.SIP.TransactionFactories;
using WebRTCLibrary.SIP.Interfaces;
using WebRTCLibrary.SIP.Models;

using static WebRTCLibrary.Utils.TaskHelpers;

namespace WebRTCClient.Transactions.SIP
{
    internal class SIPDialog : WebRTCLibrary.SIP.SIPTransaction, ISIPMessager
    {
        private readonly ILoggerFactory loggerFactory;

        private readonly ILogger<SIPDialog> logger;

        public event ISIPMessager.RequestReceivedDelegate? OnRequestReceived;

        public event ISIPMessager.ResponseReceivedDelegate? OnResponseReceived;

        public static readonly int defaultRegistrationTimeout = 1000; // TODO: Find suitable default registration timeout

        public static readonly int defaultConnectionTimeout = 3000;

        public int RegistrationTimeout { get; set; } = defaultRegistrationTimeout;

        public int ConnectionTimeout { get; set; } = defaultConnectionTimeout;

        [MemberNotNullWhen(true, nameof(this.SIPRegistrationTransaction))]
        public bool Registered { get => this.SIPRegistrationTransaction?.Registered ?? false; }

        [MemberNotNullWhen(true, nameof(this.SIPConnectionTransaction))]
        public bool Connected { get => SIPConnectionTransaction?.Connected ?? false; }

        public ISIPRegistrationTransactionFactory SIPRegistrationTransactionFactory { get; set; }

        private ISIPRegistrationTransaction? SIPRegistrationTransaction { get; set; }

        private ISIPConnectionTransaction? SIPConnectionTransaction { get; set; }

        public ISIPConnectionTransactionFactory SIPConnectionTransactionFactory { get; set; }

        private SIPKeepAlive SIPKeepAlive { get; set; }

        private ISIPTransport Transport { get; set; }

        public SIPDialog(SIPSchemesEnum sipScheme, ISIPTransport transport, SIPParticipant sourceParticipant, SIPParticipant remoteParticipant, ILoggerFactory loggerFactory)
            : base(
                  sipScheme,
                  transport,
                  new TransactionParams(sourceParticipant, remoteParticipant, callId:CallProperties.CreateNewCallId()),
                  loggerFactory)
        {
            this.loggerFactory = loggerFactory;
            this.logger = this.loggerFactory.CreateLogger<SIPDialog>();

            // default factories, TODO: get them passed in ctor?
            this.SIPConnectionTransactionFactory = new SIPConnectionTransactionFactory(this.loggerFactory);
            this.SIPRegistrationTransactionFactory = new SIPRegistrationTransactionFactory(this.loggerFactory);

            this.Transport = transport;

            this.SIPKeepAlive = new SIPKeepAlive(this.Connection, this.Params, this.loggerFactory);
        }

        public override async Task Start()
        {
            this.SetSIPRegistrationTransaction();
            await this.SIPRegistrationTransaction.Start();

            await WaitForAsync(
                () => this.Registered,
                this.RegistrationTimeout,
                ct: CancellationToken.None, // TODO: implement cancellation logic
                successCallback: this.RegistationSuccessful,
                timeoutCallback: async () => { }); // TODO: what to do on registering failure / timeout
        }

        //public override async Task Stop()
        //{
        //    // TODO: assign new callId? Otherwise we could get another start with the same call id
        //    throw new NotImplementedException();

        //    // dont use this, use unregister
        //    //await this.SIPRegistrationTransaction.Stop();

        //    //await this.SIPRegistrationTransaction.Unregister();

        //}

        private async Task RegistationSuccessful()
        {
            this.SetSIPConnectionTransaction();

            await this.SIPConnectionTransaction.Start();
            await this.SIPKeepAlive.Start(); // TODO: stop dialog on stop / unregister
                                             //       Also, should keep alive send pings starting from peer or from server
                                             //       Is not needed if there is no timeout for our signaling server in firewall

            // TODO: create a seperate timeout for connection found. This timeout is both for finding peer and connecting
            await WaitForAsync(
                () => this.Connected,
                this.ConnectionTimeout, // TODO: Get suitable timeout for connection - keep in mind to wait for remote to register. have a timeout at all?
                ct: CancellationToken.None, // TODO: implement cancellation logic
                successCallback: async () => this.ConnectionSuccessful(),
                cancellationCallback: this.CancelConnection, // TODO: disconnect accordingly and unregister
                timeoutCallback: this.Unregister
                );
        }

        private void ConnectionSuccessful()
        {
            this.logger.LogInformation(
                "SIP Connection established. {caller} - {remote}",
                this.Params.SourceParticipant.Name,
                this.Params.RemoteParticipant.Name);
        }

        private async Task Unregister()
        {
            await (this.SIPRegistrationTransaction?.Unregister() ?? Task.CompletedTask);
        }

        private async Task CancelConnection()
        {
            await (this.SIPConnectionTransaction?.Disconnect() ?? Task.CompletedTask);
            await this.Unregister();
        }

        public async Task<SocketError> SendSIPRequest(SIPMethodsEnum method, string message, string contentType, int cSeq)
        {
            if (!this.Connected)
            {
                return SocketError.NotConnected;
            }

            return await this.SIPConnectionTransaction.SendSIPRequest(method, message, contentType, cSeq);
        }

        public async Task<SocketError> SendSIPResponse(SIPResponseStatusCodesEnum statusCode, string message, string contentType, int cSeq)
        {
            if (!this.Connected)
            {
                return SocketError.NotConnected;
            }

            return await this.SIPConnectionTransaction.SendSIPResponse(statusCode, message, contentType, cSeq);
        }

        [MemberNotNull(nameof(this.SIPRegistrationTransaction))]

        private void SetSIPRegistrationTransaction()
        {
            this.SIPRegistrationTransaction = this.SIPRegistrationTransactionFactory.Create(this.Connection, this.Params);
            this.SIPRegistrationTransaction.SendTimeout = this.SendTimeout;
            this.SIPRegistrationTransaction.ReceiveTimeout = this.ReceiveTimeout;
        }

        [MemberNotNull(nameof(this.SIPConnectionTransaction))]
        private void SetSIPConnectionTransaction()
        {
            TransactionParams dialogParams = new TransactionParams(
                this.Params.SourceParticipant,
                this.Params.RemoteParticipant,
                sourceTag: this.Params.SourceTag);

            this.SIPConnectionTransaction = this.SIPConnectionTransactionFactory.Create(SIPScheme, this.Transport, dialogParams);
            this.SIPConnectionTransaction.SendTimeout = this.SendTimeout;
            this.SIPConnectionTransaction.ReceiveTimeout = this.ReceiveTimeout;

            this.SIPConnectionTransaction.OnRequestReceived += RequestRecieved;
            this.SIPConnectionTransaction.OnResponseReceived += ResponseRecieved;
        }

        private async Task RequestRecieved(ISIPMessager sender, SIPRequest sipRequest)
        {
            await (this.OnRequestReceived?.Invoke(this, sipRequest) ?? Task.CompletedTask);
        }

        private async Task ResponseRecieved(ISIPMessager sender, SIPResponse sipResponse)
        {
            await (this.OnResponseReceived?.Invoke(this, sipResponse) ?? Task.CompletedTask);
        }
    }
}
