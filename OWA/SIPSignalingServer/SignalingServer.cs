using SIPSignalingServer.Dialogs;
using SIPSignalingServer.Models;
using SIPSorcery.SIP;
using System.Net;
using WebRTCLibrary.SIP.Models;

namespace SIPSignalingServer
{
    public class SignalingServer
    {
        //private IPEndPoint ServerEndpoint = new IPEndPoint(Dns.GetHostAddresses(Dns.GetHostName()).Last(), 8081);
        private IPEndPoint ServerEndpoint = IPEndPoint.Parse("192.168.1.58:8081");

        private SIPRegistry Registry = new SIPRegistry();

        private SIPSchemesEnum SIPScheme = SIPSchemesEnum.sip;

        private SIPTransport Transport;

        private ConnectionPool ConnectionPool;

        public SignalingServer()
        {
            // DEBUG - remote already registered
            //ServerSideDialogParams dialogParams = new(
            //    remoteParticipant: new SIPParticipant("macc", new SIPEndPoint(new IPEndPoint(IPAddress.Parse("192.168.1.58"), 8081))),
            //    clientParticipant: new SIPParticipant("macs", new SIPEndPoint(new IPEndPoint(IPAddress.Parse("192.168.1.58"), 8091))),
            //    callId: "5678",
            //    remoteTag: "4",
            //    clientTag: "3"
            //    );

            //SIPRegistration registration = new SIPRegistration(dialogParams);

            //this.Registry.Register(registration);
            //this.Registry.Confirm(registration);

            // DEBUG - END

            this.Transport = this.GetConnection(this.ServerEndpoint);
            Console.WriteLine($"listening on {ServerEndpoint}");
            this.Transport.SIPTransportRequestReceived += this.RegistraionListener;

            this.ConnectionPool = new ConnectionPool();
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

            GeneralDialog generalDialog = new GeneralDialog(SIPScheme, this.Transport, sipRequest, localEndPoint, this.Registry, this.ConnectionPool);
            await generalDialog.Start();
        }
    }
}
