using SIPSorcery.SIP;
using WebRTCClient.Dialogs.ClientDialogs;
using WebRTCLibrary.SIP;
using WebRTCLibrary.SIP.Models;

namespace WebRTCClient
{
    public class SIPClient
    {
        public SIPParticipant SourceParticipant { get; private set; }

        public SIPParticipant RemoteParticipant { get; private set; }

        private ClientDialog Dialog { get; set; } 

        public SIPClient(
            SIPParticipant sourceParticipant,
            SIPParticipant remoteParticipant,
            SIPTransport transport,
            SIPSchemesEnum sipScheme)
        {
            this.SourceParticipant = sourceParticipant;
            this.RemoteParticipant = remoteParticipant;

            this.Dialog = new ClientDialog(this.SourceParticipant, this.RemoteParticipant, transport, sipScheme);            
        }

        public async Task StartDialog()
        {
            await this.Dialog.Start();
        }

        public async Task StopDialog()
        {
            await this.Dialog.Stop();
        }
    }
}
