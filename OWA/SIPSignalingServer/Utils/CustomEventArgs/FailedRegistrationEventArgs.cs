using SIPSignalingServer.Models;

namespace SIPSignalingServer.Utils.CustomEventArgs
{
    public class FailedRegistrationEventArgs : FailureEventArgs
    {
        public SIPRegistration? Registration { get; set; }
    }
}
