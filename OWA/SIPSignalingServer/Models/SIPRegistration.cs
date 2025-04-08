using WebRTCLibrary.SIP.Models;

namespace SIPSignalingServer.Models
{
    internal class SIPRegistration
    {
        public SIPParticipant SourceParticipant { get; private set; }

        public string FromTag { get; private set; }

        // we need this to address this client later?
        public string ToTag { get; set; }

        public string CallID { get; private set; }

        // null means connect with anyone that wants / knows this participants name
        public string? RemoteUser { get; private set; }

        public bool Confirmed { get; set; }

        public SIPRegistration(ServerSideDialogParams dialogParams)
        {
            this.SourceParticipant = dialogParams.ClientParticipant;
            this.RemoteUser = dialogParams.RemoteParticipant.Name; // TODO: make nullable in DialogParams

            // TODO: might be the other way around
            this.ToTag = dialogParams.RemoteTag;
            this.FromTag = dialogParams.SourceTag;

            this.CallID = dialogParams.CallId;
        }

        public override bool Equals(object? obj)
        {
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
