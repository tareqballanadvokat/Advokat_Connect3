using Microsoft.Extensions.Logging;
using SIPSorcery.SIP;
using WebRTCLibrary.SIP.Interfaces;
using WebRTCLibrary.SIP.Models;

namespace WebRTCClient.Transactions.SIP
{
    /// <summary>Transaction that waits for the Notify that the peer is registered.
    ///          Needs to be its own transaction because the TransactionParams are differnt than the registration params.</summary>
    /// <version date="15.07.2025" sb="MAC">Created.</version>
    public class WaitForPeerTransaction : WebRTCLibrary.SIP.SIPTransaction
    {
        public bool PeerRegistered { get; private set; }

        public WaitForPeerTransaction(SIPSchemesEnum sipScheme, ISIPTransport transport, TransactionParams dialogParams, ILoggerFactory loggerFactory)
            : base(sipScheme, transport, dialogParams, loggerFactory)
        {
        }

        protected async override Task StartRunning()
        {
            await base.StartRunning();
            this.Connection.SIPRequestReceived += this.InitialNotifyListener;
        }

        protected override void StopRunning()
        {
            base.StopRunning();
            this.Connection.SIPRequestReceived -= this.InitialNotifyListener;
            this.PeerRegistered = false;
        }

        private async Task InitialNotifyListener(SIPEndPoint localEndpoint, SIPEndPoint remoteEndPoint, SIPRequest sipRequest)
        {
            if (sipRequest.Method != SIPMethodsEnum.NOTIFY)
            {
                return;
            }

            if (sipRequest.Header.CSeq != this.CurrentCseq
                || string.IsNullOrEmpty(sipRequest.Header.From.FromTag)
                || string.IsNullOrEmpty(sipRequest.Header.CallId))
            {
                // invalid header
                return;
            }

            this.CurrentCseq++;

            this.Connection.SIPRequestReceived -= this.InitialNotifyListener;
            if (this.Ct.IsCancellationRequested)
            {
                // TODO: ConnectionFailed - with reset
                //await this.SendBYEMessage(); // TODO: SendBye
                return;
            }

            this.Params.RemoteTag = sipRequest.Header.From.FromTag;
            this.Params.CallId = sipRequest.Header.CallId;

            this.PeerRegistered = true;
            //await this.PeerRegistered(sipRequest);
        }
    }
}
