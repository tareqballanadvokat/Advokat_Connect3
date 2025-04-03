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
    internal class SIPConnectionDialog : ServerSideSIPDialog
    {
        public int StartCSeq { get; set; }

        public bool Connected { get; private set; }

        public bool WaitingForPeer { get; private set; }

        private bool Connecting { get; set; }

        private SIPRegistration Registration { get; set; }

        private SIPRegistry Registry { get; set; }

        public event Action<SIPConnectionDialog>? OnConnected;

        public event Action<SIPConnectionDialog, FailureEventArgs>? OnConnectionFailed;

        public SIPConnectionDialog(ServerSideDialogParams dialogParams, SIPConnection connection, SIPRegistry registry, int startCSeq = 1)
            : base(dialogParams, connection)
        {
            this.Registry = registry;

            this.Registration = new SIPRegistration(this.Params.ClientParticipant, this.Params.RemoteParticipant.Name);
            this.StartCSeq = startCSeq;
        }

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
                // peer not yet registered.
                // TODO: start keep alive dialog
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

            this.Connection.SIPRequestReceived += this.ListenForAck;

            SIPRequest notifyRequest = this.GetNotifyRequest();
            Debug.WriteLine($"Server sending Notify."); // DEBUG
            await this.Connection.SendSIPRequest(notifyRequest);

            await WaitFor(
                () => this.Connected,
                timeOut: this.ReceiveTimeout,
                successCallback: () => { this.OnConnected?.Invoke(this); },
                failureCallback: () => { this.ConnectionFailed(SIPResponseStatusCodesEnum.RequestTimeout, "Client took to long to respond to connection notify. Timeout."); });

            this.Connection.SIPRequestReceived -= this.ListenForAck;
        }

        private SIPRequest GetNotifyRequest()
        {
            SIPHeaderParams headerParams = this.GetHeaderParams(cSeq: this.StartCSeq);
            return SIPHelper.GetRequest(this.SIPScheme, SIPMethodsEnum.NOTIFY, headerParams);
        }

        private async Task ListenForAck(SIPEndPoint localEndPoint, SIPEndPoint remoteEndPoint, SIPRequest request)
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

            this.Connected = true;
            this.Connecting = false;
        }

        private void ConnectionFailed(SIPResponseStatusCodesEnum statusCode = SIPResponseStatusCodesEnum.None, string? message = null)
        {
            this.Connecting = false;
            this.Connected = false;

            FailureEventArgs eventArgs = new FailureEventArgs();
            eventArgs.StatusCode = statusCode;
            eventArgs.Message = message;

            this.OnConnectionFailed?.Invoke(this, eventArgs);
        }
    }
}
