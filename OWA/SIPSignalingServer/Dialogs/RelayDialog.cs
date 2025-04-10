using SIPSignalingServer.Models;
using SIPSorcery.SIP;
using WebRTCLibrary.SIP;

namespace SIPSignalingServer.Dialogs
{
    internal class RelayDialog : ServerSideSIPDialog
    {
        public bool Relaying { get; private set; }

        public RelayDialog(SIPConnection connection, ServerSideDialogParams dialogParams)
            : base(connection, dialogParams)
        {
        }

        public event Action<RelayDialog, SIPRequest>? OnRequestReceived;
        public event Action<RelayDialog, SIPResponse>? OnResponseReceived;

        private async Task RelayMessage(SIPEndPoint localEndPoint, SIPEndPoint remoteEndPointl, SIPRequest request)
        {
            this.OnRequestReceived?.Invoke(this, request);
        }

        private async Task RelayMessage(SIPEndPoint localEndPoint, SIPEndPoint remoteEndPointl, SIPResponse response)
        {
            this.OnResponseReceived?.Invoke(this, response);
        }

        public async override Task Start()
        {
            if (this.Relaying)
            {
                // already relaying
                return;
            }

            this.Connection.SIPRequestReceived += this.RelayMessage;
            this.Connection.SIPResponseReceived += this.RelayMessage;
            this.Relaying = true;
        }

        public async override Task Stop()
        {
            if (!this.Relaying)
            {
                // not started
                return;
            }

            this.Connection.SIPRequestReceived -= this.RelayMessage;
            this.Connection.SIPResponseReceived -= this.RelayMessage;
            this.Relaying = false;
        }
    }
}
