using Advokat.WebRTC.Library.SIP;
using Advokat.WebRTC.Library.SIP.Interfaces;
using SIPSignalingServer.Utils;
using SIPSorcery.SIP;
using System.Security.Cryptography.X509Certificates;

namespace SIPSignalingServer
{
    // TODO: prevent changing when server is running
    public class SignalingServerOptions
    {
        public SIPSchemesEnum SIPScheme { get; set; } = SIPSchemesEnum.sip;

        public static readonly SIPServerChannelsEnum defaultSIPChannel = SIPServerChannelsEnum.WebSocketSSL;

        private X509Certificate2? sslCertificate = null;

        public X509Certificate2? SSLCertificate
        {
            get => this.sslCertificate;
            set
            {
                //if (this.Running)
                //{
                //    throw new InvalidOperationException("Certificate cannot be changed while the server is running.");
                //}

                this.sslCertificate = value;
            }
        }

        public HashSet<SIPServerChannelsEnum> SIPChannels { get; set; } = [defaultSIPChannel];

        public bool AllowClientConfigs { get; set; } = true;

        public ISIPDialogConfig SIPConfig { get; set; } = new SIPDialogConfig();
    }
}
