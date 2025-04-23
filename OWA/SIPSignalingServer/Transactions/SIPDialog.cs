using Microsoft.Extensions.Logging;
using SIPSignalingServer.Models;
using SIPSignalingServer.Utils.CustomEventArgs;
using SIPSorcery.SIP;
using System.Diagnostics;
using System.Diagnostics.CodeAnalysis;
using static WebRTCLibrary.Utils.TaskHelpers;

namespace SIPSignalingServer.Transactions
{
    internal class SIPDialog : ServerSideSIPTransaction // ,IAsyncDisposable  
    {
        private readonly ILoggerFactory loggerFactory;

        private readonly ILogger<SIPDialog> logger;

        private bool Registered { get => this.SIPRegistrationTransaction.Registered; } // TODO: replace with check if registration is in registry?

        private SIPRequest InitialRequest {get; set;}

        private SIPRegistry Registry { get; set; }

        private SIPConnectionPool ConnectionPool { get; set; }

        private SIPTransport Transport { get; set; }

        private SIPRegistrationTransaction SIPRegistrationTransaction { get; set; }

        private SIPConnectionTransaction? SIPConnectionTransaction { get; set; }

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

            this.InitialRequest = initialRequest;
            this.Registry = registry;
            this.ConnectionPool = connectionPool;
            this.Transport = transport;

            this.SIPRegistrationTransaction = new SIPRegistrationTransaction(this.SIPScheme, transport, initialRequest, signalingServer, this.Registry, this.loggerFactory);
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
            
            this.SIPRegistrationTransaction.OnRegistrationFailed += this.RegistrationFailedListener;

            await this.SIPRegistrationTransaction.Start();

            await WaitForAsync(
                () => this.Registered,
                timeOut: this.ReceiveTimeout,
                //failureCallback: Task.CompletedTask , // TODO: do something on timeout
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
                this.Transport,
                this.Params,
                this.Registry,
                this.ConnectionPool,
                this.loggerFactory,
                startCSeq: 4);

            // Add listeners
            this.SIPConnectionTransaction.OnConnectionFailed += this.ConnectionFailedListener;

            CancellationTokenSource cts = new CancellationTokenSource(); // TODO: add some sort of timeout for connection?
            CancellationToken ct = cts.Token;
            // TODO pass ct to ConnectionTransaction? Pass it deeper to KeepAliveDialog?

            await this.SIPConnectionTransaction.Start();

            await WaitForAsync(this.IsConnected,
                ct,
                successCallback: this.StartICENegotiation
                //failureCallback: () => { } // timeout - token got cancelled
                ); 

            this.SIPConnectionTransaction.OnConnectionFailed -= this.ConnectionFailedListener;
        }

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
