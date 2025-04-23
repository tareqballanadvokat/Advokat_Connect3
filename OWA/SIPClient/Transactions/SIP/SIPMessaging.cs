using Microsoft.Extensions.Logging;
using SIPSorcery.SIP;
using System.Net.Sockets;
using WebRTCLibrary.SIP;
using WebRTCLibrary.SIP.Models;

namespace WebRTCClient.Transactions.SIP
{
    internal class SIPMessaging : WebRTCLibrary.SIP.SIPTransaction, ISIPMessager
    {
        private readonly ILogger<SIPMessaging> logger;

        public event ISIPMessager.RequestReceivedDelegate? OnRequestReceived;

        public event ISIPMessager.ResponseReceivedDelegate? OnResponseReceived;

        public bool Running { get; private set; }

        public SIPMessaging(SIPSchemesEnum sipScheme, SIPTransport transport, TransactionParams dialogParams, ILoggerFactory loggerFactory)
            : base(sipScheme, transport, dialogParams, loggerFactory)
        {
            this.logger = loggerFactory.CreateLogger<SIPMessaging>();
        }

        public async override Task Start()
        {
            if (Running)
            {
                // already started
                return;
            }

            Connection.SIPRequestReceived += RequestRecieved;
            Connection.SIPResponseReceived += ResponseRecieved;
            Running = true;
        }

        public async override Task Stop()
        {
            if (!Running)
            {
                // not started
                return;
            }

            Connection.SIPRequestReceived -= RequestRecieved;
            Connection.SIPResponseReceived -= ResponseRecieved;
            Running = false;
        }

        public async Task<SocketError> SendSIPRequest(SIPMethodsEnum method, string message, string contentType, int cSeq)
        {
            if (!Running)
            {
                // not running
                return SocketError.NotConnected;
            }

            SIPHeaderParams headerParams = GetHeaderParams(cSeq);

            // TODO: Implement cancellation logic. Where to save tokensource? Which requests should use the same token?
            using CancellationTokenSource cts = new CancellationTokenSource();

            return await Connection.SendSIPRequest(method, headerParams, message, contentType, cts.Token); //pass this.SendTimeout maybe
        }

        public async Task<SocketError> SendSIPResponse(SIPResponseStatusCodesEnum statusCode, string message, string contentType, int cSeq)
        {
            if (!Running)
            {
                // not running
                return SocketError.NotConnected;
            }

            SIPHeaderParams headerParams = GetHeaderParams(cSeq);

            // TODO: Implement cancellation logic. Where to save tokensource? Which requests should use the same token?
            using CancellationTokenSource cts = new CancellationTokenSource();

            return await Connection.SendSIPResponse(statusCode, headerParams, message, contentType, cts.Token); //pass this.SendTimeout maybe
        }

        private async Task RequestRecieved(SIPEndPoint remoteEndpoint, SIPEndPoint localEndpoint, SIPRequest sipRequest)
        {
            // TODO: Check if contenttype is sip message?
            await (OnRequestReceived?.Invoke(this, sipRequest) ?? Task.CompletedTask);
        }

        private async Task ResponseRecieved(SIPEndPoint remoteEndpoint, SIPEndPoint localEndpoint, SIPResponse sipResponse)
        {
            await (OnResponseReceived?.Invoke(this, sipResponse) ?? Task.CompletedTask);
        }

        protected override bool AcceptMessage(SIPMessageBase message)
        {
            return this.Running
                && base.AcceptMessage(message);
        }
    }
}
