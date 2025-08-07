namespace WebRTCLibrary.SIP.Interfaces
{
    public interface ISIPDialogConfig : ISIPConfig
    {
        public int RegistrationTimeout { get; set; }

        public int ConnectionTimeout { get; set; }

        public int? PeerRegistrationTimeout { get; set; }
    }
}
