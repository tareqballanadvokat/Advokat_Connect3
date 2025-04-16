using SIPSorcery.SIP;
using WebRTCLibrary.SIP;
using WebRTCLibrary.SIP.Models;

namespace WebRTCClient.Transactions.SIP
{
    internal class SIPKeepAlive : WebRTCLibrary.SIP.SIPTransaction
    {
        public bool WaitingForPeer { get; set; }

        public SIPKeepAlive(SIPConnection connection, TransactionParams dialogParams)
            : base(connection, dialogParams)
        {
        }

        public async override Task Start()
        {
            WaitingForPeer = true;
            Connection.SIPRequestReceived += PingListener;
        }

        private async Task PingListener(SIPEndPoint localEndpoint, SIPEndPoint remoteEndPoint, SIPRequest sipRequest)
        {
            // TODO: Do something if there is no ping for a while
            if (sipRequest.Method != SIPMethodsEnum.PING)
            {
                // not a PING, gets ignored
                return;
            }

            await Connection.SendSIPRequest(SIPMethodsEnum.PING, GetHeaderParams(sipRequest.Header.CSeq + 1));
        }

        public async override Task Stop()
        {
            WaitingForPeer = false;
            Connection.SIPRequestReceived -= PingListener;
        }
    }
}
