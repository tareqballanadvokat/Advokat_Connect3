using SIPSorcery.SIP;
using System.Net.Sockets;
using WebRTCLibrary.SIP;
using WebRTCLibrary.SIP.Models;

namespace WebRTCClient.Transactions.SIP
{
    internal class SIPMessaging : WebRTCLibrary.SIP.SIPTransaction, ISIPMessager
    {
        public event ISIPMessager.RequestReceivedDelegate? OnRequestReceived;

        public event ISIPMessager.ResponseReceivedDelegate? OnResponseReceived;

        public bool Running { get; private set; }

        public SIPMessaging(SIPSchemesEnum sipScheme, SIPTransport transport, TransactionParams dialogParams)
            : base(sipScheme, transport, dialogParams)
        {
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

        public async Task<SocketError> SendRequest(SIPMethodsEnum method, string? message, int cSeq)
        {
            if (!Running)
            {
                // not running
                return SocketError.NotConnected;
            }

            SIPHeaderParams headerParams = GetHeaderParams(cSeq);
            return await Connection.SendSIPRequest(method, headerParams, message); //pass this.SendTimeout maybe
        }

        public async Task<SocketError> SendResponse(SIPResponseStatusCodesEnum statusCode, string? message, int cSeq)
        {
            if (!Running)
            {
                // not running
                return SocketError.NotConnected;
            }

            SIPHeaderParams headerParams = GetHeaderParams(cSeq);
            return await Connection.SendSIPResponse(statusCode, headerParams, message); //pass this.SendTimeout maybe
        }

        private async Task RequestRecieved(SIPEndPoint remoteEndpoint, SIPEndPoint localEndpoint, SIPRequest sipRequest)
        {
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
