using SIPSorcery.SIP;

namespace WebRTCLibrary.SIP
{
    public class SIPConfig
    {
        //public static readonly int DefaultTimeOut = 2000;
        public static readonly int DefaultTimeOut = 20000; // DEBUG

        //public static SIPSchemesEnum DefaultSIPScheme = SIPSchemesEnum.sip;

        public int ReceiveTimeout { get; set; } = DefaultTimeOut;

        //public SIPSchemesEnum SIPScheme { get; set; } = DefaultSIPScheme;
        public SIPConfig()
        {
        }  

        //public SIPConfig(SIPSchemesEnum sipScheme)
        //{
        //    this.SIPScheme = sipScheme;
        //}
    }
}
