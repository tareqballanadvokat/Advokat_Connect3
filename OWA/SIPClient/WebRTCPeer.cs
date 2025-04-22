using SIPSorcery.Net;
using SIPSorcery.SIP;
using System.Collections.ObjectModel;
using System.Diagnostics.CodeAnalysis;
using System.Net;
using WebRTCClient.Models;
using WebRTCLibrary.SIP.Models;

using static WebRTCLibrary.Utils.TaskHelpers;

namespace WebRTCClient
{
    public class WebRTCPeer : IWebRTCPeer
    {
        public static readonly SIPSchemesEnum defaultSipScheme = SIPSchemesEnum.sip; // TODO: make SIPS?
        
        public static readonly SIPChannelsEnum defaulSIPChannel = SIPChannelsEnum.UDP; // TODO: make TLS?

        public event IWebRTCPeer.MessageReceivedDelegate? OnMessageReceived;

        public event IWebRTCPeer.ConnectedDelegate? OnConnected;

        [MemberNotNullWhen(true, nameof(this.P2PConnection))]
        public bool IsConnected { get => this.P2PConnection?.IsConnected ?? false; }

        private P2PConnection? P2PConnection { get; set; }

        private SIPClient? SIPClient { get; set; }

        private SignalingServerParams SignalingServerParams { get; set; }

        private ReadOnlyCollection<RTCIceServer> IceServers { get; set; }

        public WebRTCPeer(
            string sourceUser,
            string remoteUser,
            IPEndPoint sourceEndpoint,
            IPEndPoint signalingServer,
            List<RTCIceServer> iceServers)
            : this(
                new SignalingServerParams(
                    sourceParticipant: new SIPParticipant(sourceUser, new SIPEndPoint(sourceEndpoint)),
                    remoteParticipant: new SIPParticipant(remoteUser, new SIPEndPoint(signalingServer)),
                    sipScheme: defaultSipScheme,
                    sipChannels: [defaulSIPChannel]),
                iceServers: iceServers
                )
        {
        }

        public WebRTCPeer(SignalingServerParams signalingServerParams, List<RTCIceServer> iceServers)
        {
            this.SignalingServerParams = signalingServerParams;
            this.IceServers = iceServers.AsReadOnly();
        }

        public async Task Connect()
        {
            this.SIPClient = new SIPClient(this.SignalingServerParams);
            this.SIPClient.OnConnected += this.OnSIPConnection;

            await this.SIPClient.StartDialog();
        }

        private async Task OnSIPConnection(SIPClient sender)
        {
            this.P2PConnection = new P2PConnection(sender, this.IceServers);
            this.P2PConnection.OnMessageReceived += async (P2PConnection connection, byte[] data) =>
            {
                await (this.OnMessageReceived?.Invoke(this, data) ?? Task.CompletedTask);
            };

            await this.P2PConnection.Start();

            await WaitFor(
                () => this.P2PConnection.IsConnected,
                timeOut: 5000, // TODO: find suitable timout for p2p connection
                successCallback: async () => { await (this.OnConnected?.Invoke(this) ?? Task.CompletedTask); }
                // TODO: Timeout
                );

            // TODO: Wait for connection?
        }

        public async Task SendMessageToPeer(string message)
        {
            if (!this.IsConnected)
            {
                return;
            }

            await this.P2PConnection.SendMessage(message);
        }

        public async Task SendMessageToPeer(byte[] message)
        {
            throw new NotImplementedException();

            //if (!this.IsConnected)
            //{
            //    return;
            //}

            //await this.P2PConnection.SendMessage(message);
        }
    }
}
