using SIPSorcery.Net;
using SIPSorcery.SIP;
using SIPSorcery.Sys;
using System.Net.Sockets;
using WebRTCClient.Transactions;
using WebRTCClient.Transactions.SIP;
using WebRTCLibrary.SIP;
using WebRTCLibrary.SIP.Models;

using static WebRTCLibrary.Utils.TaskHelpers;

namespace WebRTCClient
{
    public class SIPClient : ISIPMessager
    {
        public delegate Task MessageReceivedDelegate(SIPClient sender, byte[] data);

        public event MessageReceivedDelegate? OnMessageReceived;

        public SIPParticipant SourceParticipant { get; private set; }

        public SIPParticipant RemoteParticipant { get; private set; }

        private SIPDialog Dialog { get; set; }

        private P2PConnection? P2PConnection { get; set; }

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

        public SIPClient(
            SIPParticipant sourceParticipant,
            SIPParticipant remoteParticipant,
            SIPTransport transport,
            SIPSchemesEnum sipScheme)
        {
            this.SourceParticipant = sourceParticipant;
            this.RemoteParticipant = remoteParticipant;

            this.Dialog = new SIPDialog(sipScheme, transport, this.SourceParticipant, this.RemoteParticipant);
        }

        public async Task<SocketError> SendSIPRequest(SIPMethodsEnum method, string message, string contentType, int cSeq)
        {
            return await this.Dialog.SendSIPRequest(method, message, contentType, cSeq);
        }

        public async Task<SocketError> SendSIPResponse(SIPResponseStatusCodesEnum statusCode, string message, string contentType, int cSeq)
        {
            return await this.Dialog.SendSIPResponse(statusCode, message, contentType, cSeq);
        }

        public async Task SendMessageToPeer(string message)
        {
            if(this.P2PConnection == null)
            {
                // connection not set
                return;
            }

            await this.P2PConnection.SendMessage(message);
        }

        public async Task StartDialog(List<RTCIceServer> iceServers)
        {
            await this.Dialog.Start();

            await WaitForAsync(
                () => this.Dialog.Connected, // TODO: start listening on MessagingDialog set? Request could be dropped between peer confirmation and start of SPD listener
                timeOut: 5000, // TODO: Get timout for connection
                successCallback: async () => await this.ConnectWithPeer(iceServers)
            );
        }

        private async Task ConnectWithPeer(List<RTCIceServer> iceServers)
        {
            this.P2PConnection = new P2PConnection(this.Dialog, iceServers);
            this.P2PConnection.OnMessageReceived += async (P2PConnection connection, byte[] data) =>
            {
                await (this.OnMessageReceived?.Invoke(this, data) ?? Task.CompletedTask);
            };

            await this.P2PConnection.Start();

            // TODO: Wait for connection?
        }

        public async Task StopDialog()
        {
            await this.Dialog.Stop();
        }
    }
}
