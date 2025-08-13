using WebRTCLibrary.SIP.Interfaces;

namespace WebRTCLibrary.SIP
{
    public class SIPConfig : ISIPConfig
    {
        //public static readonly int DefaultReceiveTimeout = 2000;
        public static readonly int DefaultReceiveTimeout = 20000; // DEBUG

        //public static SIPSchemesEnum DefaultSIPScheme = SIPSchemesEnum.sip;

        public int ReceiveTimeout { get; set; } = DefaultReceiveTimeout;

        //public SIPSchemesEnum SIPScheme { get; set; } = DefaultSIPScheme;
        
        //public SIPConfig(SIPSchemesEnum sipScheme)
        //{
        //    this.SIPScheme = sipScheme;
        //}
    }
}
