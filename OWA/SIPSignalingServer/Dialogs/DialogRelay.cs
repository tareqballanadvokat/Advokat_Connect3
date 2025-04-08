using SIPSignalingServer.Models;
using SIPSorcery.SIP;
using WebRTCLibrary.SIP;

namespace SIPSignalingServer.Dialogs
{
    internal class DialogRelay
    {
        public event Action<DialogRelay, SIPRequest>? OnRequestReceived;
        public event Action<DialogRelay, SIPResponse>? OnResponseReceived;


        public DialogRelay(ServerSideDialogParams dialogParams, WebRTCLibrary.SIP.SIPConnection connection)
        {
            // TODO: We need new tags - relay to server cannot distinguish between dialogs otherwise

            connection.SIPRequestReceived += this.RelayMessage;
            connection.SIPResponseReceived += this.RelayMessage;
        }

        private async Task RelayMessage(SIPEndPoint localEndPoint, SIPEndPoint remoteEndPointl, SIPRequest request)
        {
            this.OnRequestReceived?.Invoke(this, request);
        }

        private async Task RelayMessage(SIPEndPoint localEndPoint, SIPEndPoint remoteEndPointl, SIPResponse response)
        {
            this.OnResponseReceived?.Invoke(this, response);
        }
    }
}
