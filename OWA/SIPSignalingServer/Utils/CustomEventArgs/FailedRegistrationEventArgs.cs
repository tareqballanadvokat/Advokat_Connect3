using SIPSignalingServer.Models;

namespace SIPSignalingServer.Utils.CustomEventArgs
{
    internal class FailedRegistrationEventArgs : FailureEventArgs
    {
        public SIPRegistration? Registration { get; set; }
    }
}
