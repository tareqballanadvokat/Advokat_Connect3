using WebRTCLibrary.SIP.Models;

namespace SIPSignalingServer.Models
{
    public class ServerSideTransactionParams : TransactionParams
    {
        // Signaling server acts as the remote participant
        public new SIPParticipant RemoteParticipant { get => this.SourceParticipant; }

        public SIPParticipant ClientParticipant { get => base.RemoteParticipant; }

        public string? ClientTag
        { 
            get => base.RemoteTag;
            set => base.RemoteTag = value;
        }

        public new string? RemoteTag
        {
            get => this.SourceTag;
            set => this.SourceTag = value;
        }

        public ServerSideTransactionParams(
            SIPParticipant remoteParticipant,
            SIPParticipant clientParticipant,
            string? callId = null,
            string? remoteTag = null,
            string? clientTag = null) 
            : base(
                  sourceParticipant: remoteParticipant,
                  remoteParticipant: clientParticipant,
                  remoteTag,
                  clientTag,
                  callId)
        {
        }

        public static ServerSideTransactionParams Empty()
        {
            // very experimental
            return new ServerSideTransactionParams(null, null);
        }
    }
}
