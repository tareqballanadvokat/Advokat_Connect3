using SIPSorcery.SIP;
using System.Net.Sockets;
using WebRTCLibrary.SIP;
using WebRTCLibrary.SIP.Models;
using static WebRTCLibrary.SIP.ISIPMessager;

namespace WebRTCClient.Dialogs
{
    internal class MessagingDialog : SIPDialog, ISIPMessager
    {
        public event RequestReceivedDelegate? OnRequestReceived;

        public event ResponseReceivedDelegate? OnResponseReceived;

        public bool Running { get; private set; }

        public MessagingDialog(SIPSchemesEnum sipScheme, SIPTransport transport, DialogParams dialogParams)
            : base(sipScheme, transport, dialogParams)
        {
        }

        public async override Task Start()
        {
            if (this.Running)
            {
                // already started
                return;
            }

            this.Connection.SIPRequestReceived += this.RequestRecieved;
            this.Connection.SIPResponseReceived += this.ResponseRecieved;
            this.Running = true;
        }

        public async override Task Stop()
        {
            if (!this.Running)
            {
                // not started
                return;
            }

            this.Connection.SIPRequestReceived -= this.RequestRecieved;
            this.Connection.SIPResponseReceived -= this.ResponseRecieved;
            this.Running = false;
        }

        public async Task<SocketError> SendRequest(SIPMethodsEnum method, string? message, int cSeq)
        {
            if (!Running)
            {
                // not running
                return SocketError.NotConnected;
            }

            SIPHeaderParams headerParams = this.GetHeaderParams(cSeq);
            return await this.Connection.SendSIPRequest(method, headerParams, message); //pass this.SendTimeout maybe
        }

        public async Task<SocketError> SendResponse(SIPResponseStatusCodesEnum statusCode, string? message, int cSeq)
        {
            if (!Running)
            {
                // not running
                return SocketError.NotConnected;
            }

            SIPHeaderParams headerParams = this.GetHeaderParams(cSeq);
            return await this.Connection.SendSIPResponse(statusCode, headerParams, message); //pass this.SendTimeout maybe
        }

        private async Task RequestRecieved(SIPEndPoint remoteEndpoint, SIPEndPoint localEndpoint, SIPRequest sipRequest)
        {
            await (this.OnRequestReceived?.Invoke(this, sipRequest) ?? Task.CompletedTask);
        }

        private async Task ResponseRecieved(SIPEndPoint remoteEndpoint, SIPEndPoint localEndpoint, SIPResponse sipResponse)
        {
            await (this.OnResponseReceived?.Invoke(this, sipResponse) ?? Task.CompletedTask);
        }

        protected override bool AcceptMessage(SIPMessageBase message)
        {
            return base.AcceptMessage(message)
                && this.Running;
        }
    }
}
