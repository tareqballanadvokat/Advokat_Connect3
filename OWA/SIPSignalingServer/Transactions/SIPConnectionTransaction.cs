using Microsoft.Extensions.Logging;
using SIPSignalingServer.Models;
using SIPSignalingServer.Utils.CustomEventArgs;
using SIPSorcery.SIP;
using System.Diagnostics;
using WebRTCLibrary.SIP;
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

        public bool WaitingForPeer { get; private set; }

        private bool Connecting { get; set; } // TODO: ConnectionPool.GetConnection(this.Registration).Confirmed == false -> connection exists but is not confirmed
                                              //       Or this.PeerRegistration != null && this.Connected == false 

        private bool ConnectionAcknowledged { get; set; }

        private SIPRegistration Registration { get; set; }

        private SIPRegistry Registry { get; set; }

        private SIPTransport Transport { get; set; }

        private SIPConnectionPool ConnectionPool { get; set; }

        private ServerSideTransactionParams ServerSideTransactionParams { get; set; }

        public event Action<SIPConnectionTransaction, FailureEventArgs>? OnConnectionFailed;

        public SIPConnectionTransaction(
            SIPSchemesEnum sipScheme,
            SIPTransport transport,
            ServerSideTransactionParams signalingServerTransactionParams,
            SIPRegistry registry,
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
            this.Transport = transport;
            this.Registry = registry;
            this.ConnectionPool = connectionPool;
            
            this.Registration = new SIPRegistration(this.ServerSideTransactionParams);
            this.StartCSeq = startCSeq;
        }

        public bool IsConnected()
        {
            return this.ConnectionPool.IsConnected(this.Params);
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
                // peer not yet registered.

                CancellationTokenSource cts = new CancellationTokenSource();
                CancellationToken ct = cts.Token;

                await WaitForAsync(
                    () => this.Registry.PeerIsRegistered(this.Registration),
                    ct,
                    successCallback: this.Connect
                    );

                // TODO: wait for peer is registered?
            }
        }

        public override Task Stop()
        {
            throw new NotImplementedException();
        }

        private async Task Connect()
        {
            //if (this.IsConnected()) // TODO: Gets called twice
            //{
            //    // Already connected
            //    return;
            //}

            //if (this.Connecting)
            //{
            //    // Another connection process is already running
            //    return;
            //}
            this.WaitingForPeer = false; // TODO: keep here?

            this.Connecting = true;
            this.SetRemoteTag();
            this.CreateConnection();

            this.Connection.SIPRequestReceived += this.ListenForAck;

            SIPRequest notifyRequest = this.GetNotifyRequest(this.StartCSeq);
            Debug.WriteLine($"Server sending Notify."); // DEBUG

            // TODO: Implement cancellation logic. Where to save tokensource? Which requests should use the same token?
            using CancellationTokenSource cts = new CancellationTokenSource();

            await this.Connection.SendSIPRequest(notifyRequest, cts.Token);

            await WaitFor(
                () => this.ConnectionAcknowledged,
                timeOut: this.ReceiveTimeout,
                failureCallback: () => { this.ConnectionFailed(SIPResponseStatusCodesEnum.RequestTimeout, "Client took to long to respond to connection notify. Timeout."); });

            this.Connection.SIPRequestReceived -= this.ListenForAck;
        }

        private SIPRequest GetNotifyRequest(int cSeq)
        {
            SIPHeaderParams headerParams = this.GetHeaderParams(cSeq: cSeq);
            return SIPHelper.GetRequest(this.SIPScheme, SIPMethodsEnum.NOTIFY, headerParams);
        }

        private async Task ListenForAck(SIPEndPoint localEndPoint, SIPEndPoint remoteEndPoint, SIPRequest request)
        {
            if (request.Method != SIPMethodsEnum.ACK) // This could be a problem if the client is still sending pings - should be ok, pings happen with defferent params
            {
                this.ConnectionFailed(SIPResponseStatusCodesEnum.MethodNotAllowed, "Request was not an ACK request.");
                return;
            }

            if (request.Header.CSeq != this.StartCSeq + 1)
            {
                this.ConnectionFailed(SIPResponseStatusCodesEnum.BadRequest, "Request header was invalid.");
                return;
            }

            Debug.WriteLine($"Server recieved ACK for connection."); // DEBUG
            this.ConnectionAcknowledged = true;

            SIPMessageRelay? messageRelay = this.ConnectionPool.GetMessageRelay(this.Params);

            if (messageRelay == null)
            {
                this.ConnectionFailed(SIPResponseStatusCodesEnum.InternalServerError, "Connection not found. Could not confirm connection.");
                return;
            }

            await messageRelay.Start();

            await WaitFor(this.IsConnected,
                this.ReceiveTimeout, // TODO: pass ct
                successCallback: this.SendConnectionNotify
                );

            //this.Connected = true;
            this.Connecting = false;
        }

        private void SendConnectionNotify()
        {
            Debug.WriteLine($"Server sending Notify."); // DEBUG
            // TODO: send connection Notify.
        }

        private void CreateConnection()
        {
            // adds connection, does not start it
            SIPMessageRelay messageRelay = new SIPMessageRelay(this.Connection, this.Params, this.loggerFactory); // pass transport?
            this.ConnectionPool.Connect(messageRelay);
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

        private void ConnectionFailed(SIPResponseStatusCodesEnum statusCode = SIPResponseStatusCodesEnum.None, string? message = null)
        {
            // TODO: stop and disconnect if necessary

            this.Connecting = false;
            this.ConnectionAcknowledged = false;
            this.Params.SourceTag = null;

            FailureEventArgs eventArgs = new FailureEventArgs();
            eventArgs.StatusCode = statusCode;
            eventArgs.Message = message;

            this.OnConnectionFailed?.Invoke(this, eventArgs);
        }
    }
}
