using SIPSignalingServer.Dialogs;
using SIPSignalingServer.Models;
using SIPSorcery.SIP;

namespace SIPSignalingServer
{
    internal class ConnectionPool
    {
        // TODO: lock list
        private readonly List<SIPTunnel> Connections = new List<SIPTunnel>();

        private readonly List<RelayDialog> PendingConnections = new List<RelayDialog>();
        
        public void Connect(RelayDialog dialog)
        {
            if (!ParamsAreValid(dialog.Params))
            {
                // params are invalid - cannot create any connection
                return;
            }

            if (this.GetConnection(dialog) != null)
            {
                // connection does already exist
                return;
            }

            RelayDialog? pendingPeerDialog = this.GetPendingPeer(dialog);

            if (pendingPeerDialog == null)
            {
                this.AddPending(dialog);
                return;
            }

            this.CreateNewConnection(dialog, pendingPeerDialog);
            this.PendingConnections.Remove(pendingPeerDialog);
        }

        public bool IsConnected(ServerSideDialogParams dialogParams)
        {
            if (!ParamsAreValid(dialogParams))
            {
                // params are invalid. Cannot be connected
                return false;
            }

            return this.GetConnection(dialogParams)?.Connected ?? false;
        }

        public RelayDialog? GetDialog(ServerSideDialogParams dialogParams)
        {
            return this.GetPendingDialog(dialogParams)
                ?? this.Connections.SingleOrDefault(t => t.Left.Params == dialogParams)?.Left
                ?? this.Connections.SingleOrDefault(t => t.Right.Params == dialogParams)?.Right;
        }

        // TODO: do we net it? (does this mean "do we need it?")
        public SIPTunnel? GetConnection(ServerSideDialogParams dialogParams)
        {
            return this.Connections.SingleOrDefault(t => t.Left.Params == dialogParams || t.Right.Params == dialogParams);
        }

        private static bool ParamsAreValid(ServerSideDialogParams dialogParams)
        {
            return 
                //dialogParams.CallId != null
                dialogParams.ClientTag != null
                || dialogParams.RemoteTag != null;
        }

        private SIPTunnel? GetConnection(RelayDialog dialog)
        {
            // TODO: also get connections with same parameters nut just same reference? Equality comparer in dialog?
            return this.Connections.SingleOrDefault(t => t.Left == dialog || t.Right == dialog);
        }

        private RelayDialog? GetPendingPeer(RelayDialog dialog)
        {
            //string callId = dialog.Params.CallId;
            
            string peerClientTag = dialog.Params.RemoteTag; // TODO: could not be set
            string peerRemoteTag = dialog.Params.ClientTag;

            string peerUsername = dialog.Params.RemoteParticipant.Name;
            string peerRemoteUser = dialog.Params.ClientParticipant.Name;

            return this.PendingConnections.SingleOrDefault(r => 
                //r.Params.CallId == callId
                //&& 
                r.Params.ClientTag == peerClientTag
                && r.Params.RemoteTag == peerRemoteTag // could not be set?

                // TODO: names could be null?
                && r.Params.ClientParticipant.Name == peerUsername
                && r.Params.RemoteParticipant.Name == peerRemoteUser
                );
        }

        private RelayDialog? GetPendingDialog(ServerSideDialogParams dialogParams)
        {
            // TODO: implement equality comparer
            return this.PendingConnections.SingleOrDefault(r => r.Params == dialogParams);
        }

        private void AddPending(RelayDialog dialog)
        {
            // TODO: which equality comparer gets used? override?
            if (this.PendingConnections.Contains(dialog))
            {
                // already contains dialog
                
                return;
            }

            dialog.Params.CallId = CallProperties.CreateNewCallId(); // creates new call id for connection
            this.PendingConnections.Add(dialog);
        }

        private void CreateNewConnection(RelayDialog dialog, RelayDialog pendingPeerDialog)
        {

            dialog.Params.CallId = pendingPeerDialog.Params.CallId;
            this.Connections.Add(new SIPTunnel(dialog, pendingPeerDialog));
        }
    }
}
