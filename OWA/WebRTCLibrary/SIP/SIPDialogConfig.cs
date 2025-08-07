using WebRTCLibrary.SIP.Interfaces;

namespace WebRTCLibrary.SIP
{
    public class SIPDialogConfig : SIPConfig, ISIPDialogConfig
    {
        public readonly static int defaultRegistrationTimeout = 3000;

        /// <summary>Timeout for the client to finish the registration process. Must be set before starting.</summary>
        /// <value>Defualt value specified in the <see cref="defaultRegistrationTimeout"/> field.</value>
        /// <version date="25.04.2025" sb="MAC">Created.</version>
        public int RegistrationTimeout { get; set; } = defaultRegistrationTimeout; // TODO: add flag if it already started - prevent setting then.

        public readonly static int defaultConnectionTimeout = 3000;

        /// <summary>Timeout for the connection process after both peers successfully registered.
        ///          Specify how long the connection process should take before it is cancelled.
        ///          Must be set before starting.
        ///          
        ///          This could be adjusted in the future and sent by the client in the registration.</summary>
        /// <version date="25.04.2025" sb="MAC">Created.</version>
        public int ConnectionTimeout { get; set; } = defaultConnectionTimeout; // TODO: add flag if it already started - prevent setting then.


        public readonly static int defaultPeerRegistrationTimeout = 3000;

        /// <summary>Timeout for the peer to register.
        ///          How long to wait after client registration was successful for the peer to connect.
        ///          If set to null the connection will wait indeffinetly.
        ///          Must be set before starting.
        ///
        ///          This could be adjusted in the future and sent by the client in the registration.</summary>
        /// <version date="04.06.2025" sb="MAC">Created.</version>
        public int? PeerRegistrationTimeout { get; set; } = defaultPeerRegistrationTimeout; // TODO: add flag if it already started - prevent setting then.
                                                                                            // TODO: Should we remove the timeout completely? let the client determine it's own timeout and stop responding after that.
                                                                                            //       If the keep alive dialog is held we keep wait for the peer indefinetly
    }
}
