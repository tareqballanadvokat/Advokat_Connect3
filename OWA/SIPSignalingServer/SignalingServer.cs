using SIPSignalingServer.Transactions;
using SIPSignalingServer.Models;
using SIPSorcery.SIP;
using System.Net;
using WebRTCLibrary.SIP.Models;
using Microsoft.Extensions.Logging;

namespace SIPSignalingServer
{
    public class SignalingServer
    {
        private readonly ILoggerFactory loggerFactory;

        private readonly ILogger<SignalingServer> logger;

        //private IPEndPoint ServerEndpoint = new IPEndPoint(Dns.GetHostAddresses(Dns.GetHostName()).Last(), 8081);
        private IPEndPoint ServerEndpoint = IPEndPoint.Parse("192.168.1.58:8081");

        private SIPRegistry Registry = new SIPRegistry();

        private SIPSchemesEnum SIPScheme = SIPSchemesEnum.sip;

        private SIPTransport Transport;

        private SIPConnectionPool ConnectionPool;

        public SignalingServer(ILoggerFactory loggerFactory)
        {
            this.loggerFactory = loggerFactory;
            this.logger = this.loggerFactory.CreateLogger<SignalingServer>();

            this.Transport = this.GetConnection(this.ServerEndpoint);
            Console.WriteLine($"listening on {ServerEndpoint}");
            this.Transport.SIPTransportRequestReceived += this.RegistraionListener;

            this.ConnectionPool = new SIPConnectionPool(this.loggerFactory);
        }

        private SIPTransport GetConnection(IPEndPoint sourceEndpoint)
        {
            SIPTransport transport = new SIPTransport();

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
            if (sipRequest.Method != SIPMethodsEnum.REGISTER) // TODO: check here?
            {
                // not a registration request
                return;
            }

            SIPDialog SIPDialog = new SIPDialog(SIPScheme, this.Transport, sipRequest, localEndPoint, this.Registry, this.ConnectionPool, this.loggerFactory);
            await SIPDialog.Start();
        }
    }
}
