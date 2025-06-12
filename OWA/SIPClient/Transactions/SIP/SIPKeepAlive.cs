using Microsoft.Extensions.Logging;
using SIPSorcery.SIP;
using WebRTCLibrary.SIP.Interfaces;
using WebRTCLibrary.SIP.Models;

namespace WebRTCClient.Transactions.SIP
{
    internal class SIPKeepAlive : WebRTCLibrary.SIP.SIPTransaction
    {
        private readonly ILogger<SIPKeepAlive> logger;

        public bool WaitingForPeer { get; set; }

        public SIPKeepAlive(ISIPConnection connection, TransactionParams dialogParams, ILoggerFactory loggerFactory)
            : base(connection, dialogParams, loggerFactory)
        {
            this.logger = loggerFactory.CreateLogger<SIPKeepAlive>();
        }
        protected async override Task Start()
        {
        }

        // TODO: Use ct
        public async override Task Start(CancellationToken? ct = null)
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

            // TODO: Implement cancellation logic. Where to save tokensource? Which requests should use the same token?
            using CancellationTokenSource cts = new CancellationTokenSource();

            await Connection.SendSIPRequest(SIPMethodsEnum.PING, GetHeaderParams(sipRequest.Header.CSeq + 1), cts.Token);
        }

        //public async override Task Stop()
        //{
        //    WaitingForPeer = false;
        //    Connection.SIPRequestReceived -= PingListener;
        //}
    }
}
