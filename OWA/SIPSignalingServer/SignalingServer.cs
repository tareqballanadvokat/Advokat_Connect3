using SIPSignalingServer.Transactions;
using System.Net;
using Microsoft.Extensions.Logging;
using WebRTCLibrary.SIP;
using SIPSignalingServer.Interfaces;
using SIPSorcery.SIP;
using WebRTCLibrary.SIP.Interfaces;

namespace SIPSignalingServer
{
    public class SignalingServer
    {
        private readonly ILoggerFactory loggerFactory;

        private readonly ILogger<SignalingServer> logger;

        //private IPEndPoint ServerEndpoint = new IPEndPoint(Dns.GetHostAddresses(Dns.GetHostName()).Last(), 8081);
        private IPEndPoint ServerEndpoint = IPEndPoint.Parse("192.168.1.58:8081");

        private ISIPRegistry registry;

        private SIPSchemesEnum sipScheme = SIPSchemesEnum.sip;

        private ISIPTransport transport;

        private ISIPConnection connection;

        private ISIPConnectionPool connectionPool;

        public SignalingServer(ILoggerFactory loggerFactory)
        {
            this.loggerFactory = loggerFactory;
            this.logger = this.loggerFactory.CreateLogger<SignalingServer>();

            // TODO: Get registry passed
            this.registry = new SIPMemoryRegistry(this.loggerFactory);
            this.transport = this.GetConnection(this.ServerEndpoint);
            Console.WriteLine($"listening on {ServerEndpoint}");

            this.connection = new SIPConnection(this.sipScheme, this.transport, this.loggerFactory, this.IsRegistrationRequest);
            this.connection.SIPRequestReceived += this.RegistraionListener;

            this.connectionPool = new SIPMemoryConnectionPool(this.loggerFactory);
        }

        private bool IsRegistrationRequest(SIPMessageBase message)
        {
            // TODO: check here? - pretty sure yes
            return (message is SIPRequest request
                && request.Method == SIPMethodsEnum.REGISTER
                && request.Header.CSeq == 1);
        }

        private ISIPTransport GetConnection(IPEndPoint sourceEndpoint)
        {
            ISIPTransport transport = new WebRTCLibrary.Utils.SIPTransport();

            // set listening channel
            SIPUDPChannel channel = new SIPUDPChannel(sourceEndpoint);

            // TODO: add more channels for TCP / ws support
            // TODO: add factory for channels
            transport.AddSIPChannel(channel);

            return transport;
        }

        /// <summary>General listener for all requests from clients.</summary>
        /// <version date="20.03.2025" sb="MAC"></version>
        private async Task RegistraionListener(SIPEndPoint localEndPoint, SIPEndPoint remoteEndPoint, SIPRequest sipRequest)
        {
            SIPDialog SIPDialog = new SIPDialog(this.sipScheme, this.transport, sipRequest, localEndPoint, this.registry, this.connectionPool, this.loggerFactory);
            await SIPDialog.Start();
        }
    }
}
