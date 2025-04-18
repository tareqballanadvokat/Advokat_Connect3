using SIPSorcery.Net;
using SIPSorcery.SIP;
using SIPSorcery.Sys;
using System.Text.Json;
using WebRTCClient.Transactions.SDP;
using WebRTCClient.Models;
using WebRTCLibrary.SIP;
using System.Diagnostics.CodeAnalysis;
using System.Text;
using System.Diagnostics;

namespace WebRTCClient.Transactions
{
    internal class P2PConnection
    {
        // TODO: Can the DataChannel even be open when the PeerConnection is closed? Remove the first condition if that's not the case
        [MemberNotNullWhen(true, nameof(this.DataChannel))]
        private bool IsConnected { get => this.PeerConnection.connectionState == RTCPeerConnectionState.connected && (this.DataChannel?.IsOpened ?? false); }

        private bool IsControllingAgent { get; set; }

        private List<RTCIceServer> IceServers { get; set; }

        private RTCPeerConnection PeerConnection { get; set; }

        private RTCDataChannel? DataChannel { get; set; }

        private SDPTransaction? SDPDialog { get; set; }

        private ISIPMessager SIPConnection { get; set; }

        private bool ICECandidatesReady { get; set; } // TODO: we should wait with the negotiation until this is true?

        public P2PConnection(ISIPMessager sipConnection, List<RTCIceServer> iceServers)
        {
            this.IceServers = iceServers;
            this.SIPConnection = sipConnection;

            RTCConfiguration config = new RTCConfiguration
            {
                iceServers = this.IceServers
            };

            PortRange portRange = new PortRange(10000, 10010, true); // YES! we can limit portrange - not tested
            this.PeerConnection = new RTCPeerConnection(config, portRange: portRange);

            this.PeerConnection.onnegotiationneeded += () =>
            {
                // TODO: Check if this gets called when STUN servers are reachable. Does not get called when they are not available (current PC)
                this.ICECandidatesReady = true;
            };
            this.PeerConnection.onconnectionstatechange += (cstate) => {
                // TODO: Do we need to close the data channel manually?
            };
        }

        //public P2PConnectionDialog(SIPSchemesEnum sipScheme, SIPTransport transport, DialogParams dialogParams)
        //    : base(sipScheme, transport, dialogParams)
        //{
        //}

        public async Task Start()
        {
            this.SIPConnection.OnRequestReceived += this.ListenForSDPAllocation;

            this.PeerConnection.ondatachannel += (RTCDataChannel dataChannel) =>
            {
                //RTCPeerConnection connection = this.PeerConnection;

                bool same = this.DataChannel == dataChannel;

                this.DataChannel = dataChannel;
            };

            //string label = this.IsControllingAgent ? "offer" : "answer";

            //if (this.IsControllingAgent)
            //    {
            this.DataChannel = await this.PeerConnection.createDataChannel("label");
            
            this.DataChannel.onopen += () =>
            {
                //    Log("Data Channel opened.");
            };

            this.DataChannel.onmessage += (RTCDataChannel dc, DataChannelPayloadProtocols protocol, byte[] data) =>
            {
                Debug.WriteLine($"message received {Encoding.UTF8.GetString(data)}"); // DEBUG
            };

            this.DataChannel.onclose += () =>
            {

            };

            this.DataChannel.onerror += (string error) =>
            {

            };
            //}

            // TODO: wait for something?
        }

        public async Task SendMessage(string message)
        {
            if (!this.IsConnected)
            {
                // Socketerror - not connected?
                return;
            }

            byte[] messageBytes = Encoding.UTF8.GetBytes(message);
            this.DataChannel.send(messageBytes);

            //this.DataChannel.send(message);
        }
        

        private async Task ListenForSDPAllocation(ISIPMessager sender, SIPRequest request)
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

            this.IsControllingAgent = sdpConfig.IsOffering;

            await this.StartICEExchange();
        }

        private async Task StartICEExchange()
        {
            if (this.IsControllingAgent)
            {
                this.SDPDialog = new SDPOfferingClientTransaction(this.SIPConnection, this.PeerConnection, 2);
            }
            else
            {
                this.SDPDialog = new SDPAnsweringClientTransaction(this.SIPConnection, this.PeerConnection, 2);
            }

            await this.SDPDialog.Start();
        }
    }
}
