using SIPSorcery.SIP;

namespace SIPSignalingServer.Utils.CustomEventArgs
{
    internal class FailureEventArgs : EventArgs
    {
        public string? Message { get; set; }

        public SIPResponseStatusCodesEnum StatusCode { get; set; }
    }
}
