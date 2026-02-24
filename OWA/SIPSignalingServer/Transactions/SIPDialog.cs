// <copyright file="SIPDialog.cs" company="Advokat GmbH">
// Copyright (c) Advokat GmbH. Alle Rechte vorbehalten.
// </copyright>

namespace SIPSignalingServer.Transactions
{
    using System.Diagnostics.CodeAnalysis;
    using Advokat.WebRTC.Library.SIP;
    using Advokat.WebRTC.Library.SIP.Interfaces;
    using Microsoft.Extensions.Logging;
    using SIPSignalingServer.Interfaces;
    using SIPSignalingServer.Models;
    using SIPSignalingServer.Transactions.Interfaces;
    using SIPSignalingServer.Transactions.Interfaces.TransactionFactories;
    using SIPSignalingServer.Transactions.TransactionFactories;
    using SIPSignalingServer.Utils.CustomEventArgs;
    using SIPSorcery.SIP;
    using static Advokat.WebRTC.Library.Utils.TaskHelpers;

    internal class SIPDialog : ServerSideSIPTransaction
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

        private readonly List<ISIPConnectionTransaction> SIPConnectionTransactions = [];

        private ISIPTransport Transport { get; set; }

        // TODO: not correct - temporary now with connection list. Reevaluate
        public bool Connected { get => this.SIPConnectionTransactions.FirstOrDefault()?.Connected ?? false; }

        public override bool Running
        {
            get => base.Running || this.Connected;
            protected set => base.Running = value;
        }

        private bool multipleConnections;

        private bool WaitingForPeer { get; set; }

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
                  loggerFactory)
        {
            this.loggerFactory = loggerFactory;
            this.logger = this.loggerFactory.CreateLogger<SIPDialog>();

            this.Transport = transport;

            // TODO: should actually be passed in the StartRunning method?
            this.InitialRequest = initialRequest;
            this.SignalingServer = signalingServer;
            this.Registry = registry;
            this.ConnectionPool = connectionPool;

            this.Config = new SIPDialogConfig();

            this.SIPRegistrationTransactionFactory = new SIPRegistrationTransactionFactory();
            this.SIPConnectionTransactionFactory = new SIPConnectionTransactionFactory();

            // TODO: Check params
            this.multipleConnections = this.Params.RemoteParticipant == null;
        }

        protected async override Task StartRunning()
        {
            // TODO: let it pass through to the registrationTransaction?
            if (this.InitialRequest.Method != SIPMethodsEnum.REGISTER)
            {
                // request was not a register request.
                // TODO: dispose this dialog / send event that it should be disposed
                // TODO: Failed? Should this check be in the constructor?
                await this.Stop();
                return;
            }

            await base.StartRunning();

            await this.StopExistingConnectionAsync();
            await this.Register();
        }

        private async Task StopExistingConnectionAsync()
        {
            // TODO: A replay attack of the first Register will close the connection. - FIX
            //       Check if the tags and callid was used before maybe?

            // TODO: Get Registration by from and to name
            SIPRegistration? oldRegistration = this.Registry.GetRegisteredObject(this.InitialRequest.Header.From.FromName);

            // TODO: Send bye for the old registration
            if (oldRegistration != null)
            {
                this.Registry.Unregister(oldRegistration);
            }

            // TODO: use this.Params?
            IEnumerable<SIPTunnel> oldTunnels = this.ConnectionPool.GetConnections(this.InitialRequest.Header.From.FromName, this.InitialRequest.Header.To.ToName);

            foreach (SIPTunnel oldTunnel in oldTunnels)
            {
               await oldTunnel.Disconnect();
            }

            // TODO: Close direct connection as well?
        }

        private async Task Register()
        {
            // TODO: Check somewhere if the request is valid.
            //       If not return some specific response or don't respond at all
            this.SetSIPRegistrationTransaction();
            await this.SIPRegistrationTransaction.Start(this.Ct);

            if (this.SIPRegistrationTransaction.Registered)
            {
                await this.WaitForPeer();
            }

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
            this.SIPRegistrationTransaction.TransactionStopped += this.OnUnregisterd;

        }

        private async Task RegistrationFailedListener(ISIPRegistrationTransaction sender, FailedRegistrationEventArgs e)
        {
            await this.Stop();
        }

        private async Task OnUnregisterd(ISIPTransaction sender)
        {
            if (!this.Connected)
            {
                await this.Stop();
            }
        }

        private async Task WaitForPeer()
        {
            // TODO Reevaluate this check
            if ((!this.SIPRegistrationTransaction?.Registered ?? false)
                || this.Ct.IsCancellationRequested
                || (this.WaitForPeerCts != null && this.WaitForPeerCts.IsCancellationRequested))
            {
                await this.Stop();
                return;
            }

            if (this.WaitingForPeer)
            {
                // already waiting
                return;
            }

            SIPRegistration registration = new SIPRegistration(this.Params);

            List<SIPRegistration>? peerRegistrations = this.Registry.GetPeerRegistration(registration);
            if (peerRegistrations.Count > 0)
            {
                foreach (SIPRegistration peerRegistration in peerRegistrations)
                {
                    await this.Connect(peerRegistration);
                }

                if (!this.multipleConnections)
                {
                    return;
                }
            }

            this.logger.LogDebug("Waiting for peer \"{peerName}\" to register. Caller: {caller}", registration.RemoteUser, registration.SourceParticipant);

            this.WaitingForPeer = true;
            this.Registry.Registered += this.OnPeerRegistered;

            if (this.WaitForPeerCts == null)
            {
                this.SetWaitingForPeerToken();
            }
        }

        private async void OnPeerRegistered(object? sender, RegistrationEventArgs e)
        {
            if (this.WaitForPeerCts?.Token.IsCancellationRequested ?? true)
            {
                this.WaitingForPeer = false;
                this.Registry.Registered -= this.OnPeerRegistered;

                // timed out
                return;
            }

            // Check if registration is the peer for this dialog
            if (e.Registration.IsPeer(this.Params))
            {
                await this.Connect(e.Registration);
            }
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
            this.WaitForPeerCts.Token.Register(async () => await this.Stop()); // TODO: create a canceled method
        }

        private async Task Connect(SIPRegistration peerRegistration)
        {
            if (this.Ct.IsCancellationRequested)
            {
                await this.Stop();
                return;
            }

            if (!this.multipleConnections)
            {
                this.WaitingForPeer = false;
                this.Registry.Registered -= this.OnPeerRegistered;
            }

            // TODO: create overload - pass params directly
            SIPRegistration? registration = this.Registry.GetRegisteredObject(this.Params.ClientParticipant.Name);
            if (registration == null)
            {
                // not registerd - do not start new connection
                return;
            }

            ISIPConnectionTransaction connectionTransaction = this.GetSIPConnectonTransaction(registration, peerRegistration);

            // TODO: lock
            this.SIPConnectionTransactions.Add(connectionTransaction);
            await connectionTransaction.Start(this.Ct);

            await WaitForAsync(() => connectionTransaction.Connected,
                this.Config.ConnectionTimeout,
                this.Ct,
                // TODO: interval?
                successCallback: this.ConnectionEstablished,
                timeoutCallback: connectionTransaction.Stop,
                cancellationCallback: this.Stop
                );

            connectionTransaction.OnConnectionFailed -= this.ConnectionFailedListener;
            connectionTransaction.ConnectionLost -= this.ConnectionLostListener;
        }

        private ISIPConnectionTransaction GetSIPConnectonTransaction(SIPRegistration registration, SIPRegistration peerRegistration)
        {
            ISIPConnectionTransaction connectionTransaction = SIPConnectionTransactionFactory.Create(
                this.SIPScheme,
                this.Transport,
                this.Params, // TODO: Construct Params for connection here
                registration,
                peerRegistration,
                this.ConnectionPool,
                this.loggerFactory);

            connectionTransaction.StartCseq = this.SIPRegistrationTransaction.CurrentCseq;
            connectionTransaction.Config = this.Config;

            connectionTransaction.OnConnectionFailed += this.ConnectionFailedListener;
            connectionTransaction.ConnectionLost += this.ConnectionLostListener;
            connectionTransaction.TransactionStopped += this.ConnectionTransactionStopped;

            return connectionTransaction;
        }

        private async Task ConnectionEstablished()
        {
            // TODO: Info could be sensitive if we use names as credentials.
            this.logger.LogInformation("SIP Connection established. {caller} - {remote}",
                this.Params.SourceParticipant.Name,
                this.Params.RemoteParticipant.Name);
        }

        protected override void StopRunning()
        {
            base.StopRunning();

            this.WaitingForPeer = false;
            this.Registry.Registered -= this.OnPeerRegistered;
            this.WaitForPeerCts?.Cancel();
            this.WaitForPeerCts?.Dispose();
            this.WaitForPeerCts = null;
        }

        protected async override Task Finish()
        {
            foreach (ISIPConnectionTransaction connectionTransaction in this.SIPConnectionTransactions)
            {
                await connectionTransaction.Stop();
                await connectionTransaction.DisposeAsync();
            }

            this.SIPConnectionTransactions.Clear();

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
