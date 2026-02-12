using Advokat.WebRTC.Library.SIP.Models;

namespace SIPSignalingServer.Models
{
    public class SIPRegistration
    {
        public SIPParticipant SourceParticipant { get; private set; }

        public string FromTag { get; private set; }

        // we need this to address this client later?
        public string ToTag { get; set; }

        public string CallID { get; private set; }

        // null means connect with anyone that wants / knows this participants name
        public string? RemoteUser { get; private set; }

        public bool Confirmed { get; set; }

        public SIPRegistration(ServerSideTransactionParams transactionParams)
        {
            this.SourceParticipant = transactionParams.ClientParticipant;
            this.RemoteUser = transactionParams.RemoteParticipant.Name; // TODO: make nullable in TransactionParams

            // TODO: might be the other way around
            this.ToTag = transactionParams.RemoteTag;
            this.FromTag = transactionParams.ClientTag;

            this.CallID = transactionParams.CallId;
        }

        public bool IsPeer(ServerSideTransactionParams other)
        {
            return this.IsPeer(new SIPRegistration(other));
        }

        public bool IsPeer(SIPRegistration other)
        {
            if (this.RemoteUser == null && other.RemoteUser == null)
            {
                // Both registrations allow for multiple connections - we do not allow m2m connecition
                // Without this check anybody could connect to all remotes by omitting the remote name
                return false;
            }

            return (other.RemoteUser == null || this.SourceParticipant.Name == other.RemoteUser)
                && (this.RemoteUser == null || this.RemoteUser == other.SourceParticipant.Name);
        }

        public override bool Equals(object? obj)
        {
            if (base.Equals(obj))
            {
                return true;
            }

            var other = obj as SIPRegistration;

            if (other == null) return false;

            // TODO: include tags and CallID?
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
