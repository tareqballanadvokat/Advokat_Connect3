using Microsoft.Extensions.Logging;
using SIPSignalingServer.Interfaces;
using SIPSignalingServer.Models;
using SIPSignalingServer.Transactions.Interfaces;
using SIPSignalingServer.Transactions.Interfaces.TransactionFactories;
using SIPSignalingServer.Transactions.TransactionFactories;
using SIPSignalingServer.Utils.CustomEventArgs;
using SIPSorcery.SIP;
using System.Diagnostics.CodeAnalysis;
using WebRTCLibrary.SIP.Interfaces;
using static WebRTCLibrary.Utils.TaskHelpers;

namespace SIPSignalingServer.Transactions
{
    internal class SIPDialog : ServerSideSIPTransaction // ,IAsyncDisposable  
    {
        private readonly ILoggerFactory loggerFactory;

        private readonly ILogger<SIPDialog> logger;

        public readonly static int defaultRegistrationTimeout = 3000;

        /// <summary>Timeout for the client to finish the registration process. Must be set before starting.</summary>
        /// <value>Defualt value specified in the <see cref="defaultRegistrationTimeout"/> field.</value>
        /// <version date="25.04.2025" sb="MAC">Created.</version>
        public int RegistrationTimeout { get; set; } = defaultRegistrationTimeout; // TODO: add flag if it already started - prevent setting then.

        public readonly static int defaultConnectionTimeout = 3000;

        /// <summary>Timeout for the connection process after client and peer registration.
        ///          Specify how long the connection process should take before it is cancelled.
        ///          Must be set before starting.
        ///          
        ///          This could be adjusted in the future and sent by the client in the registration.</summary>
        /// <value>Default value is null.</value>
        /// <version date="25.04.2025" sb="MAC">Created.</version>
        public int? ConnectionTimeout { get; set; } = null; // TODO: add flag if it already started - prevent setting then.

        /// <summary>Timeout for the peer to register.
        ///          How long to wait after client registration was successful for the peer to connect.
        ///          If set to null the connection will wait indeffinetly.
        ///          Must be set before starting.
        ///
        ///          This could be adjusted in the future and sent by the client in the registration.</summary>
        /// <value>Default value is null.</value>
        /// <version date="04.06.2025" sb="MAC">Created.</version>
        public int? PeerRegistrationTimeout { get; set; } = null; // TODO: add flag if it already started - prevent setting then.
                                                                  // TODO: Should we remove the timeout completely? let the client determine it's own timeout and stop responding after that.
                                                                  //       If the keep alive dialog is held we keep wait for the peer indefinetly

        private SIPRequest InitialRequest { get; set; }

        private SIPEndPoint SignalingServer { get; set; }

        private ISIPRegistry Registry { get; set; }

        private ISIPConnectionPool ConnectionPool { get; set; }

        public ISIPRegistrationTransactionFactory SIPRegistrationTransactionFactory { get; set; }

        private ISIPRegistrationTransaction? SIPRegistrationTransaction { get; set; }

        private SIPConnectionTransaction? SIPConnectionTransaction { get; set; }

        private ISIPTransport Transport { get; set; }

        private bool WaitingForPeer { get; set; }

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

            this.SIPRegistrationTransactionFactory = new SIPRegistrationTransactionFactory();
        }

        protected async override Task StartRunning()
        {
        }

        // TODO: Use passed token
        public async override Task Start(CancellationToken? ct = null)
        {
            // TODO: let it pass through to the registrationTransaction?
            if (this.InitialRequest.Method != SIPMethodsEnum.REGISTER)
            {
                // request was not a register request.
                // TODO: dispose this dialog / send event that it should be disposed
                return;
            }

            await this.Register();
        }

        //public override Task Stop()
        //{
        //    throw new NotImplementedException();
        //}

        [MemberNotNullWhen(true, nameof(this.SIPConnectionTransaction))]
        public bool IsConnected()
        {
            return this.SIPConnectionTransaction?.IsConnected() ?? false;
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
        }

        private async Task Register()
        {
            // TODO: Check somewhere if the request is valid.
            //       If not return some specific response or don't respond at all
            this.SetSIPRegistrationTransaction();
            this.Params = this.SIPRegistrationTransaction.Params;

            this.SIPRegistrationTransaction.SendTimeout = this.SendTimeout;
            this.SIPRegistrationTransaction.ReceiveTimeout = this.ReceiveTimeout;

            this.SIPRegistrationTransaction.OnRegistrationFailed += this.RegistrationFailedListener;

            await this.SIPRegistrationTransaction.Start();

            await WaitForAsync(
                () => this.SIPRegistrationTransaction.Registered,
                timeOut: this.RegistrationTimeout,
                CancellationToken.None, // TODO: implement cancellation logic
                // TODO: interval?
                //failureCallback: // StopRegistration , // TODO: do something on timeout
                successCallback: this.WaitForPeer);

            this.SIPRegistrationTransaction.OnRegistrationFailed -= this.RegistrationFailedListener;
        }

        private async Task RegistrationFailedListener(ISIPRegistrationTransaction sender, FailedRegistrationEventArgs e)
        {
            // TODO: get real cseq
            //       check if we should always unregister
            //await (this.SIPRegistrationTransaction?.Unregister(4) ?? Task.CompletedTask);
            // TODO: Dispose on Registation fail / timeout
            //       Stop waiting for registration
        }

        private async Task WaitForPeer()
        {
            this.WaitingForPeer = true;

            SIPRegistration registration = new SIPRegistration(this.Params);
            this.logger.LogDebug("Waiting for peer \"{peerName}\" to register. Caller: {caller}", registration.RemoteUser, registration.SourceParticipant);

            // TODO: add own timeout for waiting for peer
            CancellationTokenSource peerRegisteringCts = new CancellationTokenSource();


            await WaitForAsync(
                () => this.Registry.PeerIsRegistered(registration), // TODO: make PeerIsRegistered an event. If registry is a db we shouldn't hit it this often.
                peerRegisteringCts.Token,
                CancellationToken.None, // TODO: implement cancellation logic
                                        // TODO: interval?
                successCallback: this.Connect);
        }

        private async Task Connect()
        {
            // TODO: can be set in constructor?
            this.SIPConnectionTransaction = new SIPConnectionTransaction(
                this.SIPScheme,
                this.Transport,
                this.Params,
                this.Registry,
                this.ConnectionPool,
                this.loggerFactory);

            this.SIPConnectionTransaction.StartCseq = 4;
            this.SIPConnectionTransaction.ReceiveTimeout = this.ReceiveTimeout;
            this.SIPConnectionTransaction.SendTimeout = this.SendTimeout;

            this.SIPConnectionTransaction.OnConnectionFailed += this.ConnectionFailedListener;

            CancellationTokenSource connectionTimeoutCts = this.ConnectionTimeout == null ? new CancellationTokenSource() : new CancellationTokenSource((int)this.ConnectionTimeout);
            CancellationToken connectionTimeoutCt = connectionTimeoutCts.Token;
            // TODO pass ct to ConnectionTransaction. Pass it deeper to KeepAliveDialog?

            await this.SIPConnectionTransaction.Start(connectionTimeoutCt);

            await WaitForAsync(this.IsConnected,
                connectionTimeoutCt,
                CancellationToken.None, // TODO: add cancelation logic
                // TODO: interval?
                successCallback: this.StartICENegotiation,
                timeoutCallback: this.SIPConnectionTransaction.Disconnect
                //failureCallback: () => { } // timeout - token got cancelled // TODO: Stop Connection and unregister?
                ); 

            this.SIPConnectionTransaction.OnConnectionFailed -= this.ConnectionFailedListener;
        }

        // TODO: Move to Signaling server. Outside of this class.
        private async Task StartICENegotiation()
        {
            if (this.IsConnected())
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

        private async Task ConnectionFailedListener(SIPConnectionTransaction sender, FailureEventArgs e)
        {
            await (this.SIPRegistrationTransaction?.Unregister() ?? Task.CompletedTask);
        }
    }
}
