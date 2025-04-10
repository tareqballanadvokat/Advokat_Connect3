using SIPSignalingServer.Models;
using SIPSorcery.SIP;
using WebRTCLibrary.SIP;

namespace SIPSignalingServer.Dialogs
{
    internal abstract class ServerSideSIPDialog : SIPDialog
    {
        public new ServerSideDialogParams Params
        { 
            get => (ServerSideDialogParams)base.Params;
            set => base.Params = value;
        }

        public ServerSideSIPDialog(SIPSchemesEnum sipScheme, SIPTransport transport, ServerSideDialogParams dialogParams)
            : base(sipScheme, transport, dialogParams)
        {
        }

        public ServerSideSIPDialog(SIPConnection connection, ServerSideDialogParams dialogParams)
            : base(connection, dialogParams)
        {
        }
    }
}
