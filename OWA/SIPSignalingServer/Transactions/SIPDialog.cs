using Microsoft.Extensions.Logging;
using SIPSignalingServer.Models;
using SIPSignalingServer.Utils.CustomEventArgs;
using SIPSorcery.SIP;
using System.Diagnostics.CodeAnalysis;
using static WebRTCLibrary.Utils.TaskHelpers;

namespace SIPSignalingServer.Transactions
{
    internal class SIPDialog : ServerSideSIPTransaction // ,IAsyncDisposable  
    {
        private readonly ILoggerFactory loggerFactory;

        private readonly ILogger<SIPDialog> logger;

        public readonly static int defaultRegistrationTimeout = 3000;

        /// <summary>Timeout for the peer to finish the registration process. Must be set before starting.</summary>
        /// <value>Defualt value specified in the <see cref="defaultRegistrationTimeout"/> field.</value>
        /// <version date="25.04.2025" sb="MAC">Created.</version>
        public int RegistrationTimeout { get; set; } = defaultRegistrationTimeout; // TODO: add flag if it already started - prevent setting then.

        /// <summary>Timeout for the connection process after the registration.
        ///          How long the connection should wait for the peer to register.
        ///          If set to null the connection will wait indeffinetly.
        ///          Must be set before starting.
        ///          
        ///          This could be adjusted in the future and sent by the client in the registration.</summary>
        /// <value>Default value is null.</value>
        /// <version date="25.04.2025" sb="MAC">Created.</version>
        public int? ConnectionTimeout { get; set; } = null; // TODO: add flag if it already started - prevent setting then.

        private SIPRequest InitialRequest {get; set;}

        private SIPRegistry Registry { get; set; }

        private SIPConnectionPool ConnectionPool { get; set; }

        private SIPRegistrationTransaction SIPRegistrationTransaction { get; set; }

        private SIPConnectionTransaction? SIPConnectionTransaction { get; set; }

        private SIPTransport Transport { get; set; }

        public SIPDialog(
            SIPSchemesEnum sipScheme,
            SIPTransport transport,
            SIPRequest initialRequest,
            SIPEndPoint signalingServer,
            SIPRegistry registry,
            SIPConnectionPool connectionPool,
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
            this.Registry = registry;
            this.ConnectionPool = connectionPool;

            this.SIPRegistrationTransaction = new SIPRegistrationTransaction(this.Connection, initialRequest, signalingServer, this.Registry, this.loggerFactory);
            this.Params = this.SIPRegistrationTransaction.Params;
        }

        public async override Task Start()
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

        public override Task Stop()
        {
            throw new NotImplementedException();
        }

        [MemberNotNullWhen(true, nameof(this.SIPConnectionTransaction))]
        public bool IsConnected()
        {
            return this.SIPConnectionTransaction?.IsConnected() ?? false;
        }

        private async Task Register()
        {
            // TODO: Check somewhere if the request is valid.
            //       If not return some specific response or don't respond at all

            this.SIPRegistrationTransaction.SendTimeout = this.SendTimeout;
            this.SIPRegistrationTransaction.ReceiveTimeout = this.ReceiveTimeout;

            this.SIPRegistrationTransaction.OnRegistrationFailed += this.RegistrationFailedListener;

            await this.SIPRegistrationTransaction.Start();

            await WaitForAsync(
                () => this.SIPRegistrationTransaction.Registered,
                timeOut: this.RegistrationTimeout,
                //failureCallback: // StopRegistration , // TODO: do something on timeout
                successCallback: this.Connect);

            this.SIPRegistrationTransaction.OnRegistrationFailed -= this.RegistrationFailedListener;
        }

        private void RegistrationFailedListener(SIPRegistrationTransaction sender, FailedRegistrationEventArgs e)
        {
            // TODO: Dispose on Registation fail / timeout
            //       Stop waiting for registration
        }

        private async Task Connect()
        {            
            this.SIPConnectionTransaction = new SIPConnectionTransaction(
                this.SIPScheme,
                this.Transport, // TODO: Check if we sohuld pass connection
                this.Params,
                this.Registry,
                this.ConnectionPool,
                this.loggerFactory,
                startCSeq: 4);

            this.SIPConnectionTransaction.ReceiveTimeout = this.ReceiveTimeout;
            this.SIPConnectionTransaction.SendTimeout = this.SendTimeout;

            this.SIPConnectionTransaction.OnConnectionFailed += this.ConnectionFailedListener;

            CancellationTokenSource cts = this.ConnectionTimeout == null ? new CancellationTokenSource() : new CancellationTokenSource((int)this.ConnectionTimeout);
            CancellationToken ct = cts.Token;
            // TODO pass ct to ConnectionTransaction. Pass it deeper to KeepAliveDialog?

            await this.SIPConnectionTransaction.Start();

            await WaitForAsync(this.IsConnected,
                ct,
                successCallback: this.StartICENegotiation
                //failureCallback: () => { } // timeout - token got cancelled // TODO: Stop Connection and unregister?
                ); 

            this.SIPConnectionTransaction.OnConnectionFailed -= this.ConnectionFailedListener;
        }

        // TODO: Move to Signaling server. Outside of this class.
        private async Task StartICENegotiation()
        {
            if (this.IsConnected())
            {
                SIPTunnel? connection = this.ConnectionPool.GetConnection(this.SIPConnectionTransaction.Params);
                if (connection == null)
                {
                    // not connected
                    return;
                }

                if (connection.Left.Params == this.SIPConnectionTransaction.Params)
                {
                    // only start negotiation once per connection
                    ICENegotiation iceNegotiation = new ICENegotiation(connection, this.loggerFactory);
                    await iceNegotiation.Start();
                }
            }
        }

        private void ConnectionFailedListener(SIPConnectionTransaction sender, FailureEventArgs e)
        {

        }
    }
}
