using SIPSignalingServer.Dialogs;
using WebRTCLibrary.SIP.Models;

namespace SIPSignalingServer.Models
{
    internal class SIPTunnelEndpoint
    {
        public SIPParticipant SourceParticipant { get; private set; }

        public string FromTag { get; private set; }

        public string? RemoteUser { get; private set; }

        ////public SIPRegistration registration { get; private set; }

        public RelayDialog Dialog {  get; set; }

        public bool Confirmed { get; set; }

        // TODO: pass registration?
        public SIPTunnelEndpoint(SIPParticipant sourceParticipant, string fromTag, string? remoteUser, RelayDialog dialog)
        {
            SourceParticipant = sourceParticipant;
            FromTag = fromTag;
            RemoteUser = remoteUser;
            Dialog = dialog;
        }
    }
}
