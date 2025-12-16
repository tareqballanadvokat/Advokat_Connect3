using SIPSignalingServer.Models;

namespace SIPSignalingServer.Utils.CustomEventArgs
{
    public class RegistrationEventArgs : EventArgs
    {
        public SIPRegistration Registration { get; set; }

        public RegistrationEventArgs(SIPRegistration registration)
        {
            Registration = registration;
        }
    }
}
