using Microsoft.Extensions.Logging;
using SIPSorcery.SIP;
using System.Net.Sockets;
using WebRTCClient.Models;
using WebRTCClient.Transactions.SIP;
using WebRTCLibrary.Interfaces;
using WebRTCLibrary.SIP;
using WebRTCLibrary.SIP.Models;
using static WebRTCLibrary.Utils.TaskHelpers;

namespace WebRTCClient
{
    // TODO: Do we need this abstraction?

    public class SIPClient : ISIPMessager
    {
        private readonly ILoggerFactory loggerFactory;

        private readonly ILogger<SIPClient> logger;

        public delegate Task MessageReceivedDelegate(SIPClient sender, byte[] data);

        public delegate Task ConnectedDelegate(SIPClient sender);

        public event MessageReceivedDelegate? OnMessageReceived;

        public event ConnectedDelegate? OnConnected;

        public SIPParticipant SourceParticipant { get; private set; }

        public SIPParticipant RemoteParticipant { get; private set; }

        private SIPDialog Dialog { get; set; }

        public bool SignalingServerConnected { get => this.Dialog.Connected; }

        public event ISIPMessager.RequestReceivedDelegate? OnRequestReceived
        {
            add => this.Dialog.OnRequestReceived += value;
            remove => this.Dialog.OnRequestReceived -= value;
        }

        public event ISIPMessager.ResponseReceivedDelegate? OnResponseReceived
        {
            add => this.Dialog.OnResponseReceived += value;
            remove => this.Dialog.OnResponseReceived -= value;
        }
        public SIPClient(SignalingServerParams connectionParams, ILoggerFactory loggerFactory)
            :this(
                 connectionParams.SIPScheme,
                 transport: GetTransport(connectionParams.SourceParticipant, connectionParams.SIPChannels),
                 sourceParticipant: connectionParams.SourceParticipant,
                 remoteParticipant: connectionParams.RemoteParticipant,
                 loggerFactory: loggerFactory)
        {
        }

        public SIPClient(
            SIPSchemesEnum sipScheme,
            ISIPTransport transport,
            SIPParticipant sourceParticipant,
            SIPParticipant remoteParticipant,
            ILoggerFactory loggerFactory)
        {
            this.loggerFactory = loggerFactory;
            this.logger = this.loggerFactory.CreateLogger<SIPClient>();

            this.SourceParticipant = sourceParticipant;
            this.RemoteParticipant = remoteParticipant;

            this.Dialog = new SIPDialog(sipScheme, transport, this.SourceParticipant, this.RemoteParticipant, this.loggerFactory);
        }

        public async Task<SocketError> SendSIPRequest(SIPMethodsEnum method, string message, string contentType, int cSeq)
        {
            return await this.Dialog.SendSIPRequest(method, message, contentType, cSeq);
        }

        public async Task<SocketError> SendSIPResponse(SIPResponseStatusCodesEnum statusCode, string message, string contentType, int cSeq)
        {
            return await this.Dialog.SendSIPResponse(statusCode, message, contentType, cSeq);
        }

        public async Task StartDialog() //List<RTCIceServer> iceServers)
        {
            await this.Dialog.Start();

            await WaitForAsync(
                () => this.Dialog.Connected, // TODO: start listening on MessagingDialog set? Request could be dropped between peer confirmation and start of SPD listener
                timeOut: 5000, // TODO: Get timout for connection
                ct: CancellationToken.None, // TODO: implement cancellation logic
                //successCallback: async () => await this.ConnectWithPeer(iceServers)
                successCallback: async () => await (this.OnConnected?.Invoke(this) ?? Task.CompletedTask)
                // failureCallback: TODO: Timeout behaviour
            );
        }

        public async Task StopDialog()
        {
            await this.Dialog.Stop();
        }

        private static ISIPTransport GetTransport(SIPParticipant caller, HashSet<SIPChannelsEnum> sipChannelEnums)
        {
            ISIPTransport transport = new WebRTCLibrary.Utils.SIPTransport();

            if (sipChannelEnums.Count == 0)
            {
                // TODO: find suitable exception
                throw new Exception("No SIPChannel set. Cannot create SIP connection.");
            }

            // set listening channels
            foreach (SIPChannelsEnum sipChannelEnum in sipChannelEnums)
            {
                transport.AddSIPChannel(sipChannelEnum.GetChannelInstance(caller));
            }

            return transport;
        }
    }
}
