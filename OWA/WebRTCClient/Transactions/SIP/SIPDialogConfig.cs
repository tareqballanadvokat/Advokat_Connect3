using WebRTCLibrary.SIP;

namespace WebRTCClient.Transactions.SIP
{
    public class SIPDialogConfig : SIPConfig
    {
        public static readonly int defaultRegistrationTimeout = 1000; // TODO: Find suitable default registration timeout

        public static readonly int defaultConnectionTimeout = 3000;

        public static readonly int defaultPeerRegistrationTimeout = 3000; // TODO: Find suitable default timeout

        public int RegistrationTimeout { get; set; } = defaultRegistrationTimeout;

        /// <summary>Time to wait after own registration for the peer to register before the connection attempt is closed.
        ///          Set null to wait indefinetly.</summary>

        /// <version date="15.07.2025" sb="MAC">Created.</version>
        public int? PeerRegistrationTimeout { get; set; } = defaultPeerRegistrationTimeout;

        public int ConnectionTimeout { get; set; } = defaultConnectionTimeout;
    }
}
