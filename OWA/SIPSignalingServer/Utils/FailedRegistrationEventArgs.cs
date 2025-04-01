using SIPSignalingServer.Models;
using SIPSorcery.SIP;

namespace SIPSignalingServer.Utils
{
    internal class FailedRegistrationEventArgs : EventArgs
    {
        public SIPRegistration? Registration { get; set; }

        public string? Message { get; set; }

        public SIPResponseStatusCodesEnum StatusCode { get; set; }
    }
}
