using SIPSorcery.SIP;
using System.Net.Sockets;
using WebRTCLibrary.SIP;
using WebRTCLibrary.SIP.Models;

namespace WebRTCClient.Dialogs
{
    internal class MessagingDialog : SIPDialog
    {

        public event Action<MessagingDialog, SIPRequest>? OnRequest;
        public event Action<MessagingDialog, SIPResponse>? OnResponse;

        public bool Running { get; private set; }

        // TODO: pass transport and set the connection messagePredicate
        public MessagingDialog(SIPConnection connection, DialogParams dialogParams)
            : base(connection, dialogParams)
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
            this.OnRequest?.Invoke(this, sipRequest);

            string message = sipRequest.Body;
        }

        private async Task ResponseRecieved(SIPEndPoint remoteEndpoint, SIPEndPoint localEndpoint, SIPResponse sipResponse)
        {
            this.OnResponse?.Invoke(this, sipResponse);
        }
    }
}
