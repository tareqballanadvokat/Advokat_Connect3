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

        // TODO: pass transport and set the connection messagePredicate
        public MessagingDialog(DialogParams dialogParams, SIPConnection connection) : base(dialogParams, connection)
        {
        }

        public async override Task Start()
        {
            this.Connection.SIPRequestReceived += this.RequestRecieved;
            this.Connection.SIPResponseReceived += this.ResponseRecieved;
        }

        public async override Task Stop()
        {
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
            if (!this.IsPartOfDialog(sipRequest))
            {
                // not part of dialog - ignore
                return;
            }

            this.OnRequest?.Invoke(this, sipRequest);
        }

        private async Task ResponseRecieved(SIPEndPoint remoteEndpoint, SIPEndPoint localEndpoint, SIPResponse sipResponse)
        {
            if (!this.IsPartOfDialog(sipResponse))
            {
                // not part of dialog - ignore
                return;
            }

            this.OnResponse?.Invoke(this, sipResponse);
        }
    }
}
