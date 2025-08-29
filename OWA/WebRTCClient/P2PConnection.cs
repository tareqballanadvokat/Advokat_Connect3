using Microsoft.Extensions.Logging;
using SIPSorcery.Net;
using SIPSorcery.SIP;
using SIPSorcery.Sys;
using System.Diagnostics.CodeAnalysis;
using System.Text;
using System.Text.Json;
using WebRTCClient.Configs;
using WebRTCClient.Configs.Interfaces;
using WebRTCClient.Models;
using WebRTCClient.Transactions.SDP;
using WebRTCClient.Transactions.SIP.Interfaces;
using WebRTCLibrary.SIP.Interfaces;
using static Org.BouncyCastle.Math.EC.ECCurve;

namespace WebRTCClient
{
    internal class P2PConnection
    {
        private readonly ILoggerFactory loggerFactory;

        private readonly ILogger<P2PConnection> logger;

        public IP2PConnectionConfig Config { get; set; } 

        public delegate Task MessageReceivedDelegate(P2PConnection sender, byte[] data);
        
        public event MessageReceivedDelegate? OnMessageReceived;

        // TODO: Can the DataChannels even be open when the PeerConnection is closed? Remove the first condition if that's not the case
        [MemberNotNullWhen(true, nameof(this.SendingDataChannel))]
        [MemberNotNullWhen(true, nameof(this.ReceivingDataChannel))]
        public bool IsConnected
        {
            get => this.PeerConnection.connectionState == RTCPeerConnectionState.connected
                && (this.SendingDataChannel?.IsOpened ?? false)
                && (this.ReceivingDataChannel?.IsOpened ?? false);
        }

        private bool IsControllingAgent { get; set; }

        private RTCPeerConnection PeerConnection { get; set; }

        private RTCDataChannel? SendingDataChannel { get; set; }

        private RTCDataChannel? ReceivingDataChannel { get; set; }

        private SDPTransaction? SDPDialog { get; set; }

        private ISIPClient SIPConnection { get; set; }

        private bool ICECandidatesReady { get; set; } // TODO: we should wait with the negotiation until this is true?

        private List<RTCIceServer> IceServers { get; set; }

        public P2PConnection(ISIPClient sipConnection, IReadOnlyList<RTCIceServer> iceServers, ILoggerFactory loggerFactory)
        {
            this.loggerFactory = loggerFactory;
            this.logger = this.loggerFactory.CreateLogger<P2PConnection>();

            this.SIPConnection = sipConnection;
            this.IceServers = iceServers.ToList();

            this.Config = new P2PConnectionConfig();
        }

        public async Task Start()
        {
            // TODO: Check if it is already connected?

            RTCConfiguration rtcConfig = new RTCConfiguration
            {
                iceServers = this.IceServers,
                // TODO: set Dtls certificate here.
            };

            // TODO: threw exception "System.ApplicationException: 'Failed to create and bind RTP socket using bind address :::10004(portRange=[10000,10009],useDualMode=True,requireEvenPort=True,createControlSocket=False,protocolType=Udp).'

            this.PeerConnection = new RTCPeerConnection(rtcConfig, portRange: this.Config.PortRange);
            this.PeerConnection.onnegotiationneeded += () =>
            {
                // TODO: Check if this gets called when STUN servers are reachable. Does not get called when they are not available (current PC)
                this.ICECandidatesReady = true;
            };
            this.PeerConnection.onconnectionstatechange += (cstate) => {
                // TODO: Do we need to close the data channel manually?
            };

            this.SIPConnection.OnRequestReceived += this.ListenForSDPAllocation;

            this.PeerConnection.ondatachannel += (dataChannel) =>
            {
                this.logger.LogDebug("Direct connection established.");

                this.ReceivingDataChannel = dataChannel;

                this.ReceivingDataChannel.onmessage += async (RTCDataChannel dc, DataChannelPayloadProtocols protocol, byte[] data) =>
                {
                    await (this.OnMessageReceived?.Invoke(this, data) ?? Task.CompletedTask);
                };

                this.ReceivingDataChannel.onclose += () =>
                {
                    // TODO: close sending channel?
                };

                this.ReceivingDataChannel.onerror += (error) =>
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

            // TODO: pass init to createDataChannel - maxRetransmits maxPacketLifeTime and ordered should determine the DataChannelType
            // for OWA the datachannel should be reliable
            // is the default datachannel already reliable?

            this.SendingDataChannel = await this.PeerConnection.createDataChannel(label);

            this.SendingDataChannel.onopen += () =>
            {
                //    Log("Data Channel opened.");
            };

            this.SendingDataChannel.onclose += () =>
            {
                // TODO: close receiving channel?
            };

            this.SendingDataChannel.onerror += (error) =>
            {
                // TODO: add event?
            };
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
            this.logger.LogDebug(
                "Starting ICE negotioation."// caller:\"{callerName}\" tag:\"{fromTag}\"; remote:\"{remoteName}\" tag:\"{toTag}\"; callId\"{callId}\"",
                );

            if (this.IsControllingAgent)
            {
                this.SDPDialog = new SDPOfferingClientTransaction(this.SIPConnection, this.PeerConnection, this.loggerFactory);
            }
            else
            {
                this.SDPDialog = new SDPAnsweringClientTransaction(this.SIPConnection, this.PeerConnection, this.loggerFactory);
            }

            this.SDPDialog.StartCSeq = 2; // TODO: Remove hardcode
            await this.SDPDialog.Start();
        }
    }
}
