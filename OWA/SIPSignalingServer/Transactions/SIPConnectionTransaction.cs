using Microsoft.Extensions.Logging;
using SIPSignalingServer.Interfaces;
using SIPSignalingServer.Models;
using SIPSignalingServer.Utils.CustomEventArgs;
using SIPSorcery.SIP;
using System.Net.Sockets;
using WebRTCLibrary.SIP.Interfaces;
using WebRTCLibrary.SIP.Models;
using WebRTCLibrary.SIP.Utils;

using static WebRTCLibrary.Utils.TaskHelpers;

namespace SIPSignalingServer.Transactions
{
    internal class SIPConnectionTransaction : ServerSideSIPTransaction
    {
        private readonly ILoggerFactory loggerFactory;

        private readonly ILogger<SIPConnectionTransaction> logger;

        public int StartCSeq { get; set; }

        //private bool WaitingForPeer { get; set; }

        private bool Connecting { get; set; } // TODO: ConnectionPool.GetConnection(this.Registration).Confirmed == false -> connection exists but is not confirmed
                                              //       Or this.PeerRegistration != null && this.Connected == false 

        private bool ConnectionAcknowledged { get; set; }

        private SIPRegistration Registration { get; set; }

        private ISIPRegistry Registry { get; set; }

        private ISIPConnectionPool ConnectionPool { get; set; }

        private ServerSideTransactionParams ServerSideTransactionParams { get; set; }

        private readonly SIPMessageRelay messageRelay;

        public delegate Task ConnectionFailedDelegate(SIPConnectionTransaction sender, FailureEventArgs e);

        public event ConnectionFailedDelegate? OnConnectionFailed;

        private CancellationTokenSource? PeerRegisteringCts { get; set; }

        private CancellationTokenSource connectionCts = new CancellationTokenSource();

        private CancellationToken ConnectionCt { get => this.connectionCts.Token; }

        public SIPConnectionTransaction(
            SIPSchemesEnum sipScheme,
            ISIPTransport transport,
            ServerSideTransactionParams signalingServerTransactionParams,
            ISIPRegistry registry,
            ISIPConnectionPool connectionPool,
            ILoggerFactory loggerFactory,
            int startCSeq = 1)
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
            this.StartCSeq = startCSeq;

            this.messageRelay = new SIPMessageRelay(this.Connection, this.Params, this.loggerFactory);
            this.messageRelay.SendTimeout = this.SendTimeout;
        }

        public bool IsConnected()
        {
            return this.ConnectionPool.IsConnected(this.messageRelay);
        }

        // TODO: remove once base class changes
        public async override Task Start()
        {
            await this.Start(null);
        }

        public async override Task Start(CancellationToken? ct = null)
        {
            //if (this.WaitingForPeer)
            //{
            //    // Another connection process is already running
            //    return;
            //}

            if (this.Connecting)
            {
                // Another connection process is already running
                return;
            }

            if (this.IsConnected())
            {
                // Already connected
                return;
            }

            // TODO: Check if connection is pending

            if (!this.Registry.IsRegistered(this.Registration))
            {
                await this.ConnectionFailed(SIPResponseStatusCodesEnum.InternalServerError, "Cannot connect. Not registered.", sendBye: false);
                return;
            }

            this.connectionCts = ct == null ? new CancellationTokenSource() : CancellationTokenSource.CreateLinkedTokenSource((CancellationToken)ct);

            if (this.ConnectionCt.IsCancellationRequested)
            {
                await this.ConnectionFailed(SIPResponseStatusCodesEnum.InternalServerError, "Connection cancelled.", sendBye: false);
                return;
            }

            if (this.Registry.PeerIsRegistered(this.Registration))
            {
                await this.Connect();
            }
            else
            {
                await this.ConnectionFailed(SIPResponseStatusCodesEnum.InternalServerError, "Peer not registered.", sendBye: false);
                
                //this.WaitingForPeer = true;
                //this.logger.LogDebug("Waiting for peer \"{peerName}\" to register. Caller: {caller}", this.Registration.RemoteUser, this.Registration.SourceParticipant);

                //// TODO: add own timeout for waiting for peer
                //this.PeerRegisteringCts = new CancellationTokenSource();

                //await WaitForAsync(
                //    () => this.Registry.PeerIsRegistered(this.Registration), // TODO: make PeerIsRegistered an event. If registry is a db we shouldn't hit it this often.
                //    this.PeerRegisteringCts.Token,
                //    CancellationToken.None, // TODO: implement cancellation logic
                //    // TODO: interval?
                //    successCallback: this.Connect);
            }
        }

        private async Task Connect()
        {
            if (this.ConnectionCt.IsCancellationRequested)
            {
                await this.ConnectionFailed(SIPResponseStatusCodesEnum.InternalServerError, "Connection cancelled.", sendBye: false);
                return;
            }

            this.Connecting = true;

            //this.StopWaitingForPeer();
            await this.SetRemoteTag();

            this.CreateConnection();
            this.Connection.SIPRequestReceived += this.ListenForAck;

            bool notifySent = await this.SendNotifyRequest(this.StartCSeq);
            if (!notifySent)
            {
                // sending notify failed
                return;
            }

            await WaitForAsync(
                () => this.ConnectionAcknowledged,
                timeOut: this.ReceiveTimeout,
                this.ConnectionCt,
                timeoutCallback: async () => 
                    await this.ConnectionFailed(
                        SIPResponseStatusCodesEnum.RequestTimeout,
                        "Client took to long to send acknowledge connection notify. Timeout."),
                cancellationCallback: async () => 
                    await this.ConnectionFailed(SIPResponseStatusCodesEnum.RequestTerminated, "Operation cancelled."));

            this.Connection.SIPRequestReceived -= this.ListenForAck;
        }

        private async Task PeerDisconnected(ISIPConnectionPool sender, ServerSideTransactionParams connectionParams)
        {
            if (!this.Params.IsPeer(connectionParams))
            {
                return;
            }

            // TODO: cancel token?
            //       send bye
        }

        private SIPRequest GetNotifyRequest(int cSeq)
        {
            SIPHeaderParams headerParams = this.GetHeaderParams(cSeq: cSeq);
            return SIPHelper.GetRequest(this.SIPScheme, SIPMethodsEnum.NOTIFY, headerParams);
        }

        private async Task<bool> SendNotifyRequest(int cSeq)
        {
            SIPRequest notifyRequest = this.GetNotifyRequest(this.StartCSeq);

            SocketError result;
            try
            {
                result = await this.Connection.SendSIPRequest(notifyRequest, this.ConnectionCt);
            }
            catch (OperationCanceledException ex)
            {
                // request not sent
                await this.ConnectionFailed(SIPResponseStatusCodesEnum.RequestTerminated, "Operation cancelled.", sendBye: false);
                return false;
            }

            if (result != SocketError.Success)
            {
                // request not sent

                // TODO: map socketerror to SIPResponseStatusCodesEnum
                await this.ConnectionFailed(SIPResponseStatusCodesEnum.InternalServerError, "Sending connection Notify failed.", sendBye: false);
                return false;
            }

            return true;
        }

        private async Task ListenForAck(SIPEndPoint localEndPoint, SIPEndPoint remoteEndPoint, SIPRequest request)
        {
            if (request.Method != SIPMethodsEnum.ACK) // This could be a problem if the client is still sending pings - should be ok, pings happen with different params
            {
                await this.ConnectionFailed(SIPResponseStatusCodesEnum.MethodNotAllowed, "Request was not an ACK request.");
                return;
            }

            if (request.Header.CSeq != this.StartCSeq + 1)
            {
                await this.ConnectionFailed(SIPResponseStatusCodesEnum.BadRequest, "Request header was invalid.");
                return;
            }

            if (this.ConnectionCt.IsCancellationRequested)
            {
                await this.ConnectionFailed(SIPResponseStatusCodesEnum.RequestTerminated, "Operation cancelled");
                return;
            }

            this.ConnectionAcknowledged = true;
            await this.messageRelay.Start(); // TODO: Pass a ct?

            await WaitForAsync(
                this.IsConnected,
                this.ConnectionCt, // TODO: differentiate between timeout and cancellation
                CancellationToken.None,
                successCallback: this.SendConnectionNotify,
                timeoutCallback: this.AckTimeout
                // TODO: interval?
                );

            this.Connecting = false;
        }

        private async Task SendConnectionNotify()
        {
            // TODO: implement sad path
            SIPRequest notifyRequest = this.GetNotifyRequest(this.StartCSeq + 2);

            // TODO: Implement cancellation logic. Where to save tokensource? Which requests should use the same token?
            using CancellationTokenSource cts = new CancellationTokenSource();

            await this.Connection.SendSIPRequest(notifyRequest, cts.Token);
        }

        private async Task AckTimeout()
        {
            //await this.StopSIPTunnel();
            await this.ConnectionFailed(SIPResponseStatusCodesEnum.RequestTimeout, "Peer took to long to respond to connection notify. Timeout.");
        }

        private void CreateConnection()
        {
            // TODO: remove listener
            this.ConnectionPool.ConnectionRemoved += this.PeerDisconnected;

            // adds connection, does not start it
            this.ConnectionPool.Connect(this.messageRelay);
        }

        private async Task SetRemoteTag()
        {
            SIPRegistration? peerRegistration = this.Registry.GetPeerRegistration(this.Registration);

            if (peerRegistration == null)
            {
                // TODO: schould we send registered bye? Currently it does. Maybe only connection bye
                await this.ConnectionFailed(SIPResponseStatusCodesEnum.NotFound, "Could not set remote tag, peer not registered.", sendBye: false);
                return;
            }

            this.Params.RemoteTag = peerRegistration.FromTag;
        }

        private async Task StopSIPTunnel()
        {
            if (this.IsConnected())
            {
                // TODO: Close SIP Tunnel
                // TODO: send something to the clients to let them know that the Tunnel has been closed
                //       On which channel should we send the bye message? On the tunnel it is indistinguishable from a bye of the peer.
                //       The signaling server has a bye for registration i think.
            }
            
            await this.messageRelay.Stop();
            this.ConnectionPool.Disconnect(this.messageRelay);
        }

        //private void StopWaitingForPeer()
        //{
        //    //this.WaitingForPeer = false;
        //    this.PeerRegisteringCts?.Cancel();
        //    this.PeerRegisteringCts = null;
        //}

        private void ResetFlags()
        {
            //this.StopWaitingForPeer();

            this.Connecting = false;
            this.ConnectionAcknowledged = false;
            this.Params.SourceTag = null;
        }

        public async Task Disconnect()
        {
            await this.ResetConnection();
        }

        private async Task SendBye(int cSeq)
        {
            SIPHeaderParams headerParams = this.GetHeaderParams(cSeq);
            SocketError result;

            result = await this.Connection.SendSIPRequest(SIPMethodsEnum.BYE, headerParams, CancellationToken.None);

            if (result != SocketError.Success)
            {
                // Bye failed.
                // TODO: What to do?
            }
        }

        private async Task ResetConnection(bool sendBye = false)
        {
            await this.StopSIPTunnel();

            this.Connection.SIPRequestReceived -= this.ListenForAck;
            this.connectionCts.Cancel();

            if (sendBye)
            {
                await this.SendBye(6); // TODO: Get current cSeq
            }
            this.ResetFlags();
        }

        private async Task ConnectionFailed(SIPResponseStatusCodesEnum statusCode = SIPResponseStatusCodesEnum.None, string? message = null, bool sendBye = true)
        {
            // TODO: stop and disconnect if necessary

            // TODO: add some identifier for request that failed. (caller ip/name/tag, remote name/tag)
            this.logger.LogInformation("Connection failed {statusCode}. {message}", statusCode, message);

            await this.ResetConnection(sendBye);

            FailureEventArgs eventArgs = new FailureEventArgs();
            eventArgs.StatusCode = statusCode;
            eventArgs.Message = message;

            await (this.OnConnectionFailed?.Invoke(this, eventArgs) ?? Task.CompletedTask);
        }
    }
}
