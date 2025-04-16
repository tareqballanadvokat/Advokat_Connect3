using SIPSorcery.Net;
using SIPSorcery.SIP;
using SIPSorcery.Sys;
using System.Text.Json;
using WebRTCClient.Dialogs.SDP;
using WebRTCClient.Models;
using WebRTCLibrary.SIP;

namespace WebRTCClient.Dialogs
{
    internal class P2PConnectionDialog
    {
        private bool IsControllingAgent { get; set; }

        private List<RTCIceServer> IceServers { get; set; }

        private RTCPeerConnection PeerConnection { get; set; }

        private SDPDialog? SDPDialog { get; set; }

        private ISIPMessager SIPConnection { get; set; }

        private bool ICECandidatesReady { get; set; } // TODO: we should wait with the negotiation until this is true?

        public P2PConnectionDialog(ISIPMessager connection, List<RTCIceServer> iceServers)
        {
            this.IceServers = iceServers;
            this.SIPConnection = connection;

            RTCConfiguration config = new RTCConfiguration
            {
                iceServers = this.IceServers
            };

            PortRange portRange = new PortRange(10000, 10010, true); // YES! we can limit portrange - not tested
            this.PeerConnection = new RTCPeerConnection(config, portRange: portRange);

            this.PeerConnection.onnegotiationneeded += () => { this.ICECandidatesReady = true; };
            this.PeerConnection.onconnectionstatechange += (cstate) => {

            };
        }

        //public P2PConnectionDialog(SIPSchemesEnum sipScheme, SIPTransport transport, DialogParams dialogParams)
        //    : base(sipScheme, transport, dialogParams)
        //{
        //}

        public async Task Start()
        {
            this.SIPConnection.OnRequestReceived += this.ListenForNotify;

            RTCDataChannel dataChannel = await this.PeerConnection.createDataChannel("dc1", null);

            dataChannel.onopen += () =>
            {
                //    Log("Data Channel opened.");
            };

            //this.PeerConnection.onmessage += (dc, protocol, data) => { };
            ////    Log($"Message received: {Encoding.UTF8.GetString(data)}");
            //this.PeerConnection.onclose += () =>
            //{
            //    //Log("Data Channel closed.")
            //};

            // TODO: wait for something?
        }

        private async Task ListenForNotify(ISIPMessager sender, SIPRequest request)
        {
            if (request.Method != SIPMethodsEnum.NOTIFY)
            {
                // not a notify - ignore?
                return;
            }

            if (request.Header.CSeq != 1)
            {
                // not first message of dialog. Fail?
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

            SDPExchangeConfig? sdpConfig = JsonSerializer.Deserialize<SDPExchangeConfig>(request.Body);

            if (sdpConfig == null)
            {
                // Could not deserialze body. Fail
                return;
            }

            this.IsControllingAgent = sdpConfig.IsControllingAgent;

            await this.StartICEExchange();
        }

        private async Task StartICEExchange()
        {

            //RTCDataChannel channel = await this.PeerConnection.createDataChannel("doWeHaveToMatch?"); // ??
            //await this.PeerConnection.Start(); // ??


            if (this.IsControllingAgent)
            {
                this.SDPDialog = new SDPOfferingClientDialog(this.SIPConnection, this.PeerConnection, 2);
            }
            else
            {
                this.SDPDialog = new SDPAnsweringClientDialog(this.SIPConnection, this.PeerConnection, 2);
            }

            await this.SDPDialog.Start();
        }
    }
}
