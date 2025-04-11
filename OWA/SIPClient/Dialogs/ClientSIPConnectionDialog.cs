using SIPSorcery.SIP;
using System.Diagnostics;
using System.Diagnostics.CodeAnalysis;
using WebRTCLibrary.SIP;
using WebRTCLibrary.SIP.Models;

using static WebRTCLibrary.Utils.TaskHelpers;

namespace WebRTCClient.Dialogs
{
    internal class ClientSIPConnectionDialog : SIPDialog
    {

        public MessagingDialog? MessagingDialog { get; private set; }

        [MemberNotNullWhen(true, nameof(this.MessagingDialog))]
        public bool Connected { get => this.MessagingDialog?.Running ?? false && this.PeerListeningConfirmation; }

        private bool PeerListeningConfirmation { get; set; }

        private bool Connecting { get; set; }

        public ClientSIPConnectionDialog(SIPSchemesEnum sipScheme, SIPTransport transport, DialogParams dialogParams)
            : base(sipScheme, transport, dialogParams)
        {
        }

        public async override Task Start()
        {
            if (this.Connected) // TODO: messagingDialogRunning
            {
                // already connected
                return;
            }

            if (this.Connecting)
            {
                // another connection is already running
                return;
            }

            this.Connecting = true;
            this.Connection.SIPRequestReceived += this.InitialNotifyListener;
        }

        private async Task InitialNotifyListener(SIPEndPoint localEndpoint, SIPEndPoint remoteEndPoint, SIPRequest sipRequest)
        {
            if (sipRequest.Method != SIPMethodsEnum.NOTIFY)
            {
                // TODO: Check if it is a ping - ignore if it is
                //       If is is something else we should fail i think
                //       
                //       Should not be a problem now - ping is with different tag and callID
                return;
            }

            if (sipRequest.Header.CSeq != 4
                || sipRequest.Header.From.FromTag == null
                || sipRequest.Header.CallId == null) // TODO: nullOrEmpty?
            {
                // invalid header
                return;
            }

            this.Connection.SIPRequestReceived -= this.InitialNotifyListener;
            this.Connection.SIPRequestReceived += this.ConnectionNotifyListener;

            this.Params.RemoteTag = sipRequest.Header.From.FromTag;
            this.Params.CallId = sipRequest.Header.CallId;

            this.MessagingDialog = new MessagingDialog(this.Connection, this.Params);
            await this.MessagingDialog.Start();

            Debug.WriteLine($"Client sending ACK."); // DEBUG
            await this.Connection.SendSIPRequest(SIPMethodsEnum.ACK, this.GetHeaderParams(cSeq: 5));

            await WaitFor(
                () => this.PeerListeningConfirmation,
                this.ReceiveTimeout,
                failureCallback: () => { } // TODO: fail connection
                );

            this.Connection.SIPRequestReceived -= this.ConnectionNotifyListener;

            //this.Connected = true;
            this.Connecting = false;
        }

        private async Task ConnectionNotifyListener(SIPEndPoint localEndpoint, SIPEndPoint remoteEndPoint, SIPRequest sipRequest)
        {
            if (sipRequest.Method != SIPMethodsEnum.NOTIFY)
            {
                // TODO: Check if it is a ping - ignore if it is
                //       If is is something else we should fail i think
                //       
                //       Should not be a problem now - ping is with different tag and callID
                return;
            }

            if (sipRequest.Header.CSeq != 6)
            {
                // invalid header
                return;
            }

            this.PeerListeningConfirmation = true;
        }

        public async override Task Stop()
        {
            // TODO: Rework completely

            if (!this.Connected)
            {
                // not connected.
                return;
            }

            this.Params.RemoteTag = null;
            this.Params.CallId = null;

            if (this.Connecting)
            {
                this.Connection.SIPRequestReceived -= this.InitialNotifyListener;

                // TODO: what to do here? send disconnect message?
                return;
            }

            //this.Connected = false;
            // TODO: send a message for disconnect?
        }

        // TODO: return socketError?
        public async Task SendRequest(SIPMethodsEnum method, string? message, int cSeq)
        {
            if (!this.Connected)
            {
                return;
            }

            await this.MessagingDialog.SendRequest(method, message, cSeq);
        }
    }
}
