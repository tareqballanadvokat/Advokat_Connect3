using Microsoft.Extensions.Logging;
using SIPSignalingServer.Models;
using SIPSorcery.SIP;
using System.Net.Sockets;
using WebRTCLibrary.Interfaces;
using WebRTCLibrary.SIP;
using WebRTCLibrary.SIP.Models;

namespace SIPSignalingServer.Transactions
{
    internal class SIPMessageRelay : ServerSideSIPTransaction
    {
        private readonly ILogger<SIPMessageRelay> logger;

        public bool Relaying { get; private set; }

        public SIPMessageRelay(ISIPConnection connection, ServerSideTransactionParams transactionParams, ILoggerFactory loggerFactory)
            : base(connection, transactionParams, loggerFactory)
        {
            //this.loggerFactory = loggerFactory;
            this.logger = loggerFactory.CreateLogger<SIPMessageRelay>();
        }

        public delegate Task RequestReceivedDelegate(SIPMessageRelay sender, SIPRequest request);
        public delegate Task ResponseReceivedDelegate(SIPMessageRelay sender, SIPResponse response);

        public event RequestReceivedDelegate? OnRequestReceived;
        public event ResponseReceivedDelegate? OnResponseReceived;

        public async Task RelayRequest(SIPMessageRelay sender, SIPRequest request)
        {
            if (this.Relaying)
            {
                // TODO: Get cancellationToken passed?
                using CancellationTokenSource cts = new CancellationTokenSource();
                SIPHeaderParams headerParams = this.GetHeaderParams(request.Header.CSeq);
                
                this.logger.LogDebug(
                    "<> Relaying {method} {cSeq} - from: '{from}', to:\"{to}\" toTag:\"{toTag}\".",
                    request.Method,
                    headerParams.CSeq,
                    request.Header.From,
                    headerParams.DestinationParticipant,
                    headerParams.ToTag);

                // TODO: maybe check if request matches transactionParams?

                SocketError sendingStatus = await this.Connection.SendSIPRequest(
                    request.Method,
                    headerParams,
                    request.Body,
                    request.Header.ContentType,
                    cts.Token);

                if (sendingStatus != SocketError.Success)
                {
                    // TODO: do something here. Relay failed
                    //       Maybe send message to sending client
                }
            }
        }

        // TODO: Remove? or make this a full ISIPMessager? This is currently used for Notify to start SDP negotiation
        public async Task SendRequest(SIPMethodsEnum method, string message, string contentType, int cSeq = 1)
        {
            if (this.Relaying)
            {
                // TODO: Get cancellationToken passed?
                using CancellationTokenSource cts = new CancellationTokenSource();
                SIPHeaderParams headersParams = this.GetHeaderParams(cSeq);
                
                await this.Connection.SendSIPRequest(
                    method,
                    this.GetHeaderParams(cSeq),
                    message,
                    contentType,
                    cts.Token);
            }
        }

        public async Task RelayResponse(SIPMessageRelay sender, SIPResponse response)
        {

            if (this.Relaying)
            {
                // TODO: Get cancellationToken passed?
                using CancellationTokenSource cts = new CancellationTokenSource();
                //this.logger.LogDebug(
                //    "<> Relaying {statusCode} {cSeq} - from: '{from}', to:\"{to}\" toTag:\"{toTag}\".",
                //    response.StatusCode,
                //    headerParams.CSeq,
                //    response.Header.From,
                //    headerParams.DestinationParticipant,
                //    headerParams.ToTag);

                // TODO: I think this has to be fixed aswell - Headerparams are not correct
                SocketError sendingStatus = await this.Connection.SendSIPResponse(response, cts.Token);

                if (sendingStatus != SocketError.Success)
                {
                    // TODO: do something here. Relay failed.
                    //       Maybe send message to sending client
                }
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
