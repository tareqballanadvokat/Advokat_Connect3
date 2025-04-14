using SIPSorcery.SIP;
using System.Net.Sockets;
using WebRTCClient.Dialogs.ClientDialogs;
using WebRTCLibrary.SIP;
using WebRTCLibrary.SIP.Models;

namespace WebRTCClient
{
    public class SIPClient : ISIPMessager
    {
        public SIPParticipant SourceParticipant { get; private set; }

        public SIPParticipant RemoteParticipant { get; private set; }

        private ClientDialog Dialog { get; set; } 

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

            this.Dialog = new ClientDialog(sipScheme, transport, this.SourceParticipant, this.RemoteParticipant);
        }

        public async Task<SocketError> SendRequest(SIPMethodsEnum method, string? message, int cSeq)
        {
            return await this.Dialog.SendRequest(method, message, cSeq);
        }

        public async Task<SocketError> SendResponse(SIPResponseStatusCodesEnum statusCode, string? message, int cSeq)
        {
            return await this.Dialog.SendResponse(statusCode, message, cSeq);
        }

        public async Task StartDialog()
        {
            await this.Dialog.Start();
        }

        public async Task StopDialog()
        {
            await this.Dialog.Stop();
        }
    }
}
