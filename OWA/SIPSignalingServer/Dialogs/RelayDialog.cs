using SIPSignalingServer.Models;
using SIPSorcery.SIP;
using WebRTCLibrary.SIP;

namespace SIPSignalingServer.Dialogs
{
    internal class RelayDialog : ServerSideSIPDialog
    {
        public RelayDialog(ServerSideDialogParams dialogParams, SIPConnection connection) : base(dialogParams, connection)
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
            this.Connection.SIPRequestReceived += this.RelayMessage;
            this.Connection.SIPResponseReceived += this.RelayMessage;
        }

        public async override Task Stop()
        {
            this.Connection.SIPRequestReceived -= this.RelayMessage;
            this.Connection.SIPResponseReceived -= this.RelayMessage;
        }
    }
}
