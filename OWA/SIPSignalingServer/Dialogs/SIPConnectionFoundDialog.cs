using Org.BouncyCastle.Asn1.Ocsp;
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

        public bool Connected { get; private set; }

        public bool WaitingForPeer { get; private set; }

        private bool Connecting { get; set; }

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
                await this.Connect(true);
            }
            else
            {
                this.WaitingForPeer = true;
                // peer not yet registered.
                // TODO: start keep alive dialog
                // TODO: Find out how to stop keep alive dialog when the peer is connected
            }
        }

        public override Task Stop()
        {
            throw new NotImplementedException();
        }

        private async Task Connect(bool second = false)
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

            SIPTransportRequestAsyncDelegate ackListener = async (SIPEndPoint localEndPoint, SIPEndPoint remoteEndPoint, SIPRequest request) => 
            { 
                await this.ListenForAck(request, second); 
            };

            this.Connection.SIPRequestReceived += ackListener;

            SIPRequest notifyRequest = this.GetNotifyRequest();
            Debug.WriteLine($"Server sending Notify."); // DEBUG
            await this.Connection.SendSIPRequest(notifyRequest);

            await WaitFor(
                () => this.Connected,
                timeOut: this.ReceiveTimeout,
                //successCallback: () => { this.OnConnected?.Invoke(this); },
                failureCallback: () => { this.ConnectionFailed(SIPResponseStatusCodesEnum.RequestTimeout, "Client took to long to respond to connection notify. Timeout."); });

            this.Connection.SIPRequestReceived -= ackListener;
        }

        private SIPRequest GetNotifyRequest()
        {
            SIPHeaderParams headerParams = this.GetHeaderParams(cSeq: this.StartCSeq);
            return SIPHelper.GetRequest(this.SIPScheme, SIPMethodsEnum.NOTIFY, headerParams);
        }

        private async Task ListenForAck(SIPRequest request, bool second = false)
        {
            if (request.Method != SIPMethodsEnum.ACK) // This could be a problem if the client is still sending pings
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

            if (second)
            {
                // TODO: We don't know if the other peer acknowledged
                // create list in ConnectionPool - pending connections?
                this.CreateConnection(second);
            }

            this.Connected = true;
            this.Connecting = false;
        }

        private void CreateConnection(bool second = false)
        {
            //this.ConnectionPool.Connections // this should only happen on one sided
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
