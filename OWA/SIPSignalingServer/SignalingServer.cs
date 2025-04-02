using SIPSignalingServer.Dialogs;
using SIPSignalingServer.Models;
using SIPSorcery.SIP;
using System.Net;
using WebRTCLibrary.SIP;
using WebRTCLibrary.SIP.Models;

namespace SIPSignalingServer
{
    public class SignalingServer
    {
        //private IPEndPoint ServerEndpoint = new IPEndPoint(Dns.GetHostAddresses(Dns.GetHostName()).Last(), 8081);
        private IPEndPoint ServerEndpoint = IPEndPoint.Parse("192.168.1.58:8081");


        private SIPRegistry Registry = new SIPRegistry();

        //private SIPSchemesEnum SIPScheme = SIPSchemesEnum.sip;

        private SIPTransport Transport;

        public SignalingServer()
        {
            // DEBUG - remote already registered
            this.Registry.Register(new SIPRegistration(new SIPParticipant("macs", new SIPEndPoint(new IPEndPoint(IPAddress.Parse("192.168.1.58"), 8091))), "macc"));

            this.Transport = this.GetConnection(this.ServerEndpoint);
            Console.WriteLine($"listening on {ServerEndpoint}");
            this.Transport.SIPTransportRequestReceived += this.RegistraionRequestListener;
            //this.Connection.SIPResponseReceived += this.RequestListener;

        }

        private SIPTransport GetConnection(IPEndPoint sourceEndpoint)
        {
            SIPTransport transport = new SIPTransport();

            // set listening channel
            //SIPUDPChannel channel = new SIPUDPChannel(this.SourceParticipant.Endpoint.GetIPEndPoint());
            SIPUDPChannel channel = new SIPUDPChannel(sourceEndpoint);

            // TODO: add more channels for TCP / ws support
            // TODO: add factory for channels
            transport.AddSIPChannel(channel);

            return transport;
        }

        /// <summary>General listener for all requests from clients.</summary>
        /// <version date="20.03.2025" sb="MAC"></version>
        private async Task RegistraionRequestListener(SIPEndPoint localEndPoint, SIPEndPoint remoteEndPoint, SIPRequest sipRequest)
        {
            //if (sipRequest.Method == SIPMethodsEnum.REGISTER) // TODO: check here?
            //{
                GeneralDialog generalDialog = new GeneralDialog(sipRequest, localEndPoint, this.Transport, this.Registry);
                await generalDialog.Start();
            //}
        }
    }
}
