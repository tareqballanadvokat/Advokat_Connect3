using Advokat.WebRTC.Library.SIP.Models;

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

        public bool IsPeer(ServerSideTransactionParams peerParams)
        {
            string peerClientTag = peerParams.RemoteTag; // TODO: could not be set
            string peerRemoteTag = peerParams.ClientTag;

            string peerUsername = peerParams.RemoteParticipant.Name;
            string peerRemoteUser = peerParams.ClientParticipant.Name;

            return
                //r.Params.CallId == callId
                //&& 
                this.ClientTag == peerClientTag
                && this.RemoteTag == peerRemoteTag // could not be set?

                // TODO: names could be null?
                && this.ClientParticipant.Name == peerUsername
                && this.RemoteParticipant.Name == peerRemoteUser;
        }

        public static ServerSideTransactionParams Empty()
        {
            // very experimental
            return new ServerSideTransactionParams(null, null);
        }
    }
}
