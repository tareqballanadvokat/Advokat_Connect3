using SIPSorcery.SIP;
using WebRTCLibrary.SIP.Models;

namespace SIPSignalingServer.Models
{
    internal class SIPRegistration
    {
        public SIPParticipant SourceParticipant { get; private set; }

        public string RemoteUser { get; private set; }

        public bool Confirmed { get; set; }

        public SIPRegistration(SIPParticipant sourceParticipant, string remoteUser)
        {
            this.SourceParticipant = sourceParticipant;
            this.RemoteUser = remoteUser;
        }

        public override bool Equals(object? obj)
        {
            var other = obj as SIPRegistration;

            if (other == null) return false;

            return this.RemoteUser == other.RemoteUser
                && this.SourceParticipant.Name == other.SourceParticipant.Name
                && this.SourceParticipant.Endpoint == other.SourceParticipant.Endpoint;
        }

        public static bool operator ==(SIPRegistration? left, SIPRegistration? right)
        {
            return (left is null && right is null) // TODO: both null, are equal?
                || (left is not null && left.Equals(right));
                
        }
        public static bool operator !=(SIPRegistration? left, SIPRegistration? right)
        {
            return !(left == right);
        }
    }
}
