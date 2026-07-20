using Advokat.WebRTC.Client.Utils;
using Advokat.WebRTC.Library.SIP.Interfaces;
using SIPSorcery.SIP;
using System.Net;
using System.Net.Sockets;
using WebRTCClient.Transactions.SIP.Interfaces;

namespace SIPClientTests.SDPExchangeTests.Mocks.SIPClient
{
    internal class Mock_SIPClient : ISIPClient
    {
        private SIPConnectionState connectionState;

        public SIPConnectionState ConnectionState
        {
            get
            {
                return this.connectionState;
            }

            set
            {
                SIPConnectionState previousConnectionState = this.ConnectionState;
                this.connectionState = value;
                this.ConnectionStateChanged?.Invoke(this, new SIPConnectionStateEventArgs(previousConnectionState, this.ConnectionState));
            }
        }
        public event EventHandler<SIPConnectionStateEventArgs>? ConnectionStateChanged;

        public event ISIPMessager.RequestReceivedDelegate? OnRequestReceived;
        public event ISIPMessager.ResponseReceivedDelegate? OnResponseReceived;

        public List<(SIPMethodsEnum, string, string, int)> SentRequests = [];

        public ValueTask DisposeAsync()
        {
            throw new NotImplementedException();
        }

        public async Task<SocketError> SendSIPRequest(SIPMethodsEnum method, string message, string contentType, int cSeq)
        {
            this.SentRequests.Add((method, message, contentType, cSeq));
            return SocketError.Success;
        }

        public Task<SocketError> SendSIPResponse(SIPResponseStatusCodesEnum statusCode, string message, string contentType, int cSeq)
        {
            throw new NotImplementedException();
        }

        public async Task ReceiveSIPRequest(SIPMethodsEnum method, string message, string contentType, int cSeq)
        {
            SIPRequest request = new SIPRequest(method, new SIPURI(SIPSchemesEnum.sip, IPAddress.None, 1));
            request.Body = message;
            request.Header = new SIPHeader();
            request.Header.CSeq = cSeq;
            request.Header.ContentType = contentType;
            request.Header.ContentLength = message.Length;

            this.OnRequestReceived?.Invoke(this, request);
        }
    }
}
