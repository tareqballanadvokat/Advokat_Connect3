using Microsoft.Extensions.Logging;
using SIPSorcery.Net;
using SIPSorcery.SIP;
using System.Text.Json;
using WebRTCClient.Models;
using WebRTCLibrary.SIP.Interfaces;
using static WebRTCLibrary.Utils.TaskHelpers;


namespace WebRTCClient.Transactions.SDP
{
    internal class SDPAnsweringClientTransaction : SDPTransaction
    {
        private readonly ILogger<SDPAnsweringClientTransaction> logger;

        private bool OfferReceived { get; set; }

        private bool PeerIsOffering { get; set; }

        public SDPAnsweringClientTransaction(ISIPMessager sipConnection, RTCPeerConnection peerConnection, ILoggerFactory loggerFactory)
            : base(sipConnection, peerConnection)
        {
            this.logger = loggerFactory.CreateLogger<SDPAnsweringClientTransaction>();
        }

        public async override Task Start()
        {
            this.Connection.OnRequestReceived += this.ListenForACK;

            await WaitForAsync(
                () => this.PeerIsOffering,
                20000, // TODO: find suitable timeout for offering ack of peer
                ct: CancellationToken.None, // TODO: implement cancellation logic
                successCallback: this.SendACK
                // TODO: failurecallback
                );
            
            // TODO: For some reason wait for does not wait here. Does it not work in general?
            //this.Connection.OnRequestReceived -= this.ListenForACK;
        }

        private async Task ListenForACK(ISIPMessager sender, SIPRequest request)
        {
            if (request.Method != SIPMethodsEnum.ACK)
            {
                // not a ACK - ignore?
                return;
            }

            if (request.Header.CSeq != this.StartCSeq)
            {
                // Fail?
                return;
            }

            if (request.Header.ContentLength == 0 || request.Body.Length == 0)
            {
                // body is empty. Fail
                return;
            }

            if (request.Header.ContentType != SDPAllocationContentType)
            {
                // wrong content type
                return;
            }


            SDPExchangeConfig? peerSDPConfig = JsonSerializer.Deserialize<SDPExchangeConfig>(request.Body);

            if (peerSDPConfig == null)
            {
                // Could not deserialze body. Fail
                return;
            }

            if (!peerSDPConfig.IsOffering)
            {
                // peer did is set to answering - should be offering. Fail?
                return;
            }

            this.PeerIsOffering = true;
        }

        private async Task SendACK()
        {
            this.Connection.OnRequestReceived += this.ListenForSDPOffer;

            SDPExchangeConfig sdpConfig = new SDPExchangeConfig
            {
                IsOffering = false
            };

            string sdpConfigJson = JsonSerializer.Serialize(sdpConfig);
            await this.Connection.SendSIPRequest(SIPMethodsEnum.ACK, sdpConfigJson, SDPAllocationContentType, this.StartCSeq + 1);

            await WaitForAsync(
                () => this.OfferReceived,
                20000, // TODO: get suitable timeout
                ct: CancellationToken.None, // TODO: implement cancellation logic
                successCallback: this.SendSDPAnswer
                // TODO: Failurecallback?
                );

            // TODO: For some reason wait for does not wait here. Does it not work in general?
            //this.Connection.OnRequestReceived -= this.ListenForSDPOffer;
        }


        private async Task ListenForSDPOffer(ISIPMessager sender, SIPRequest request)
        {
            if (request.Method != SIPMethodsEnum.SERVICE)
            {
                // not a Service - ignore?
                return;
            }

            if (request.Header.CSeq != this.StartCSeq + 2)
            {
                // Fail?
                return;
            }

            if (request.Header.ContentLength == 0 || request.Body.Length == 0)
            {
                // body is empty. Fail
                return;
            }

            if (request.Header.ContentType != SDPContentType)
            {
                // wrong content type
                return;
            }

            if (!request.Body.Contains("\"sdp\":") || !request.Body.Contains("offer"))
            {
                // invalid. Not a sdp offer
                return;
            }

            bool success = RTCSessionDescriptionInit.TryParse(request.Body, out RTCSessionDescriptionInit? initialization);

            if (!success)
            {
                // response could not parse SDP / ICE Candidates
                return;
            }

            this.PeerConnection.setRemoteDescription(initialization);
            this.OfferReceived = true;
        }

        private async Task SendSDPAnswer()
        {
            RTCSessionDescriptionInit answer = this.PeerConnection.createAnswer(null);
            await this.PeerConnection.setLocalDescription(answer);

            string sdpOfferJson = JsonSerializer.Serialize(new { sdp = answer.sdp, type = "answer" });

            this.logger.LogDebug("Sending SDP answer.");
            await this.Connection.SendSIPRequest(SIPMethodsEnum.SERVICE, sdpOfferJson, SDPContentType, this.StartCSeq + 3);
        }
    }
}
