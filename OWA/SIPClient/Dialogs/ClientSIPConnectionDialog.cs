using SIPSorcery.SIP;
using System.Diagnostics;
using WebRTCLibrary.SIP;
using WebRTCLibrary.SIP.Models;

namespace WebRTCClient.Dialogs
{
    internal class ClientSIPConnectionDialog : SIPDialog
    {
        public bool Connected { get; private set; }

        private bool Connecting { get; set; }

        private ClientKeepAliveDialog KeepAliveDialog { get; set;}

        public ClientSIPConnectionDialog(
            SIPParticipant sourceParticipant,
            SIPParticipant remoteParticipant,
            SIPConnection connection,
            string callId,
            string sourceTag,
            string remoteTag)
            : base(
                  sourceParticipant,
                  remoteParticipant,
                  connection,
                  callId,
                  sourceTag,
                  remoteTag)
        {
            this.KeepAliveDialog = new ClientKeepAliveDialog(
                this.SourceParticipant,
                this.RemoteParticipant,
                this.Connection,
                this.CallId,
                this.SourceTag,
                this.RemoteTag);
        }

        public async override Task Start()
        {
            if (this.Connected)
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
            await this.KeepAliveDialog.Start();
            this.Connection.SIPRequestReceived += this.NotifyListener;
        }

        private async Task NotifyListener(SIPEndPoint localEndpoint, SIPEndPoint remoteEndPoint, SIPRequest sipRequest)
        {
            if (sipRequest.Method != SIPMethodsEnum.NOTIFY)
            {
                // TODO: Check if it is a ping - ignore if it is
                //       If is is something else we should fail i think

                return;
            }

            if (sipRequest.Header.CSeq != 4)
            {
                // invalid header
                return;
            }

            await this.KeepAliveDialog.Stop();
            this.Connection.SIPRequestReceived -= this.NotifyListener;

            Debug.WriteLine($"Client sending ACK."); // DEBUG

            await this.Connection.SendSIPRequest(SIPMethodsEnum.ACK, this.GetHeaderParams(cSeq: 5));

            this.Connected = true;
            this.Connecting = false;
        }

        public async override Task Stop()
        {
            if (!this.Connected)
            {
                // not connected.
                return;
            }

            if (this.Connecting)
            {
                await this.KeepAliveDialog.Stop();
                this.Connection.SIPRequestReceived -= this.NotifyListener;

                // TODO: what to do here? send disconnect message?
                return;
            }

            this.Connected = false;
            // TODO: send a message for disconnect?
        }
    }
}
