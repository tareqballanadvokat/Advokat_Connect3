using Microsoft.Extensions.Logging;
using SIPSignalingServer.Interfaces;
using SIPSignalingServer.Models;
using SIPSignalingServer.Transactions.Interfaces;
using SIPSignalingServer.Transactions.Interfaces.TransactionFactories;
using SIPSignalingServer.Transactions.TransactionFactories;
using SIPSignalingServer.Utils.CustomEventArgs;
using SIPSorcery.SIP;
using System.Diagnostics.CodeAnalysis;
using WebRTCLibrary.SIP;
using WebRTCLibrary.SIP.Interfaces;
using static WebRTCLibrary.Utils.TaskHelpers;

namespace SIPSignalingServer.Transactions
{
    internal class SIPDialog : ServerSideSIPTransaction // ,IAsyncDisposable  
    {
        private readonly ILoggerFactory loggerFactory;

        private readonly ILogger<SIPDialog> logger;

        public new ISIPDialogConfig Config
        {
            get => (ISIPDialogConfig)base.Config;
            set => base.Config = value;
        }

        private SIPRequest InitialRequest { get; set; }

        private SIPEndPoint SignalingServer { get; set; }

        private ISIPRegistry Registry { get; set; }

        private ISIPConnectionPool ConnectionPool { get; set; }

        public ISIPRegistrationTransactionFactory SIPRegistrationTransactionFactory { get; set; }

        private ISIPRegistrationTransaction? SIPRegistrationTransaction { get; set; }

        public ISIPConnectionTransactionFactory SIPConnectionTransactionFactory { get; set; }

        private ISIPConnectionTransaction? SIPConnectionTransaction { get; set; }

        private ISIPTransport Transport { get; set; }

        [MemberNotNullWhen(true, nameof(this.SIPConnectionTransaction))]
        public bool Connected { get => this.SIPConnectionTransaction?.Connected ?? false; }

        public override bool Running
        {
            get => base.Running || this.Connected;
            protected set => base.Running = value;
        }

        private CancellationTokenSource? WaitForPeerCts { get; set; }

        public SIPDialog(
            SIPSchemesEnum sipScheme,
            ISIPTransport transport,
            SIPRequest initialRequest,
            SIPEndPoint signalingServer,
            ISIPRegistry registry,
            ISIPConnectionPool connectionPool,
            ILoggerFactory loggerFactory)
            : base(
                  sipScheme,
                  transport,
                  ServerSideTransactionParams.Empty(),
                  loggerFactory
            )
        {
            this.loggerFactory = loggerFactory;
            this.logger = this.loggerFactory.CreateLogger<SIPDialog>();

            this.Transport = transport;

            this.InitialRequest = initialRequest;
            this.SignalingServer = signalingServer;
            this.Registry = registry;
            this.ConnectionPool = connectionPool;

            this.Config = new SIPDialogConfig();

            this.SIPRegistrationTransactionFactory = new SIPRegistrationTransactionFactory();
            this.SIPConnectionTransactionFactory = new SIPConnectionTransactionFactory();
        }

        protected async override Task StartRunning()
        {
            // TODO: let it pass through to the registrationTransaction?
            if (this.InitialRequest.Method != SIPMethodsEnum.REGISTER)
            {
                // request was not a register request.
                // TODO: dispose this dialog / send event that it should be disposed
                return;
            }

            await base.StartRunning();
            await this.Register();
        }

        private async Task Register()
        {
            // TODO: Check somewhere if the request is valid.
            //       If not return some specific response or don't respond at all
            this.SetSIPRegistrationTransaction();
            await this.SIPRegistrationTransaction.Start(this.Ct);

            await WaitForAsync(
                () => this.SIPRegistrationTransaction.Registered,
                timeOut: this.Config.RegistrationTimeout,
                this.Ct,
                // TODO: interval?
                successCallback: this.WaitForPeer,
                timeoutCallback: this.Stop, // ??
                cancellationCallback: this.Stop // ??
                );

            this.SIPRegistrationTransaction.OnRegistrationFailed -= this.RegistrationFailedListener;
        }

        [MemberNotNull(nameof(this.SIPRegistrationTransaction))]
        private void SetSIPRegistrationTransaction()
        {
            this.SIPRegistrationTransaction = this.SIPRegistrationTransactionFactory.Create(
                this.Connection,
                this.InitialRequest,
                this.SignalingServer,
                this.Registry,
                this.loggerFactory);

            this.Params = this.SIPRegistrationTransaction.Params;

            this.SIPRegistrationTransaction.Config = this.Config;
            this.SIPRegistrationTransaction.OnRegistrationFailed += this.RegistrationFailedListener;
        }

        private async Task RegistrationFailedListener(ISIPRegistrationTransaction sender, FailedRegistrationEventArgs e)
        {
            await this.Stop();
        }

        private async Task WaitForPeer()
        {
            if ((!this.SIPRegistrationTransaction?.Registered ?? false)
                || this.Ct.IsCancellationRequested 
                || (this.WaitForPeerCts != null && this.WaitForPeerCts.IsCancellationRequested))
            {
                await this.Stop();
                return;
            }

            if (this.WaitForPeerCts == null)
            {
                this.SetWaitingForPeerToken();
            }

            SIPRegistration registration = new SIPRegistration(this.Params);
            this.logger.LogDebug("Waiting for peer \"{peerName}\" to register. Caller: {caller}", registration.RemoteUser, registration.SourceParticipant);
            
            await WaitForAsync(
                () => this.Registry.PeerIsRegistered(registration), // TODO: make PeerIsRegistered an event. If registry is a db we shouldn't hit it this often.
                this.WaitForPeerCts.Token,
                this.Ct,
                successCallback: this.Connect,
                timeoutCallback: this.Stop, // peer took too long to register
                cancellationCallback: this.Stop // dialog cancelled
                // TODO: interval?
                );
        }

        private async Task ConnectionTransactionStopped(ISIPTransaction sender)
        {
            sender.TransactionStopped -= this.ConnectionTransactionStopped;
            await this.WaitForPeer();
        }

        [MemberNotNull(nameof(this.WaitForPeerCts))]
        private void SetWaitingForPeerToken()
        {
            // TODO: this token never gets cancelled if timeout is null.
            CancellationTokenSource timeoutToken = this.Config.PeerRegistrationTimeout != null
                ? new CancellationTokenSource((int)this.Config.PeerRegistrationTimeout!)
                : new CancellationTokenSource();

            this.WaitForPeerCts = CancellationTokenSource.CreateLinkedTokenSource(this.Ct, timeoutToken.Token);
        }

        private async Task Connect()
        {
            this.SetSIPConnectonTransaction();

            await this.SIPConnectionTransaction.Start(this.Ct);
            
            await WaitForAsync(() => this.Connected,
                this.Config.ConnectionTimeout,
                this.Ct,
                // TODO: interval?
                successCallback: this.StartICENegotiation,
                timeoutCallback: this.SIPConnectionTransaction.Stop,
                cancellationCallback: this.Stop
                );

            this.SIPConnectionTransaction.OnConnectionFailed -= this.ConnectionFailedListener;
            this.SIPConnectionTransaction.ConnectionLost -= this.ConnectionLostListener;
        }

        [MemberNotNull(nameof(this.SIPConnectionTransaction))]
        private void SetSIPConnectonTransaction()
        {
            this.SIPConnectionTransaction = SIPConnectionTransactionFactory.Create(
                this.SIPScheme,
                this.Transport,
                this.Params,
                this.Registry,
                this.ConnectionPool,
                this.loggerFactory);

            this.SIPConnectionTransaction.StartCseq = this.SIPRegistrationTransaction.CurrentCseq;
            this.SIPConnectionTransaction.Config = this.Config;

            this.SIPConnectionTransaction.OnConnectionFailed += this.ConnectionFailedListener;
            this.SIPConnectionTransaction.ConnectionLost += this.ConnectionLostListener;
            this.SIPConnectionTransaction.TransactionStopped += this.ConnectionTransactionStopped;
        }


        // TODO: Move to Signaling server. Outside of this class.
        private async Task StartICENegotiation()
        {
            if (this.Connected)
            {
                SIPTunnel? tunnel = this.ConnectionPool.GetConnection(this.SIPConnectionTransaction.Params);
                if (tunnel == null)
                {
                    // not connected
                    return;
                }

                if (tunnel.Left.Params == this.SIPConnectionTransaction.Params)
                {
                    // only start negotiation once per connection
                    ICENegotiation iceNegotiation = new ICENegotiation(tunnel, this.loggerFactory);
                    await iceNegotiation.Start();
                }
            }
        }

        protected override void StopRunning()
        {
            base.StopRunning();
            this.WaitForPeerCts?.Cancel();
            this.WaitForPeerCts = null;
        }

        protected async override Task Finish()
        {
            await (this.SIPConnectionTransaction?.Stop() ?? Task.CompletedTask);
            await (this.SIPRegistrationTransaction?.Stop() ?? Task.CompletedTask);
            await base.Finish();
        }

        private async Task ConnectionLostListener(ISIPTransaction sender)
        {
            await this.Stop();
        }

        private async Task ConnectionFailedListener(ISIPConnectionTransaction sender, FailureEventArgs e)
        {
            // TODO: peer is not done unregistering. Starts ConnectionProcess again, shouldn't.
            //       Remove delay
            await Task.Delay(10);

            await this.WaitForPeer();
        }
    }
}
