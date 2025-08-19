using Microsoft.Extensions.Logging;
using SIPSorcery.SIP;
using System.Diagnostics.CodeAnalysis;
using System.Net.Sockets;
using WebRTCClient.Transactions.SIP.Interfaces;
using WebRTCClient.Transactions.SIP.Interfaces.TransactionFactories;
using WebRTCClient.Transactions.SIP.TransactionFactories;
using WebRTCLibrary.SIP;
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

        public new ISIPDialogConfig Config
        {
            get => (ISIPDialogConfig)base.Config;
            set => base.Config = value;
        }

        [MemberNotNullWhen(true, nameof(this.SIPRegistrationTransaction))]
        public bool Registered { get => this.SIPRegistrationTransaction?.Registered ?? false; }

        [MemberNotNullWhen(true, nameof(this.SIPConnectionTransaction))]
        public bool Connected { get => SIPConnectionTransaction?.Connected ?? false; }

        public ISIPRegistrationTransactionFactory SIPRegistrationTransactionFactory { get; set; }

        private ISIPRegistrationTransaction? SIPRegistrationTransaction { get; set; }

        private ISIPConnectionTransaction? SIPConnectionTransaction { get; set; }

        public ISIPConnectionTransactionFactory SIPConnectionTransactionFactory { get; set; }

        public WaitForPeerTransaction? WaitForPeerTransaction { get; set; }

        //private SIPKeepAlive SIPKeepAlive { get; set; }

        public SIPDialog(SIPSchemesEnum sipScheme, ISIPTransport transport, SIPParticipant sourceParticipant, SIPParticipant remoteParticipant, ILoggerFactory loggerFactory)
            : base(
                  sipScheme,
                  transport,
                  new TransactionParams(sourceParticipant, remoteParticipant, callId:CallProperties.CreateNewCallId()),
                  loggerFactory)
        {
            this.loggerFactory = loggerFactory;
            this.logger = this.loggerFactory.CreateLogger<SIPDialog>();

            this.Config = new SIPDialogConfig();

            // default factories
            this.SIPConnectionTransactionFactory = new SIPConnectionTransactionFactory(this.loggerFactory);
            this.SIPRegistrationTransactionFactory = new SIPRegistrationTransactionFactory(this.loggerFactory);

            //this.SIPKeepAlive = new SIPKeepAlive(this.Connection, this.Params, this.loggerFactory);
        }

        protected async override Task StartRunning()
        {
            await base.StartRunning();
            this.SetSIPRegistrationTransaction();
            await this.SIPRegistrationTransaction.Start(this.Ct); // updates the Config object if the signaling server sends differing values

            await WaitForAsync(
                () => this.Registered,
                this.Config.RegistrationTimeout, // this cannot be set by the signaling server
                ct: this.Ct,
                successCallback: this.RegistationSuccessful,
                cancellationCallback: this.Stop,
                timeoutCallback: this.Stop
                );
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
            this.SetWaitForPeerTransaction();

            CancellationTokenSource peerRegistrationTimouetToken = this.Config.PeerRegistrationTimeout == null
                ? new CancellationTokenSource()
                : new CancellationTokenSource((int)this.Config.PeerRegistrationTimeout);

            CancellationTokenSource peerRegistrationToken = CancellationTokenSource.CreateLinkedTokenSource(this.Ct, peerRegistrationTimouetToken.Token);

            await this.WaitForPeerTransaction.Start(peerRegistrationToken.Token);
            //await this.SIPKeepAlive.Start(this.Ct); // TODO: stop dialog on stop / unregister
            //                                        //       Also, should keep alive send pings starting from peer or from server
            //                                        //       Is not needed if there is no timeout for our signaling server in firewall

            await WaitForAsync(
                () => this.WaitForPeerTransaction.PeerRegistered,
                peerRegistrationTimouetToken.Token,
                ct: this.Ct,
                successCallback: this.PeerRegistered,
                cancellationCallback: this.Stop,
                timeoutCallback: this.Stop
                );
        }

        private async Task PeerRegistered()
        {
            this.SetSIPConnectionTransaction();
            await this.SIPConnectionTransaction.Start(this.Ct);

            await WaitForAsync(
                () => this.Connected,
                this.Config.ConnectionTimeout,
                ct: this.Ct,
                successCallback: async () => this.ConnectionSuccessful(),
                cancellationCallback: this.Stop,
                timeoutCallback: this.Stop
                );
        }

        private void ConnectionSuccessful()
        {
            this.logger.LogInformation(
                "SIP Connection established. {caller} - {remote}",
                this.Params.SourceParticipant.Name,
                this.Params.RemoteParticipant.Name);
        }

        protected async override Task Finish()
        {
            await base.Finish();
            await (this.SIPConnectionTransaction?.Stop() ?? Task.CompletedTask);
            await (this.WaitForPeerTransaction?.Stop() ?? Task.CompletedTask);
            await (this.SIPRegistrationTransaction?.Stop() ?? Task.CompletedTask);

            // TODO: reset
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

        private async Task RequestRecieved(ISIPMessager sender, SIPRequest sipRequest)
        {
            await (this.OnRequestReceived?.Invoke(this, sipRequest) ?? Task.CompletedTask);
        }

        private async Task ResponseRecieved(ISIPMessager sender, SIPResponse sipResponse)
        {
            await (this.OnResponseReceived?.Invoke(this, sipResponse) ?? Task.CompletedTask);
        }

        [MemberNotNull(nameof(this.SIPRegistrationTransaction))]
        private void SetSIPRegistrationTransaction()
        {
            this.SIPRegistrationTransaction = this.SIPRegistrationTransactionFactory.Create(this.Connection, this.Params);
            this.SIPRegistrationTransaction.Config = this.Config;
        }

        [MemberNotNull(nameof(this.SIPConnectionTransaction))]
        private void SetSIPConnectionTransaction()
        {
            this.SIPConnectionTransaction = this.SIPConnectionTransactionFactory.Create(SIPScheme, this.Connection.Transport, this.WaitForPeerTransaction.Params);

            this.SIPConnectionTransaction.StartCseq = this.WaitForPeerTransaction.CurrentCseq;
            this.SIPConnectionTransaction.Config = this.Config;

            this.SIPConnectionTransaction.OnRequestReceived += RequestRecieved;
            this.SIPConnectionTransaction.OnResponseReceived += ResponseRecieved;
        }

        [MemberNotNull(nameof(this.WaitForPeerTransaction))]
        private void SetWaitForPeerTransaction()
        {
            TransactionParams dialogParams = new TransactionParams(
                this.Params.SourceParticipant,
                this.Params.RemoteParticipant,
                sourceTag: this.Params.SourceTag);

            this.WaitForPeerTransaction = new WaitForPeerTransaction(this.SIPScheme, this.Connection.Transport, dialogParams, this.loggerFactory);
            this.WaitForPeerTransaction.Config = this.Config;
            this.WaitForPeerTransaction.StartCseq = this.SIPRegistrationTransaction.CurrentCseq;
        }
    }
}
