using SIPSignalingServer.Dialogs;
using SIPSorcery.SIP;
using System.Net;
using WebRTCLibrary.SIP;

namespace SIPSignalingServer
{
    public class SignalingServer
    {
        //private IPEndPoint ServerEndpoint = new IPEndPoint(Dns.GetHostAddresses(Dns.GetHostName()).Last(), 8081);
        private IPEndPoint ServerEndpoint = IPEndPoint.Parse("192.168.1.58:8081");


        private SIPRegisty Registry = new SIPRegisty();

        private SIPSchemesEnum SIPScheme = SIPSchemesEnum.sip;

        private SIPConnection Connection;

        public SignalingServer()
        {
            this.Connection = this.GetConnection(this.ServerEndpoint);
            Console.WriteLine($"listening on {ServerEndpoint}");
            this.Connection.SIPRequestReceived += this.RegistraionRequestListener;
            //this.Connection.SIPResponseReceived += this.RequestListener;

        }

        private SIPConnection GetConnection(IPEndPoint sourceEndpoint)
        {
            SIPTransport transport = new SIPTransport();

            // set listening channel
            //SIPUDPChannel channel = new SIPUDPChannel(this.SourceParticipant.Endpoint.GetIPEndPoint());
            SIPUDPChannel channel = new SIPUDPChannel(sourceEndpoint);

            // TODO: add more channels for TCP / ws support
            // TODO: add factory for channels
            transport.AddSIPChannel(channel);

            return new SIPConnection(SIPScheme, transport);
        }

        /// <summary>General listener for all requests from clients.</summary>
        /// <version date="20.03.2025" sb="MAC"></version>
        private async Task RegistraionRequestListener(SIPEndPoint localEndPoint, SIPEndPoint remoteEndPoint, SIPRequest sipRequest)
        {
            GeneralDialog generalDialog = new GeneralDialog(sipRequest, localEndPoint, this.Connection, this.Registry);
            await generalDialog.Start();
        }
    }
}
