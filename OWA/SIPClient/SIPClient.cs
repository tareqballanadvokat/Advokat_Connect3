using SIPSorcery.SIP;
using WebRTCClient.Dialogs.ClientDialogs;
using WebRTCLibrary.SIP;
using WebRTCLibrary.SIP.Models;

namespace WebRTCClient
{
    public class SIPClient
    {
        public SIPParticipant SourceParticipant { get; private set; }

        public SIPEndPoint SignalingServer { get; private set; }

        public string RemoteUser { get; private set; }

        private ClientDialog Dialog { get; set; } 

        public SIPClient(
            SIPParticipant sourceParticipant,
            SIPEndPoint SignalingServer,
            string RemoteUser,
            SIPSchemesEnum sipScheme)
        {
            this.SourceParticipant = sourceParticipant;
            this.SignalingServer = SignalingServer;
            this.RemoteUser = RemoteUser;

            SIPConnection connection = this.GetConnection(sipScheme);
            this.Dialog = new ClientDialog(this.SourceParticipant, RemoteUser, this.SignalingServer, connection);            
        }

        public async Task StartDialog()
        {
            await this.Dialog.Start();
        }

        public async Task StopDialog()
        {
            await this.Dialog.Stop();
        }


        private SIPConnection GetConnection(SIPSchemesEnum sipScheme)
        {
            SIPTransport transport = new SIPTransport();

            // set listening channel
            SIPUDPChannel channel = new SIPUDPChannel(this.SourceParticipant.Endpoint.GetIPEndPoint());
            //SIPUDPChannel channel = new SIPUDPChannel(sourceEndpoint);

            transport.AddSIPChannel(channel);

            return new SIPConnection(sipScheme, transport);
        }
    }
}
