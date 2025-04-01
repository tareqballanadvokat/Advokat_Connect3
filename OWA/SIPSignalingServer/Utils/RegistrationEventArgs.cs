using SIPSignalingServer.Models;
using WebRTCLibrary.Utils;

namespace SIPSignalingServer.Utils
{
    internal class RegistrationEventArgs : EventArgs
    {
        public SIPRegistration Registration { get; set; }

        public RegistrationEventArgs(SIPRegistration registration)
        {
            this.Registration = registration;
        }
    }
}
