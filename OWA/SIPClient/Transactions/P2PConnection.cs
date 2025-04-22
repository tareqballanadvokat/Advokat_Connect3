using SIPSorcery.Net;
using SIPSorcery.SIP;
using SIPSorcery.Sys;
using System.Text.Json;
using WebRTCClient.Transactions.SDP;
using WebRTCClient.Models;
using WebRTCLibrary.SIP;
using System.Diagnostics.CodeAnalysis;
using System.Text;

namespace WebRTCClient.Transactions
{
    internal class P2PConnection
    {
        public delegate Task MessageReceivedDelegate(P2PConnection sender, byte[] data);
        
        public event MessageReceivedDelegate? OnMessageReceived;

        // TODO: Can the DataChannel even be open when the PeerConnection is closed? Remove the first condition if that's not the case
        [MemberNotNullWhen(true, nameof(this.SendingDataChannel))]
        private bool IsConnected { get => this.PeerConnection.connectionState == RTCPeerConnectionState.connected && (this.SendingDataChannel?.IsOpened ?? false); }

        private bool IsControllingAgent { get; set; }

        private List<RTCIceServer> IceServers { get; set; }

        private RTCPeerConnection PeerConnection { get; set; }

        private RTCDataChannel? SendingDataChannel { get; set; }

        private RTCDataChannel? ReceivingDataChannel { get; set; }

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

            PortRange portRange = new PortRange(10000, 10010, true); // TODO: Get portrange passed
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
            // TODO: Check if it is already connected?

            this.SIPConnection.OnRequestReceived += this.ListenForSDPAllocation;

            this.PeerConnection.ondatachannel += (RTCDataChannel dataChannel) =>
            {
                //RTCPeerConnection connection = this.PeerConnection;

                //bool same = this.SendingDataChannel == dataChannel;

                this.ReceivingDataChannel = dataChannel;

                this.ReceivingDataChannel.onmessage += async (RTCDataChannel dc, DataChannelPayloadProtocols protocol, byte[] data) =>
                {
                    await (this.OnMessageReceived?.Invoke(this, data) ?? Task.CompletedTask);
                };

                this.ReceivingDataChannel.onclose += () =>
                {
                    // TODO: close sending channel?
                };

                this.ReceivingDataChannel.onerror += (string error) =>
                {
                    // TODO: add event?
                };

            };
        }

        private async Task SetSendingDataChannel()
        {
            string label = this.IsControllingAgent ? "offer" : "answer";

            //Random rand = new Random();

            //const string chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
            //string label = new string(Enumerable.Repeat(chars, 10)
            //    .Select(s => s[rand.Next(s.Length)]).ToArray());

            //if (this.IsControllingAgent)
            //    {
            this.SendingDataChannel = await this.PeerConnection.createDataChannel(label);

            this.SendingDataChannel.onopen += () =>
            {
                //    Log("Data Channel opened.");
            };

            //this.SendingDataChannel.onmessage += async (RTCDataChannel dc, DataChannelPayloadProtocols protocol, byte[] data) =>
            //{
            //    await (this.OnMessageReceived?.Invoke(this, data) ?? Task.CompletedTask);
            //};

            this.SendingDataChannel.onclose += () =>
            {
                // TODO: close receiving channel?
            };

            this.SendingDataChannel.onerror += (string error) =>
            {
                // TODO: add event?
            };
            //}
        }

        public async Task SendMessage(string message)
        {
            if (!this.IsConnected)
            {
                // Socketerror - not connected?
                return;
            }

            byte[] messageBytes = Encoding.UTF8.GetBytes(message);
            this.SendingDataChannel.send(messageBytes);
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

            if (request.Header.ContentType != "application/json")
            {
                // wrong content type
                return;
            }

            SDPExchangeConfig? sdpConfig = JsonSerializer.Deserialize<SDPExchangeConfig>(request.Body);

            if (sdpConfig == null)
            {
                // Could not deserialze body. Fail
                return;
            }

            this.IsControllingAgent = sdpConfig.IsOffering;
            await this.SetSendingDataChannel();

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
