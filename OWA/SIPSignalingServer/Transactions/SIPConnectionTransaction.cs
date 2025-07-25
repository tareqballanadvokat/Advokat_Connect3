using Microsoft.Extensions.Logging;
using SIPSignalingServer.Interfaces;
using SIPSignalingServer.Models;
using SIPSignalingServer.Transactions.Interfaces;
using SIPSignalingServer.Utils.CustomEventArgs;
using SIPSorcery.SIP;
using System.Net.Sockets;
using WebRTCLibrary.SIP.Interfaces;
using WebRTCLibrary.SIP.Models;
using WebRTCLibrary.SIP.Utils;

using static WebRTCLibrary.Utils.TaskHelpers;

namespace SIPSignalingServer.Transactions
{
    internal class SIPConnectionTransaction : ServerSideSIPTransaction, ISIPConnectionTransaction
    {
        private readonly ILoggerFactory loggerFactory;

        private readonly ILogger<SIPConnectionTransaction> logger;

        private bool Connecting
        {
            get => base.Running;
            set => base.Running = value;
        }

        public bool Connected { get; private set; }

        private bool ConnectionAcknowledged { get; set; }

        public override bool Running
        {
            get => this.Connecting || this.Connected;
            protected set => this.Connecting = value;
        }

        private bool NewCallParametersSent { get; set; }

        private SIPRegistration Registration { get; set; }

        private ISIPRegistry Registry { get; set; }

        private ISIPConnectionPool ConnectionPool { get; set; }

        private ServerSideTransactionParams ServerSideTransactionParams { get; set; }

        private readonly SIPMessageRelay messageRelay;

        private SIPTunnel? SIPTunnel { get; set; }

        public event ISIPConnectionTransaction.ConnectionFailedDelegate? OnConnectionFailed;

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
            this.Registry = registry;
            this.ConnectionPool = connectionPool;

            this.Registration = new SIPRegistration(this.ServerSideTransactionParams);

            this.messageRelay = new SIPMessageRelay(this.Connection, this.Params, this.loggerFactory);
        }

        protected async override Task StartRunning()
        {
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

            await this.Connect();
        }

        private async Task Connect()
        {
            if (this.Ct.IsCancellationRequested)
            {
                // TODO: should be a connectionLost?
                await this.ConnectionFailed(SIPResponseStatusCodesEnum.InternalServerError, "Connection cancelled.", connectionLost: true);
                return;
            }

            await this.SetRemoteTag();
            await this.CreateConnection();

            this.Connection.SIPRequestReceived += this.ListenForAck;

            // SendNotifyRequest handles failurestate itself.
            bool notifySent = await this.SendConnectionReadyNotify();
            if (!notifySent)
            {
                // sending notify failed
                return;
            }

            await WaitForAsync(
                () => this.ConnectionAcknowledged,
                timeOut: this.Config.ReceiveTimeout,
                this.Ct,
                successCallback: this.StartConnection,
                timeoutCallback: async () =>
                    await this.ConnectionFailed(
                        SIPResponseStatusCodesEnum.RequestTimeout,

                        // TODO: I think this should not be a connectionLost
                        "Client took to long to send acknowledge to connection notify. Timeout.", connectionLost: true),
                cancellationCallback: async () =>

                    // TODO: should be a connectionLost?
                    await this.ConnectionFailed(SIPResponseStatusCodesEnum.RequestTerminated, "Operation cancelled.",
                    connectionLost: true));

            this.Connection.SIPRequestReceived -= this.ListenForAck;
        }

        private SIPRequest GetNotifyRequest()
        {
            SIPHeaderParams headerParams = this.GetHeaderParams(cSeq: this.CurrentCseq);
            return SIPHelper.GetRequest(this.SIPScheme, SIPMethodsEnum.NOTIFY, headerParams);
        }

        private async Task<bool> SendConnectionReadyNotify()
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

                // TODO: should be a connectionLost?
                await this.ConnectionFailed(SIPResponseStatusCodesEnum.RequestTerminated, "Operation cancelled.", connectionLost: true);
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
            //this.ConnectionPool.ConnectionEstablished += this.ConnectionEstablished;
        }

        private async Task ConnectionEstablished(SIPTunnel tunnel)
        //private async Task ConnectionEstablished(ISIPConnectionPool sender, SIPTunnel tunnel)
        {
            if (tunnel == this.SIPTunnel && (tunnel.Left == this.messageRelay || tunnel.Right == this.messageRelay))
            {
                lock (this.isRunningLock)
                {
                    this.Connected = true;
                    this.Connecting = false;
                }
            }
        }

        private async Task SendConnectionEstablishedNotify()
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

                // TODO: should be a connectionLost?
                await this.ConnectionFailed(SIPResponseStatusCodesEnum.RequestTerminated, "Operation cancelled.", connectionLost: true);
                return;
            }

            if (result != SocketError.Success)
            {
                // request not sent
                this.CurrentCseq--;

                await this.ConnectionFailed(SIPResponseStatusCodesEnum.InternalServerError, "Sending connection Notify failed.", connectionLost: true);
                return;
            }
        }

        private async Task AckTimeout()
        {
            await this.ConnectionFailed(SIPResponseStatusCodesEnum.RequestTimeout, "Peer took to long to respond to connection notify. Timeout.");
        }

        private async Task CreateConnection()
        {

            //this.ConnectionPool.ConnectionEstablished

            // adds connection, does not start it
            this.SIPTunnel = await this.ConnectionPool.Connect(this.messageRelay);
            this.SIPTunnel.ConnectionStopped += this.Disconnected;
            this.SIPTunnel.ConnectionEstablished += this.ConnectionEstablished;

            this.ConnectionPool.ConnectionRemoved += this.Disconnected;
        }

        private async Task StartConnection()
        {
            //this.SIPTunnel.ConnectionEstablished += this.ConnectionEstablished;
            this.messageRelay.RelayStopped += this.Disconnected;
            await this.messageRelay.Start(); // TODO: Pass a ct?

            await WaitForAsync(
                () => this.Connected,
                this.Ct, // TODO: differentiate between timeout and cancellation?
                this.Ct,
                successCallback: this.SendConnectionEstablishedNotify,
                timeoutCallback: this.AckTimeout,
                cancellationCallback: this.AckTimeout // TODO: Other method. connectionLost = false?
                                                      // TODO: interval?
                );

            this.Connecting = false;
        }

        private async Task Disconnected(SIPTunnel tunnel)
        {
            if (tunnel == this.SIPTunnel)
            {
                await this.Stop();
            }
        }

        private async Task Disconnected(ISIPConnectionPool sender, SIPTunnel tunnel)
        {
            await this.Disconnected(tunnel);
        }

        private async Task Disconnected(SIPMessageRelay messageRelay)
        {
            if (messageRelay == this.messageRelay)
            {
                await this.Stop();
            }
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

        protected override void StopRunning()
        {
            base.StopRunning();         
            this.Connection.SIPRequestReceived -= this.ListenForAck;

            this.ConnectionAcknowledged = false;
            this.Connected = false;

            if (this.SIPTunnel != null)
            {
                this.SIPTunnel.ConnectionStopped -= this.Disconnected;
                this.SIPTunnel.ConnectionEstablished -= this.ConnectionEstablished;
            }

            this.ConnectionPool.ConnectionRemoved -= this.Disconnected;
            this.messageRelay.RelayStopped -= this.Disconnected;
        }

        protected async override Task Finish()
        {
            await base.Finish();

            //await (this.SIPTunnel?.Disconnect() ?? Task.CompletedTask);
            if (this.SIPTunnel != null)
            {
                await this.ConnectionPool.Disconnect(this.SIPTunnel);
            }
            else
            {
                await this.messageRelay.Stop();
                await this.ConnectionPool.Disconnect(this.messageRelay);
            }
             
            await this.SendBye();

            this.SIPTunnel = null;
            this.NewCallParametersSent = false;
            this.Params.SourceTag = null;
        }

        private async Task SendBye()
        {
            if (!this.NewCallParametersSent)
            {
                // No need to send bye. Client would not listen for these parameters anyway
                return;
            }

            SIPHeaderParams headerParams = this.GetHeaderParams(this.CurrentCseq);
            SocketError result;

            result = await this.Connection.SendSIPRequest(SIPMethodsEnum.BYE, headerParams, CancellationToken.None);

            if (result != SocketError.Success)
            {
                // Bye failed.
                // TODO: What to do?
            }
        }

        private async Task ConnectionFailed(SIPResponseStatusCodesEnum statusCode = SIPResponseStatusCodesEnum.None, string? message = null, bool connectionLost = false)
        {
            // TODO: add some identifier for request that failed. (caller ip/name/tag, remote name/tag)
            this.logger.LogInformation("Connection failed {statusCode}. {message}", statusCode, message);

            FailureEventArgs eventArgs = new FailureEventArgs();
            eventArgs.StatusCode = statusCode;
            eventArgs.Message = message;

            if (connectionLost)
            {
                await this.InvokeConnectionLost();
            }

            await (this.OnConnectionFailed?.Invoke(this, eventArgs) ?? Task.CompletedTask);
            await this.Stop();
        }
    }
}
