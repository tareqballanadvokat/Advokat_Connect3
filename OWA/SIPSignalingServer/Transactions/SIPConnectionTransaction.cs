using Microsoft.Extensions.Logging;
using SIPSignalingServer.Interfaces;
using SIPSignalingServer.Models;
using SIPSignalingServer.Utils.CustomEventArgs;
using SIPSorcery.SIP;
using WebRTCLibrary.Interfaces;
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

        private bool WaitingForPeer { get; set; }

        private bool Connecting { get; set; } // TODO: ConnectionPool.GetConnection(this.Registration).Confirmed == false -> connection exists but is not confirmed
                                              //       Or this.PeerRegistration != null && this.Connected == false 

        private bool ConnectionAcknowledged { get; set; }

        private SIPRegistration Registration { get; set; }

        private ISIPRegistry Registry { get; set; }

        private SIPConnectionPool ConnectionPool { get; set; }

        private ServerSideTransactionParams ServerSideTransactionParams { get; set; }

        private readonly SIPMessageRelay messageRelay;

        public event Action<SIPConnectionTransaction, FailureEventArgs>? OnConnectionFailed;

        private CancellationTokenSource? PeerRegisteringCts { get; set; }

        private CancellationTokenSource? ConnectionCts { get; set; }


        public SIPConnectionTransaction(
            SIPSchemesEnum sipScheme,
            ISIPTransport transport,
            ServerSideTransactionParams signalingServerTransactionParams,
            ISIPRegistry registry,
            SIPConnectionPool connectionPool,
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

        public async override Task Start()
        {
            if (this.WaitingForPeer)
            {
                // Another connection process is already running
                return;
            }

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
                this.ConnectionFailed(SIPResponseStatusCodesEnum.InternalServerError, "Cannot connect. Not Registered.");
                return;
            }

            if (this.Registry.PeerIsRegistered(this.Registration))
            {
                await this.Connect();
            }
            else
            {
                this.WaitingForPeer = true;
                this.logger.LogDebug("Waiting for peer \"{peerName}\" to register. Caller: {caller}", this.Registration.RemoteUser, this.Registration.SourceParticipant);

                this.PeerRegisteringCts = new CancellationTokenSource();

                await WaitForAsync(
                    () => this.Registry.PeerIsRegistered(this.Registration), // TODO: make PeerIsRegistered an event. If registry is a db we shouldn't hit it this often.
                    this.PeerRegisteringCts.Token,
                    CancellationToken.None, // TODO: implement cancellation logic
                    // TODO: interval?
                    successCallback: this.Connect);
            }
        }

        public async override Task Stop()
        {
            //throw new NotImplementedException();
            
            await this.StopSIPTunnel();
            this.ResetFlags();
        }

        private async Task Connect()
        { 
            this.Connecting = true;

            this.StopWaitingForPeer();
            this.SetRemoteTag();
            this.CreateConnection();

            this.Connection.SIPRequestReceived += this.ListenForAck;

            SIPRequest notifyRequest = this.GetNotifyRequest(this.StartCSeq);
            
            // TODO: Implement cancellation logic. Where to save tokensource? Which requests should use the same token?
            using CancellationTokenSource cts = new CancellationTokenSource();

            await this.Connection.SendSIPRequest(notifyRequest, cts.Token);

            await WaitFor(
                () => this.ConnectionAcknowledged,
                timeOut: this.ReceiveTimeout,
                CancellationToken.None, // TODO: implement cancellation
                timeoutCallback: () => { this.ConnectionFailed(SIPResponseStatusCodesEnum.RequestTimeout, "Client took to long to respond to connection notify. Timeout."); });

            this.Connection.SIPRequestReceived -= this.ListenForAck;
        }

        private SIPRequest GetNotifyRequest(int cSeq)
        {
            SIPHeaderParams headerParams = this.GetHeaderParams(cSeq: cSeq);
            return SIPHelper.GetRequest(this.SIPScheme, SIPMethodsEnum.NOTIFY, headerParams);
        }

        private async Task ListenForAck(SIPEndPoint localEndPoint, SIPEndPoint remoteEndPoint, SIPRequest request)
        {
            if (request.Method != SIPMethodsEnum.ACK) // This could be a problem if the client is still sending pings - should be ok, pings happen with different params
            {
                this.ConnectionFailed(SIPResponseStatusCodesEnum.MethodNotAllowed, "Request was not an ACK request.");
                return;
            }

            if (request.Header.CSeq != this.StartCSeq + 1)
            {
                this.ConnectionFailed(SIPResponseStatusCodesEnum.BadRequest, "Request header was invalid.");
                return;
            }

            this.ConnectionAcknowledged = true;

            await this.messageRelay.Start();

            await WaitForAsync(
                this.IsConnected,
                timeOut: this.ReceiveTimeout, // TODO: pass ct
                                              //       ACK from both clients has to be received for IsConnected to be true.
                                              //       How long should the timeout be? Probably a bit longer than default Receive timeout
                CancellationToken.None, // TODO: pass ct
                successCallback: this.SendConnectionNotify,
                timeoutCallback: this.AckTimeout
                // TODO: interval?
                );

            this.Connecting = false;
        }

        private async Task SendConnectionNotify()
        {
            SIPRequest notifyRequest = this.GetNotifyRequest(this.StartCSeq + 2);

            // TODO: Implement cancellation logic. Where to save tokensource? Which requests should use the same token?
            using CancellationTokenSource cts = new CancellationTokenSource();

            await this.Connection.SendSIPRequest(notifyRequest, cts.Token);
        }

        private async Task AckTimeout()
        {
            await this.StopSIPTunnel();
            this.ConnectionFailed(SIPResponseStatusCodesEnum.RequestTimeout, "Peer took to long to respond to connection notify. Timeout.");
        }

        private void CreateConnection()
        {
            // adds connection, does not start it
            this.ConnectionPool.Connect(this.messageRelay);
        }

        private void SetRemoteTag()
        {
            SIPRegistration? peerRegistration = this.Registry.GetPeerRegistration(this.Registration);

            if (peerRegistration == null)
            {
                // TODO: peer no longer registered. What to do here? Connection failed? Start waiting again?
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
        }

        private void StopWaitingForPeer()
        {
            this.WaitingForPeer = false;
            this.PeerRegisteringCts?.Cancel();
            this.PeerRegisteringCts = null;
        }

        private void ResetFlags()
        {
            this.StopWaitingForPeer();

            this.Connecting = false;
            this.ConnectionAcknowledged = false;
            this.Params.SourceTag = null;
        }

        private void ConnectionFailed(SIPResponseStatusCodesEnum statusCode = SIPResponseStatusCodesEnum.None, string? message = null)
        {
            // TODO: stop and disconnect if necessary

            // TODO: add some identifier for request that failed. (caller ip/name/tag, remote name/tag)
            this.logger.LogInformation("Connection failed {statusCode}. {message}", statusCode, message); 

            this.ResetFlags();

            FailureEventArgs eventArgs = new FailureEventArgs();
            eventArgs.StatusCode = statusCode;
            eventArgs.Message = message;

            this.OnConnectionFailed?.Invoke(this, eventArgs);
        }
    }
}
