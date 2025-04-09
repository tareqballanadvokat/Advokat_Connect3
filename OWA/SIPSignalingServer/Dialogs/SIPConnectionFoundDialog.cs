using SIPSignalingServer.Models;
using SIPSignalingServer.Utils.CustomEventArgs;
using SIPSorcery.SIP;
using System.Diagnostics;
using WebRTCLibrary.SIP;
using WebRTCLibrary.SIP.Models;
using WebRTCLibrary.SIP.Utils;

using static WebRTCLibrary.Utils.TaskHelpers;

namespace SIPSignalingServer.Dialogs
{
    internal class SIPConnectionFoundDialog : ServerSideSIPDialog
    {
        public int StartCSeq { get; set; }

        public bool Connected { get; private set; } // TODO: ConnectionPool.GetConnection(this.Registration).Confirmed or something like it

        public bool WaitingForPeer { get; private set; }

        private bool Connecting { get; set; } // TODO: ConnectionPool.GetConnection(this.Registration).Confirmed == false -> connection exists but is not confirmed
                                              //       Or this.PeerRegistration != null && this.Connected == false 

        private SIPRegistration Registration { get; set; }

        private SIPRegistration? PeerRegistration { get; set; }

        private SIPRegistry Registry { get; set; }

        private SIPTransport Transport { get; set; }

        private ConnectionPool ConnectionPool { get; set; }

        private ServerSideDialogParams SignalingServerDialogParams { get; set; }

        //public event Action<SIPConnectionFoundDialog>? OnConnected;

        public event Action<SIPConnectionFoundDialog, FailureEventArgs>? OnConnectionFailed;

        public SIPConnectionFoundDialog(ServerSideDialogParams signalingServerDialogParams, SIPTransport transport, SIPRegistry registry, ConnectionPool connectionPool, int startCSeq = 1)
            : base(
                 new ServerSideDialogParams(
                     signalingServerDialogParams.RemoteParticipant,
                     signalingServerDialogParams.ClientParticipant,
                     callId: CallProperties.CreateNewCallId(),
                     sourceTag: null, // explicitly null - gets set when connection is found - remoteTag of peer
                     remoteTag: signalingServerDialogParams.RemoteTag // TODO: Check if this is the right tag
                     ),

                 //signalingServerDialogParams,
                 // TODO: Get scheme passed
                 new SIPConnection(SIPSchemesEnum.sip, transport))
        {
            this.Connection.MessagePredicate = this.IsPartOfDialog;

            this.Transport = transport;
            this.Registry = registry;
            this.ConnectionPool = connectionPool;

            this.Registration = new SIPRegistration(this.Params); // TODO: Check if this should be signalingserver params
            this.StartCSeq = startCSeq;
        }

        //private SIPConnectionFoundDialog(ServerSideDialogParams dialogParams, SIPConnection connection, SIPRegistry registry, ConnectionPool connectionPool, int startCSeq = 1)
        //    : base(dialogParams, connection)
        //{
        //    this.Registry = registry;
        //    this.ConnectionPool = connectionPool;

        //    this.Registration = new SIPRegistration(this.Params);
        //    this.StartCSeq = startCSeq;
        //}

        public async override Task Start()
        {
            if (this.Connected)
            {
                // Already connected
                return;
            }

            if (this.WaitingForPeer)
            {
                // Another connection process is already running
                return;
            }

            if (!this.Registry.IsRegistered(this.Registration))
            {
                // Not registered. Cannot connect
                this.ConnectionFailed(SIPResponseStatusCodesEnum.FlowFailed, "Cannot connect. Not Registered."); // TODO: is FlowFailed right?
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
                // TODO: start keep alive dialog
                // TODO: Find out how to stop keep alive dialog when the peer is connected
                //       wait for peer is registered?
            }
        }

        public override Task Stop()
        {
            throw new NotImplementedException();
        }

        private async Task Connect()
        {
            if (this.Connected)
            {
                // Already connected
                return;
            }

            if (this.Connecting)
            {
                // Another connection process is already running
                return;
            }

            this.Connecting = true;
            this.SetPeerRegistration();
            this.CreateConnection();

            this.Connection.SIPRequestReceived += this.ListenForAck;

            SIPRequest notifyRequest = this.GetNotifyRequest(this.StartCSeq);
            Debug.WriteLine($"Server sending Notify."); // DEBUG
            await this.Connection.SendSIPRequest(notifyRequest);

            await WaitFor(
                () => this.Connected, // TODO: wait for ack if prop changes - Connected means both sides acknowledged
                timeOut: this.ReceiveTimeout,
                //successCallback: () => { this.OnConnected?.Invoke(this); },
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

            SIPTunnelEndpoint? endPoint = this.ConnectionPool.GetTunnelEndpoint(this.Registration, this.Params.CallId);

            if (endPoint == null)
            {
                // no endpoint to confirm
                this.ConnectionFailed(SIPResponseStatusCodesEnum.FlowFailed, "No connection to confirm.");
                return;
            }

            endPoint.Confirmed = true;



            await WaitFor(
                () =>
                {
                    SIPTunnel? connection = this.ConnectionPool.GetConnection(endPoint, this.Params.CallId);
                    // TODO: can we cancel token in here on success :)?

                    return connection != null && connection.Left.Confirmed && connection.Right.Confirmed;
                },
                this.ReceiveTimeout, // TODO: pass ct
                successCallback: this.SendConnectionNotify
                );


            // TODO: Set own Endpoint as confirmed
            // Wait for both to be confirmed --> start relay --> send Notify




            this.Connected = true;
            this.Connecting = false;
        }

        private void SendConnectionNotify()
        {
            // TODO: send connection Notify.
            // TODO: start relay dialogs?
        }

        private void CreateConnection()
        {
            // adds connection, does not start it
            RelayDialog relayDialog = new RelayDialog(this.Params, this.Connection); // pass transport?

            SIPTunnelEndpoint tunnelEndpoint = new SIPTunnelEndpoint(this.Params.ClientParticipant, this.Params.RemoteTag, this.Registration.RemoteUser, relayDialog);

            // Should we just pass the dialog? All of the info is in the params
            this.ConnectionPool.Connect(tunnelEndpoint, this.Params.CallId);
        }

        private void SetPeerRegistration()
        {
            this.PeerRegistration = this.Registry.GetPeerRegistration(this.Registration);

            if (this.PeerRegistration == null)
            {
                // TODO: peer no longer registered. What to do here? Connection failed? Start waiting again?
                return;
            }

            this.Params.SourceTag = this.PeerRegistration.FromTag; // TODO: Check if this is the right tag
        }

        private void ConnectionFailed(SIPResponseStatusCodesEnum statusCode = SIPResponseStatusCodesEnum.None, string? message = null)
        {
            this.Connecting = false;
            this.Connected = false;
            this.PeerRegistration = null;
            this.Params.SourceTag = null;

            FailureEventArgs eventArgs = new FailureEventArgs();
            eventArgs.StatusCode = statusCode;
            eventArgs.Message = message;

            this.OnConnectionFailed?.Invoke(this, eventArgs);
        }
    }
}
