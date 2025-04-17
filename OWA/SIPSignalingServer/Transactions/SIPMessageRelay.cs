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
            // TODO: Get cancellationToken passed?
            using CancellationTokenSource cts = new CancellationTokenSource();

            if (this.Relaying)
            {
                // TODO: maybe check SocketError?
                // TODO: maybe check if request matches transactionParams?
                await this.Connection.SendSIPRequest(
                    request.Method, 
                    this.GetHeaderParams(request.Header.CSeq),
                    request.Body,
                    request.Header.ContentType,
                    cts.Token);
            }
        }

        // TODO: Remove? or make this a full ISIPMessager? This is currently used for Notify to start SDP negotiation
        public async Task SendRequest(SIPMethodsEnum method, string message, string contentType, int cSeq = 1)
        {
            // TODO: Get cancellationToken passed?
            using CancellationTokenSource cts = new CancellationTokenSource();

            if (this.Relaying)
            {
                await this.Connection.SendSIPRequest(method, this.GetHeaderParams(cSeq), message, contentType, cts.Token);
            }
        }

        public async Task RelayResponse(SIPMessageRelay sender, SIPResponse response)
        {
            // TODO: Get cancellationToken passed?
            using CancellationTokenSource cts = new CancellationTokenSource();

            if (this.Relaying)
            {
                // TODO: I think this has to be fixed aswell - Headerparams are not correct
                await this.Connection.SendSIPResponse(response, cts.Token);
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
