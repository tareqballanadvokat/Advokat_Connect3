using Microsoft.Extensions.Logging;
using SIPSignalingServer.Interfaces;
using SIPSignalingServer.Transactions;
using SIPSignalingServer.Utils;
using SIPSorcery.SIP;
using System.Diagnostics.CodeAnalysis;
using System.Net;
using System.Security.Cryptography.X509Certificates;
using WebRTCLibrary.SIP;
using WebRTCLibrary.SIP.Interfaces;

namespace SIPSignalingServer
{
    public class SignalingServer
    {
        private readonly ILoggerFactory loggerFactory;

        private readonly ILogger<SignalingServer> logger;

        public IPEndPoint ServerEndpoint { get; private set; }

        private ISIPRegistry registry;

        private SIPSchemesEnum sipScheme = SIPSchemesEnum.sip;

        public static readonly SIPServerChannelsEnum defaultSIPChannel = SIPServerChannelsEnum.WebSocketSSL;

        private X509Certificate2? sslCertificate = null;

        public X509Certificate2? SSLCertificate
        {
            get => this.sslCertificate;
            set
            {
                if (this.Running)
                {
                    throw new InvalidOperationException("Certificate cannot be changed while the server is running.");
                }

                this.sslCertificate = value;
            }
        }

        public HashSet<SIPServerChannelsEnum> SIPChannels { get; set; } = [defaultSIPChannel];

        //public SIPServerChannelsEnum SIPChannel { get; set; } = defaultSIPChannel;

        private ISIPTransport? Transport { get; set; }

        private ISIPConnection? Connection { get; set; }

        private ISIPConnectionPool connectionPool;

        [MemberNotNullWhen(true, nameof(this.Connection))]
        [MemberNotNullWhen(true, nameof(this.Transport))]
        public bool Running { get; private set; }

        public delegate void ServerEventDelegate(SignalingServer sender);

        public event ServerEventDelegate? ServerStarted;

        public event ServerEventDelegate? ServerStopped;

        public SignalingServer(IPEndPoint serverEndpoint, ILoggerFactory loggerFactory)
        {
            this.ServerEndpoint = serverEndpoint;

            this.loggerFactory = loggerFactory;
            this.logger = this.loggerFactory.CreateLogger<SignalingServer>();

            // TODO: Get registry passed
            this.registry = new SIPMemoryRegistry(this.loggerFactory);
            this.connectionPool = new SIPMemoryConnectionPool(this.loggerFactory);
        }

        public void StartServer()
        {
            if (this.Running)
            {
                // server already running
                return;
            }
            this.Transport = this.GetTransport(this.ServerEndpoint);
            
            this.Connection = new SIPConnection(this.sipScheme, this.Transport, this.loggerFactory, this.IsRegistrationRequest);
            this.Connection.SIPRequestReceived += this.RegistraionListener;
            
            this.Running = true;
            
            this.ServerStarted?.Invoke(this);
            this.logger.LogInformation("Server started. Listening on {endpoint}", this.ServerEndpoint);
        }

        public void StopServer()
        {
            // TODO: close all connections properly. STOP all Dialogs

            if (!this.Running)
            {
                // server not running
                return;
            }
            this.Connection.SIPRequestReceived -= this.RegistraionListener;

            this.Transport = null;

            this.Connection = null;
            this.Running = false;
            this.logger.LogInformation("Server stopped");

        }

        private bool IsRegistrationRequest(SIPMessageBase message)
        {
            // TODO: check here? - pretty sure yes
            return (message is SIPRequest request
                && request.Method == SIPMethodsEnum.REGISTER
                && request.Header.CSeq == 1);
        }

        private ISIPTransport GetTransport(IPEndPoint sourceEndpoint)
        {
            if (this.SIPChannels.Count == 0)
            {
                throw new ArgumentException("No SIPChannel set. Cannot create a SIP connection.");
            }

            return new WebRTCLibrary.SIP.Utils.SIPTransport(sourceEndpoint, this.SIPChannels, this.SSLCertificate);
        }

        /// <summary>General listener for all requests from clients.</summary>
        /// <version date="20.03.2025" sb="MAC"></version>
        private async Task RegistraionListener(SIPEndPoint localEndPoint, SIPEndPoint remoteEndPoint, SIPRequest sipRequest)
        {
            SIPDialog SIPDialog = new SIPDialog(this.sipScheme, this.Transport!, sipRequest, localEndPoint, this.registry, this.connectionPool, this.loggerFactory);
            await SIPDialog.Start();
        }
    }
}
