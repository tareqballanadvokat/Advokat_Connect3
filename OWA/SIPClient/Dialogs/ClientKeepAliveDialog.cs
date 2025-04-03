using SIPSorcery.SIP;
using WebRTCLibrary.SIP;
using WebRTCLibrary.SIP.Models;

namespace WebRTCClient.Dialogs
{
    internal class ClientKeepAliveDialog : SIPDialog
    {
        public bool WaitingForPeer { get; set; }

        public ClientKeepAliveDialog(DialogParams dialogParams, SIPConnection connection)
            : base(dialogParams, connection)
        {
        }

        public async override Task Start()
        {
            this.WaitingForPeer = true;
            this.Connection.SIPRequestReceived += this.PingListener;
        }

        private async Task PingListener(SIPEndPoint localEndpoint, SIPEndPoint remoteEndPoint, SIPRequest sipRequest)
        {
            // TODO: Do something if there is no ping for a while
            if (sipRequest.Method != SIPMethodsEnum.PING)
            {
                // not a PING, gets ignored
                return;
            }

            await this.Connection.SendSIPRequest(SIPMethodsEnum.PING, this.GetHeaderParams(sipRequest.Header.CSeq + 1));
        }

        public async override Task Stop()
        {
            this.WaitingForPeer = false;
            this.Connection.SIPRequestReceived -= this.PingListener;
        }
    }
}
