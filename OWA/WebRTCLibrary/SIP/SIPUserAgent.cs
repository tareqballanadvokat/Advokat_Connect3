using SIPSorcery.SIP;
using System.Net;
using WebRTCLibrary.SIP.Models;

namespace WebRTCLibrary.SIP
{
    public class SIPUserAgent : AbstractSIPMessager, IDisposable
    {
        public static readonly SIPSchemesEnum SIPScheme = SIPSchemesEnum.sip; // TODO: should probably be changed to SIPS later on
                                                                              // TODO: should be passed in constructor

        private string CallID { get; set; } = CallProperties.CreateNewCallId(); // TODO: Add ip?

        public int MessageTimeout = 2000;

        public bool Registered { get => registrationManager.Registered; }

        public bool Connected { get => false; } // SIPTunnel.Connected

        public bool ConnectionPending { get => this.Registered && !this.Connected; }


        private RegistrationManager registrationManager { get; set; }

        private SIPConnection Connection { get; set; }


        public SIPUserAgent(IPEndPoint sourceEndpoint)
        {
            // TODO: Should this connection also be injected?
            this.Connection = this.GetConnection(sourceEndpoint);
            this.registrationManager = new RegistrationManager(this.Connection, CallID);
            this.registrationManager.OnRegistered += this.OnRegistered;
            this.registrationManager.OnUnRegistered += this.OnUnRegistered;

        }

        public async Task Connect(SIPParticipant sourceParticipant, SIPParticipant remoteParticipant)
        {
            await this.registrationManager.Register(sourceParticipant, remoteParticipant);
            // listen for connection
        }

        public async Task Disconnect()
        {
            await this.registrationManager.Unregister();
        }

        private void OnRegistered(RegistrationManager sender)
        {
            // add SIPTunnel + listener
        }

        private void OnUnRegistered(RegistrationManager sender)
        {
            // close SIPTunnel 
        }

        private SIPConnection GetConnection(IPEndPoint sourceEndpoint)
        {
            SIPTransport transport = new SIPTransport();

            // set listening channel
            //SIPUDPChannel channel = new SIPUDPChannel(this.SourceParticipant.Endpoint.GetIPEndPoint());
            SIPUDPChannel channel = new SIPUDPChannel(sourceEndpoint);

            transport.AddSIPChannel(channel);

            return new SIPConnection(SIPScheme, transport);
        }

        // listening for first notify
        private void ConnectionAvailableListener()
        {

        }

        // listening for second notify
        private void ConnectionEstablishedListener()
        {

        }


        private void KeepAlive()
        {

        }

        public async void Dispose()
        {
            //await this.registrationManager.Unregister(); // ??
            this.Connection.Dispose();
        }
    }
}
