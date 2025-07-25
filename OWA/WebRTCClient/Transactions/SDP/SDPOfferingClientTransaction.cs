using Microsoft.Extensions.Logging;
using SIPSorcery.Net;
using SIPSorcery.SIP;
using System.Text.Json;
using WebRTCClient.Models;
using WebRTCLibrary.SIP.Interfaces;
using static WebRTCLibrary.Utils.TaskHelpers;

namespace WebRTCClient.Transactions.SDP
{
    internal class SDPOfferingClientTransaction : SDPTransaction
    {
        private readonly ILogger<SDPOfferingClientTransaction> logger;

        private bool AnswerReceived { get; set; }

        private bool PeerIsAnswering { get; set; }

        public SDPOfferingClientTransaction(ISIPMessager sipConnection, RTCPeerConnection peerConnection, ILoggerFactory loggerFactory)
            : base(sipConnection, peerConnection)
        {
            this.logger = loggerFactory.CreateLogger<SDPOfferingClientTransaction>();
        }

        public async override Task Start()
        {
            await base.Start();
            this.Connection.OnRequestReceived += this.ListenForAck;

            await this.SendACK();

            await WaitForAsync(
                () => this.PeerIsAnswering,
                20000, // TODO: Find suitable timeout
                ct: CancellationToken.None, // TODO: implement cancellation logic
                successCallback: this.SendSDPOffer
                // TODO: failurecallback ? 
                );
            
            // TODO: For some reason wait for does not wait here. Does it not work in general?
            //this.Connection.OnRequestReceived -= this.ListenForAck;
        }

        private async Task SendACK()
        {
            SDPExchangeConfig sdpConfig = new SDPExchangeConfig()
            {
                IsOffering = true,
            };

            string sdpConfigJson = JsonSerializer.Serialize(sdpConfig);

            await this.Connection.SendSIPRequest(SIPMethodsEnum.ACK, sdpConfigJson, SDPAllocationContentType, this.StartCSeq);
        }

        private async Task ListenForAck(ISIPMessager sender, SIPRequest request)
        {
            if (request.Method != SIPMethodsEnum.ACK)
            {
                // not a Ack - ignore?
                return;
            }

            if (request.Header.CSeq != this.StartCSeq + 1)
            {
                // Fail?
                return;
            }

            if (request.Header.ContentLength == 0 || request.Body.Length == 0)
            {
                // body is empty. Fail
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

            if (peerSDPConfig.IsOffering)
            {
                // Peer is set to offer - should be answering. Fail
                return;
            }
            
            this.PeerIsAnswering = true;
        }

        private async Task ListenForSDPAnswer(ISIPMessager sender, SIPRequest request)
        {
            if (request.Method != SIPMethodsEnum.SERVICE)
            {
                // not a notify - ignore?
                return;
            }

            if (request.Header.CSeq != this.StartCSeq + 3)
            {
                // not first message of dialog. Fail?
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

            if (!request.Body.Contains("\"sdp\":") || !request.Body.Contains("answer"))
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
            this.AnswerReceived = true;
        }

        private async Task SendSDPOffer()
        {
            this.Connection.OnRequestReceived += this.ListenForSDPAnswer; 

            RTCSessionDescriptionInit offer = this.PeerConnection.createOffer();
            await this.PeerConnection.setLocalDescription(offer);

            string sdpOfferJson = JsonSerializer.Serialize(new { sdp = offer.sdp, type = "offer" });

            this.logger.LogDebug("Sending SDP offer.");
            await this.Connection.SendSIPRequest(SIPMethodsEnum.SERVICE, sdpOfferJson, SDPContentType, this.StartCSeq + 2);

            await WaitFor(
                () => this.AnswerReceived,
                timeOut: 20000, // TODO: get real timeout
                ct: CancellationToken.None // TODO: implement cancellation logic
                );

            // TODO: For some reason wait for does not wait here. Does it not work in general?
            //this.Connection.OnRequestReceived -= this.ListenForSDPAnswer;
        }
    }
}
