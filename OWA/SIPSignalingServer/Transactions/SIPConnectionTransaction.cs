namespace SIPSignalingServer.Transactions
{
    using System.Net.Sockets;
    using Advokat.WebRTC.Library.SIP.Interfaces;
    using Advokat.WebRTC.Library.SIP.Models;
    using Advokat.WebRTC.Library.SIP.Utils;
    using Microsoft.Extensions.Logging;
    using SIPSignalingServer.Interfaces;
    using SIPSignalingServer.Models;
    using SIPSignalingServer.Transactions.Interfaces;
    using SIPSignalingServer.Utils.CustomEventArgs;
    using SIPSorcery.SIP;

    internal class SIPConnectionTransaction : ServerSideSIPTransaction, ISIPConnectionTransaction
    {
        private readonly ILoggerFactory loggerFactory;

        private readonly ILogger<SIPConnectionTransaction> logger;

        public bool Connected { get; private set; }

        public override bool Running
        {
            get => this.Connecting || this.Connected;
            protected set => this.Connecting = value;
        }

        private bool Connecting
        {
            get => base.Running;
            set => base.Running = value;
        }

        private bool ConnectionAcknowledged { get; set; }

        private bool NewCallParametersSent { get; set; }

        private SIPRegistration Registration { get; set; }

        private ISIPRegistry Registry { get; set; }

        private ISIPConnectionPool ConnectionPool { get; set; }

        private ServerSideTransactionParams ServerSideTransactionParams { get; set; }

        private SIPMessageRelay MessageRelay { get; set; }

        private SIPTunnel? SIPTunnel { get; set; }

        public event ISIPConnectionTransaction.ConnectionFailedDelegate? OnConnectionFailed;

        private TaskCompletionSource ConnectionTask { get; set; }

        private CancellationTokenSource? AckTimeoutCts { get; set; }

        public SIPConnectionTransaction(
            SIPSchemesEnum sipScheme,
            ISIPTransport transport,
            ServerSideTransactionParams signalingServerTransactionParams,
            ISIPRegistry registry,
            ISIPConnectionPool connectionPool,
            ILoggerFactory loggerFactory)
            : base(
                  sipScheme,
                  transport,
                  new ServerSideTransactionParams(
                     signalingServerTransactionParams.RemoteParticipant,
                     signalingServerTransactionParams.ClientParticipant,
                     remoteTag: null, // explicitly set to null - gets set when connection is found - fromTag of peer
                     clientTag: signalingServerTransactionParams.ClientTag,
                     callId: null), // explicitly set to null - gets set when connecting
                  loggerFactory)
        {
            this.loggerFactory = loggerFactory;
            this.logger = this.loggerFactory.CreateLogger<SIPConnectionTransaction>();

            this.ServerSideTransactionParams = signalingServerTransactionParams;
            // TODO: Don't pass Registry, pass registration and peerRegistration
            this.Registry = registry;
            this.ConnectionPool = connectionPool;

            this.Registration = new SIPRegistration(this.ServerSideTransactionParams);

            this.MessageRelay = new SIPMessageRelay(this.Connection, this.Params, this.loggerFactory);

            this.ConnectionTask = new TaskCompletionSource();
            this.ConnectionTask.TrySetResult();
        }

        public override async ValueTask DisposeAsync()
        {
            await base.DisposeAsync().ConfigureAwait(false);
            await this.MessageRelay.DisposeAsync().ConfigureAwait(false);
        }

        protected override void SetInitalParametes(CancellationToken? newCt)
        {
            base.SetInitalParametes(newCt);
            this.ConnectionTask = new TaskCompletionSource();
            this.Ct.Register(async () => await this.CanceledAsync());
        }

        protected async override Task StartRunning()
        {
            await base.StartRunning();

            if (!this.Registry.IsRegistered(this.Registration))
            {
                await this.ConnectionFailed(SIPResponseStatusCodesEnum.InternalServerError, "Cannot connect. Not registered.", connectionLost: true);
                return;
            }

            if (!this.Registry.PeerIsRegistered(this.Registration))
            {
                await this.ConnectionFailed(SIPResponseStatusCodesEnum.PreconditionFailure, "Peer not registered.");
                return;
            }

            if (this.Ct.IsCancellationRequested)
            {
                await this.CanceledAsync();
                return;
            }

            // TOOD: Throws TaskCanceledException when cancelled
            await this.ConnectAsync();
        }

        protected override void StopRunning()
        {
            base.StopRunning();

            this.Connection.SIPRequestReceived -= this.ListenForAck;
            this.Connection.SIPRequestReceived -= this.ListenForConnectionBye;

            this.Connected = false;
            this.ConnectionAcknowledged = false;

            this.AckTimeoutCts?.Dispose();
            this.AckTimeoutCts = null;

            if (this.SIPTunnel != null)
            {
                this.SIPTunnel.ConnectionStateChanged -= this.SIPTunnelConnectionStateChanged;
            }

            this.ConnectionPool.ConnectionRemoved -= this.Disconnected;
            this.MessageRelay.RelayStopped -= this.Disconnected;
        }

        protected async override Task Finish()
        {
            await base.Finish();

            if (this.SIPTunnel != null)
            {
                await this.ConnectionPool.Disconnect(this.SIPTunnel);
                await this.SIPTunnel.DisposeAsync();
                this.SIPTunnel = null;
            }
            else
            {
                await this.MessageRelay.Stop();
                await this.ConnectionPool.Disconnect(this.MessageRelay);
            }

            await this.SendBye();

            this.NewCallParametersSent = false;
            this.Params.SourceTag = null;
            this.ConnectionTask.TrySetResult();
        }

        private async Task ConnectionFailed(SIPResponseStatusCodesEnum statusCode = SIPResponseStatusCodesEnum.None, string? message = null, bool connectionLost = false)
        {
            // TODO: add some identifier for request that failed. (caller ip/name/tag, remote name/tag)
            this.logger.LogInformation("Connection failed {statusCode}. {message}", statusCode, message);

            FailureEventArgs eventArgs = new FailureEventArgs()
            {
                StatusCode = statusCode,
                Message = message,
            };

            // TODO Make ConnecitonFailed event with Eventargs -> connectionLost - one event
            if (connectionLost)
            {
                await this.InvokeConnectionLost();
            }

            await (this.OnConnectionFailed?.Invoke(this, eventArgs) ?? Task.CompletedTask);
            await this.Stop();
        }

        private async Task CanceledAsync()
        {
            if (this.Running && !this.Connected)
            {
                this.ConnectionTask.TrySetCanceled();

                // TODO: should be a connectionLost?
                await this.ConnectionFailed(SIPResponseStatusCodesEnum.InternalServerError, "Connection cancelled.", connectionLost: true);
            }
        }

        private async Task ConnectAsync()
        {
            await this.SetRemoteTag();
            this.CreateConnection();

            this.Connection.SIPRequestReceived += this.ListenForAck;
            this.Connection.SIPRequestReceived += this.ListenForConnectionBye;

            // SendNotifyRequest handles failurestate itself.
            bool notifySent = await this.SendConnectionReadyNotifyAsync();
            if (!notifySent)
            {
                // sending notify failed
                return;
            }

            this.AckTimeoutCts = new CancellationTokenSource(this.Config.ReceiveTimeout);
            this.AckTimeoutCts.Token.Register(async () => await this.AckTimeout());

            await this.ConnectionTask.Task;
        }

        private async Task SetRemoteTag()
        {
            SIPRegistration? peerRegistration = this.Registry.GetPeerRegistration(this.Registration);

            if (peerRegistration == null)
            {
                // TODO: schould we send registered bye?
                await this.ConnectionFailed(SIPResponseStatusCodesEnum.NotFound, "Could not set remote tag, peer not registered.");
                return;
            }

            this.Params.RemoteTag = peerRegistration.FromTag;
        }

        private void CreateConnection()
        {
            // adds connection, does not start it yet
            // TODO: Can throw argumentexception
            this.SIPTunnel = this.ConnectionPool.Connect(this.MessageRelay);
            this.SIPTunnel.ConnectionStateChanged += this.SIPTunnelConnectionStateChanged;

            this.ConnectionPool.ConnectionRemoved += this.Disconnected;
        }

        private async void SIPTunnelConnectionStateChanged(object? sender, SIPTunnelConnectionStateEventArgs e)
        {
            if (sender is SIPTunnel && this.SIPTunnel == sender)
            {
                if (e.Connected && !this.Connected)
                {
                    bool success = await this.SendConnectionEstablishedNotify();
                    if (!success)
                    {
                        // sending failed. Failurestate already handled.
                        return;
                    }

                    this.ConnectionEstablished();
                }
                else if (!e.Connected && (this.Connected || this.Connecting))
                {
                    await this.Stop();
                }
            }
        }

        private async void Disconnected(object? sender, SIPConnectionPoolEventArgs e)
        {
            if (sender is ISIPConnectionPool && e.Tunnel == this.SIPTunnel)
            {
                await this.Stop();
            }
        }

        private async void Disconnected(object? sender, EventArgs e)
        {
            if (sender is SIPMessageRelay messageRelay && messageRelay == this.MessageRelay)
            {
                await this.Stop();
            }
        }

        private async Task<bool> SendConnectionReadyNotifyAsync()
        {
            SIPRequest notifyRequest = this.GetNotifyRequest();

            this.CurrentCseq++;
            SocketError result;
            try
            {
                result = await this.Connection.SendSIPRequest(notifyRequest, this.Ct);
            }
            catch (OperationCanceledException ex)
            {
                // request not sent
                this.CurrentCseq--;

                await this.CanceledAsync();
                return false;
            }

            if (result != SocketError.Success)
            {
                // request not sent

                // TODO: map socketerror to SIPResponseStatusCodesEnum
                this.CurrentCseq--;
                await this.ConnectionFailed(SIPResponseStatusCodesEnum.InternalServerError, "Sending connection Notify failed.", connectionLost: true);
                return false;
            }

            this.NewCallParametersSent = true;
            return true;
        }

        private SIPRequest GetNotifyRequest()
        {
            SIPHeaderParams headerParams = this.GetHeaderParams(cSeq: this.CurrentCseq);
            return SIPHelper.GetRequest(this.SIPScheme, SIPMethodsEnum.NOTIFY, headerParams);
        }

        private async Task ListenForAck(SIPEndPoint localEndPoint, SIPEndPoint remoteEndPoint, SIPRequest request)
        {
            if (request.Method != SIPMethodsEnum.ACK)
            {
                await this.ConnectionFailed(SIPResponseStatusCodesEnum.MethodNotAllowed, "Request was not an ACK request.");
                return;
            }

            if (request.Header.CSeq != this.CurrentCseq)
            {
                await this.ConnectionFailed(SIPResponseStatusCodesEnum.BadRequest, "Request header was invalid.");
                return;
            }

            if (this.Ct.IsCancellationRequested)
            {
                // TODO: should be a connectionLost?
                await this.ConnectionFailed(SIPResponseStatusCodesEnum.RequestTerminated, "Operation cancelled", connectionLost: true);
                return;
            }

            this.ConnectionAcknowledged = true;
            this.CurrentCseq++; // 3

            this.Connection.SIPRequestReceived -= this.ListenForAck;
            await this.StartConnectionAsync();
        }

        private async Task ListenForConnectionBye(SIPEndPoint localEndPoint, SIPEndPoint remoteEndPoint, SIPRequest request)
        {
            if (request.Method != SIPMethodsEnum.BYE)
            {
                return;
            }

            this.CurrentCseq = request.Header.CSeq + 1;
            await this.Stop();
        }

        private async Task StartConnectionAsync()
        {
            this.MessageRelay.RelayStopped += this.Disconnected;
            await this.MessageRelay.Start(); // TODO: Pass a ct? - should be a general ct for the entire connection
        }

        private void ConnectionEstablished()
        {
            this.Connected = true;
            this.Connecting = false;

            // TODO: event - connected
            this.ConnectionTask.TrySetResult();
        }

        private async Task<bool> SendConnectionEstablishedNotify()
        {
            SIPRequest notifyRequest = this.GetNotifyRequest();
            this.CurrentCseq++;

            SocketError result;
            try
            {
                result = await this.Connection.SendSIPRequest(notifyRequest, this.Ct);
            }
            catch (OperationCanceledException ex)
            {
                // request not sent
                this.CurrentCseq--;

                await this.CanceledAsync();
                return false;
            }

            if (result != SocketError.Success)
            {
                // request not sent
                this.CurrentCseq--;

                await this.ConnectionFailed(SIPResponseStatusCodesEnum.InternalServerError, "Sending connection Notify failed.", connectionLost: true);
                return false;
            }

            return true;
        }

        private async Task AckTimeout()
        {
            if (this.Connecting && !this.ConnectionAcknowledged && !this.Connected)
            {
                await this.ConnectionFailed(SIPResponseStatusCodesEnum.RequestTimeout, "Peer took to long to respond to connection notify. Timeout.", connectionLost: true);
            }
        }

        private async Task SendBye()
        {
            if (!this.NewCallParametersSent)
            {
                // No need to send bye. Client would not listen for these parameters anyway
                return;
            }

            SIPHeaderParams headerParams = this.GetHeaderParams(this.CurrentCseq);
            headerParams.Reason = "CONNECTION";
            SocketError result;

            result = await this.Connection.SendSIPRequest(SIPMethodsEnum.BYE, headerParams, CancellationToken.None);

            if (result != SocketError.Success)
            {
                // Bye failed.
                // TODO: What to do?
            }
        }
    }
}
