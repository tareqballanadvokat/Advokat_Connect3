using SIPSorcery.Net;
using SIPSorcery.SIP;
using System.Text.Json;
using WebRTCClient.Models;
using WebRTCLibrary.SIP;

using static WebRTCLibrary.Utils.TaskHelpers;


namespace WebRTCClient.Transactions.SDP
{
    internal class SDPAnsweringClientTransaction : SDPTransaction
    {
        private bool OfferReceived { get; set; }

        private bool PeerIsOffering { get; set; }

        public SDPAnsweringClientTransaction(ISIPMessager sipConnection, RTCPeerConnection peerConnection, int startCSeq = 1)
            : base(sipConnection, peerConnection, startCSeq)
        {
        }

        public async override Task Start()
        {
            this.Connection.OnRequestReceived += this.ListenForACK;

            await WaitForAsync(
                () => this.PeerIsOffering,
                20000, // TODO: find suitable timeout for offering ack of peer
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

            // TODO: contentType is not set yet. Set it
            //if (request.Header.ContentType != "application/json")
            //{
            //    // wrong content type
            //    return;
            //}


            SDPExchangeConfig? peerSDPConfig = JsonSerializer.Deserialize<SDPExchangeConfig>(request.Body);

            if (peerSDPConfig == null)
            {
                // Could not deserialze body. Fail
                return;
            }

            if (!peerSDPConfig.IsControllingAgent)
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
                IsControllingAgent = false
            };

            string sdpConfigJson = JsonSerializer.Serialize(sdpConfig);
            await this.Connection.SendRequest(SIPMethodsEnum.ACK, sdpConfigJson, this.StartCSeq + 1);

            await WaitForAsync(
                () => this.OfferReceived,
                20000, // TODO: get suitable timeout
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

            // TODO: contentType is not set yet. Set it
            //if (request.Header.ContentType != "application/json")
            //{
            //    // wrong content type
            //    return;
            //}

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

            // TODO: set content type header
            await this.Connection.SendRequest(SIPMethodsEnum.SERVICE, sdpOfferJson, this.StartCSeq + 3);
        }
    }
}
