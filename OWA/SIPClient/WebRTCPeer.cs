using Microsoft.Extensions.Logging;
using SIPSorcery.Net;
using SIPSorcery.SIP;
using System.Collections.ObjectModel;
using System.Diagnostics.CodeAnalysis;
using System.Net;
using WebRTCClient.Models;
using WebRTCLibrary.SIP.Models;
using WebRTCLibrary.SIP.Utils;
using static WebRTCLibrary.Utils.TaskHelpers;

namespace WebRTCClient
{
    /// <summary>Main class representing a WebRTC connection. Functions as client with which to communicate with the peer.</summary>
    /// <version date="22.04.2025" sb="MAC">Created.</version>
    public class WebRTCPeer : IWebRTCPeer
    {
        private readonly ILoggerFactory loggerFactory;

        private readonly ILogger<WebRTCPeer> logger;

        public static readonly SIPSchemesEnum defaultSipScheme = SIPSchemesEnum.sip; // TODO: make SIPS?
        
        public static readonly SIPChannelsEnum defaulSIPChannel = SIPChannelsEnum.WebSocketSSLClient; // TODO: make TLS?

        /// <summary>Event that gets fired when a direct message form the peer is received.</summary>
        public event IWebRTCPeer.MessageReceivedDelegate? OnMessageReceived;

        /// <summary>Event that gets fired when a connection with the peer is achived via STUN or TURN.
        ///          Messages can now be exchanged between the peers.</summary>
        public event IWebRTCPeer.ConnectedDelegate? OnConnected;

        /// <summary>Boolean representing whether this client is connected to the peer or not.
        ///          If this is true messages can be exchanged between the peers.</summary>
        /// <version date="22.04.2025" sb="MAC">Created.</version>
        public bool IsConnected { get => this.p2pConnection?.IsConnected ?? false; }

        private P2PConnection p2pConnection;

        private SIPClient sipClient;

        private readonly SignalingServerParams signalingServerParams;

        private readonly ReadOnlyCollection<RTCIceServer> iceServers;

        /// <summary>Constructor that is using the default connection parameters for the signaling server (sipScheme and sipChannel).</summary>
        /// <param name="sourceUser">SIP display name of the calling participant (From header of SIP package).</param>
        /// <param name="remoteUser">SIP display name of the remote participant (To header of SIP package).</param>
        /// <param name="sourceEndpoint">The IP endpoint of the calling participant.</param>
        /// <param name="signalingServer">The IP endpoint of the signaling server.</param>
        /// <param name="iceServers">A list of STUN/TURN servers that provide ice candidates for the negotiation of the p2p connection between the participants.</param>
        /// <version date="22.04.2025" sb="MAC">Created.</version>
        public WebRTCPeer(
            string sourceUser,
            string remoteUser,
            IPEndPoint sourceEndpoint,
            IPEndPoint signalingServer,
            List<RTCIceServer> iceServers,
            ILoggerFactory loggerFactory)
            : this(
                new SignalingServerParams(
                    sourceParticipant: new SIPParticipant(sourceUser, new SIPEndPoint(defaulSIPChannel.Protocol, sourceEndpoint)),
                    remoteParticipant: new SIPParticipant(remoteUser, new SIPEndPoint(defaulSIPChannel.Protocol, signalingServer)),
                    sipScheme: defaultSipScheme,
                    sipChannels: [defaulSIPChannel]),
                iceServers: iceServers,
                loggerFactory
                )
        {
        }

        /// <summary>Constructor using the provided signalingServerParams for the connection with the signaling server.</summary>
        /// <param name="signalingServerParams">Parameters for the connection with the signaling server.</param>
        /// <param name="iceServers">A list of STUN/TURN servers that provide ice candidates for the negotiation of the p2p connection between the participants.</param>
        /// <version date="22.04.2025" sb="MAC">Created.</version>
        public WebRTCPeer(SignalingServerParams signalingServerParams, List<RTCIceServer> iceServers, ILoggerFactory loggerFactory)
        {
            this.signalingServerParams = signalingServerParams;
            this.iceServers = iceServers.AsReadOnly();
            
            this.loggerFactory = loggerFactory;
            this.logger = this.loggerFactory.CreateLogger<WebRTCPeer>();

            this.sipClient = new SIPClient(this.signalingServerParams, this.loggerFactory);
            this.p2pConnection = new P2PConnection(this.sipClient, this.iceServers, this.loggerFactory);
        }

        /// <summary>Starts the connection process with the signaling server and subsequently with the peer through the signaling server.
        ///          The process is finished successfully when the <see cref="OnConnected"/> event fires.</summary>
        /// <version date="22.04.2025" sb="MAC">Created.</version>
        public async Task Connect()
        {
            // TODO: maybe expose the SIPClient. Add check if SIPClient is connected in that case

            this.p2pConnection.OnMessageReceived += this.DirectMessageReceived;
            this.sipClient.OnConnected += this.WaitForDirectConnection;

            // direct connection has to start first. To set the eventlisteners before the first events.
            await this.p2pConnection.Start();
            await this.sipClient.StartDialog();
        }

        public async Task Disconnect()
        {
            await this.sipClient.StopDialog();
        }

        private async Task WaitForDirectConnection(SIPClient sender)
        {
            await WaitForAsync(
                () => this.p2pConnection.IsConnected,
                timeOut: 5000, // TODO: find suitable timout for p2p connection
                               //       This is the reason why the waiting peer does not fire the OnConnected event when we wait a bit
                ct: CancellationToken.None, // TODO: implement cancellation logic
                successCallback: this.DirectConnectionOpen
                // TODO: Timeout
                );
        }

        private async Task DirectConnectionOpen()
        {
            this.logger.LogInformation(
                "Direct connection open. \"{callerName}\" - \"{remoteName}\"",
                this.sipClient?.SourceParticipant.Name,
                this.sipClient?.RemoteParticipant.Name);

            await (this.OnConnected?.Invoke(this) ?? Task.CompletedTask);

            //  TODO: Close sip connection?
        }

        /// <summary>This method sends the given string as a direct message to the peer.
        ///          A peer must be connected by calling the <see cref="Connect"/> method and waiting for the <see cref="OnConnected"/> event.
        ///          If <see cref="IsConnected"/> is false no message will be sent.</summary>
        /// <param name="message">The message to send.</param>
        /// <version date="22.04.2025" sb="MAC">Created.</version>
        public async Task SendMessageToPeer(string message)
        {
            if (!this.IsConnected)
            {
                return;
            }

            await this.p2pConnection.SendMessage(message);
        }

        /// <summary>This method sends the given bytes as a direct message to the peer.
        ///          A peer must be connected by calling the <see cref="Connect"/> method and waiting for the <see cref="OnConnected"/> event.
        ///          If <see cref="IsConnected"/> is false no message will be sent.</summary>
        /// <param name="message">The message to send</param>
        /// <version date="22.04.2025" sb="MAC">Created. Not implemented.</version>
        public async Task SendMessageToPeer(byte[] message)
        {
            throw new NotImplementedException();

            //if (!this.IsConnected)
            //{
            //    return;
            //}

            //await this.P2PConnection.SendMessage(message);
        }

        private async Task DirectMessageReceived(P2PConnection connection, byte[] data)
        {
            await (this.OnMessageReceived?.Invoke(this, data) ?? Task.CompletedTask);
        }
    }
}
