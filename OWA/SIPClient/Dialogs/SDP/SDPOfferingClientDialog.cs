using SIPSorcery.Net;
using SIPSorcery.SIP;
using System.Text.Json;
using WebRTCClient.Models;
using WebRTCLibrary.SIP;

using static WebRTCLibrary.Utils.TaskHelpers;


namespace WebRTCClient.Dialogs.SDP
{
    internal class SDPOfferingClientDialog : SDPDialog
    {
        private bool AnswerReceived { get; set; }

        private bool PeerIsAnswering { get; set; }

        public SDPOfferingClientDialog(ISIPMessager connection, RTCPeerConnection peerConnection, int startCseq = 1)
            : base(connection, peerConnection, startCseq)
        {
        }

        public async override Task Start()
        {
            this.Connection.OnRequestReceived += this.ListenForAck;

            await this.SendACK();

            await WaitForAsync(
                () => this.PeerIsAnswering,
                20000, // TODO: Find suitable timeout
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
                IsControllingAgent = true,
            };

            string sdpConfigJson = JsonSerializer.Serialize(sdpConfig);

            await this.Connection.SendRequest(SIPMethodsEnum.ACK, sdpConfigJson, this.StartCSeq);
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

            if (peerSDPConfig.IsControllingAgent)
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

            // TODO: contentType is not set yet. Set it
            //if (request.Header.ContentType != "application/json") // ?
            //{
            //    // wrong content type
            //    return;
            //}

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

            RTCSessionDescriptionInit offer = this.PeerConnection.createOffer(null);
            await this.PeerConnection.setLocalDescription(offer);

            string sdpOfferJson = JsonSerializer.Serialize(new { sdp = offer.sdp, type = "offer" });

            // TODO: set content type header
            await this.Connection.SendRequest(SIPMethodsEnum.SERVICE, sdpOfferJson, this.StartCSeq + 2);

            await WaitFor(
                () => this.AnswerReceived,
                timeOut: 20000); // TODO: get real timeout

            // TODO: For some reason wait for does not wait here. Does it not work in general?
            //this.Connection.OnRequestReceived -= this.ListenForSDPAnswer;
        }
    }
}
