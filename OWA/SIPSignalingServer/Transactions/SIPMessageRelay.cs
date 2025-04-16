using SIPSignalingServer.Models;
using SIPSorcery.SIP;
using WebRTCLibrary.SIP;

namespace SIPSignalingServer.Transactions
{
    internal class SIPMessageRelay : ServerSideSIPTransaction
    {
        public bool Relaying { get; private set; }

        public SIPMessageRelay(SIPConnection connection, ServerSideTransactionParams transactionParams)
            : base(connection, transactionParams)
        {
        }

        public delegate Task RequestReceivedDelegate(SIPMessageRelay sender, SIPRequest request);
        public delegate Task ResponseReceivedDelegate(SIPMessageRelay sender, SIPResponse response);

        public event RequestReceivedDelegate? OnRequestReceived;
        public event ResponseReceivedDelegate? OnResponseReceived;

        public async Task RelayRequest(SIPMessageRelay sender, SIPRequest request)
        {
            if (this.Relaying)
            {
                // TODO: maybe check SocketError?
                // TODO: maybe check if request matches transactionParams?
                
                await this.Connection.SendSIPRequest(request.Method, this.GetHeaderParams(request.Header.CSeq), request.Body);
            }
        }

        // TODO: Remove? This is currently used for Notify to start SDP negotiation
        public async Task SendRequest(SIPMethodsEnum method, string? message, int cSeq = 1)
        {
            if (this.Relaying)
            {
                await this.Connection.SendSIPRequest(method, this.GetHeaderParams(cSeq), message);
            }
        }

        public async Task RelayResponse(SIPMessageRelay sender, SIPResponse response)
        {
            if (this.Relaying)
            {
                await this.Connection.SendSIPResponse(response);
            }
        }

        private async Task ReceiveMessage(SIPEndPoint _, SIPEndPoint __, SIPRequest request)
        {
            if (this.Relaying)
            {
                await (this.OnRequestReceived?.Invoke(this, request) ?? Task.CompletedTask);
            }
        }

        private async Task ReceiveMessage(SIPEndPoint _, SIPEndPoint __, SIPResponse response)
        {
            if (this.Relaying)
            {
                await (this.OnResponseReceived?.Invoke(this, response) ?? Task.CompletedTask);
            }
        }

        public async override Task Start()
        {
            if (this.Relaying)
            {
                // already relaying
                return;
            }

            this.Connection.SIPRequestReceived += this.ReceiveMessage;
            this.Connection.SIPResponseReceived += this.ReceiveMessage;
            this.Relaying = true;
        }

        public async override Task Stop()
        {
            if (!this.Relaying)
            {
                // not started
                return;
            }

            this.Connection.SIPRequestReceived -= this.ReceiveMessage;
            this.Connection.SIPResponseReceived -= this.ReceiveMessage;
            this.Relaying = false;
        }
    }
}
