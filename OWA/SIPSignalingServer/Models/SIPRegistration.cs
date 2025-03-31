using SIPSorcery.SIP;
using WebRTCLibrary.SIP.Models;

namespace SIPSignalingServer.Models
{
    internal class SIPRegistration
    {
        public SIPParticipant SourceParticipant { get; private set; }

        public string RemoteUser { get; private set; }

        public SIPRegistration(SIPParticipant sourceParticipant, string remoteUser)
        {
            this.SourceParticipant = sourceParticipant;
            this.RemoteUser = remoteUser;
        }


        public static bool operator ==(SIPRegistration left, SIPRegistration right)
        {
            return left.RemoteUser == right.RemoteUser
                && left.SourceParticipant.Name == right.SourceParticipant.Name
                && left.SourceParticipant.Endpoint == right.SourceParticipant.Endpoint;
        }
        public static bool operator !=(SIPRegistration left, SIPRegistration right)
        {
            return !(left == right);
        }
    }
}
