using Org.BouncyCastle.Crypto.Tls;
using SIPSignalingServer.Dialogs;
using SIPSignalingServer.Models;
using SIPSorcery.SIP;
using WebRTCLibrary.SIP;
using static WebRTCLibrary.Utils.TaskHelpers;


namespace SIPSignalingServer
{
    internal class ConversationPool
    {
        private List<GeneralDialog> allDialogs = new List<GeneralDialog>();

        private List<(DialogRelay left, DialogRelay right)> connectedDialogs = new List<(DialogRelay left, DialogRelay right)>();

        //private SIPConnection Connection { get; set; }

        private SIPTransport Transport { get; set; }

        public ConversationPool(SIPTransport transport)
        {
            this.Transport = transport;
        }

        public async Task AddNewDialog(GeneralDialog generalDialog)
        {
            this.allDialogs.Add(generalDialog);
            
            if (generalDialog.Connected)
            {
                this.Connect(generalDialog);
                // find connection in all dialogs
            }
            else
            {
                // TODO: save token - to cancel wait when dialog gets stopped / fails
                CancellationTokenSource cts = new CancellationTokenSource();
                CancellationToken ct = cts.Token;

                // TODO: This should be an event?
                Task.Run(() => WaitFor(
                    () => generalDialog.Connected,
                    ct,
                    successCallback: () => this.Connect(generalDialog)
                    ));
                    // TODO: failure -> remove dialog from dialogpool
            }
        }

        private void Connect(GeneralDialog generalDialog)
        {
            GeneralDialog peerDialog = this.FindConnection(generalDialog);

            // TODO: Find out which is caller and which is remote - could be done in ACK of Notify

            // TODO: manage Tags
            //ServerSideDialogParams remoteParams = new ServerSideDialogParams();
            //ServerSideDialogParams callerParams = new ServerSideDialogParams();

            // TODO: pass Transport or create connection
            // TODO: 
            WebRTCLibrary.SIP.SIPConnection remoteConnection = new WebRTCLibrary.SIP.SIPConnection(SIPSchemesEnum.sip, this.Transport); // TODO: Add predicate here?
            WebRTCLibrary.SIP.SIPConnection callerConnection = new WebRTCLibrary.SIP.SIPConnection(SIPSchemesEnum.sip, this.Transport); // TODO: Add predicate here?

            DialogRelay remoteDialog = new DialogRelay(generalDialog.Params, remoteConnection);
            DialogRelay callerDialog = new DialogRelay(peerDialog.Params, callerConnection);

            this.connectedDialogs.Add((callerDialog, remoteDialog));
        }

        private GeneralDialog FindConnection(GeneralDialog generalDialog)
        {
            return this.allDialogs.Single(g =>
                g.Connected &&
                g.Params.RemoteParticipant == generalDialog.Params.ClientParticipant // What??  // TODO: implement equals operator
            );
        }
    }
}
