using SIPSignalingServer.Models;
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

        public ServerSideSIPDialog(ServerSideDialogParams dialogParams, SIPConnection connection)
            : base(dialogParams, connection)
        {
        }
    }
}
