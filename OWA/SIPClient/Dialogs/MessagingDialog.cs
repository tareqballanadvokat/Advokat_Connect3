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

        public bool Listening { get; private set; }

        // TODO: pass transport and set the connection messagePredicate
        public MessagingDialog(DialogParams dialogParams, SIPConnection connection)
            : base(dialogParams, connection)
        {
        }

        public async override Task Start()
        {
            if (this.Listening)
            {
                // already started
                return;
            }

            this.Connection.SIPRequestReceived += this.RequestRecieved;
            this.Connection.SIPResponseReceived += this.ResponseRecieved;
        }

        public async override Task Stop()
        {
            if (!this.Listening)
            {
                // not started
                return;
            }

            this.Connection.SIPRequestReceived -= this.RequestRecieved;
            this.Connection.SIPResponseReceived -= this.ResponseRecieved;
        }

        public async Task<SocketError> SendRequest(SIPMethodsEnum method, string? message = null, int cSeq = 1)
        {
            SIPHeaderParams headerParams = this.GetHeaderParams(cSeq);
            return await this.Connection.SendSIPRequest(method, headerParams, message); //pass this.SendTimeout maybe
        }

        public async Task<SocketError> SendResponse(SIPResponseStatusCodesEnum statusCode, string? message = null, int cSeq = 1)
        {
            SIPHeaderParams headerParams = this.GetHeaderParams(cSeq);
            return await this.Connection.SendSIPResponse(statusCode, headerParams, message); //pass this.SendTimeout maybe
        }


        private async Task RequestRecieved(SIPEndPoint remoteEndpoint, SIPEndPoint localEndpoint, SIPRequest sipRequest)
        {
            this.OnRequest?.Invoke(this, sipRequest);
        }

        private async Task ResponseRecieved(SIPEndPoint remoteEndpoint, SIPEndPoint localEndpoint, SIPResponse sipResponse)
        {
            this.OnResponse?.Invoke(this, sipResponse);
        }
    }
}
