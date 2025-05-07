using SIPSignalingServer.Transactions;
using SIPSignalingServer.Models;
using SIPSorcery.SIP;
using Microsoft.Extensions.Logging;

namespace SIPSignalingServer
{
    internal class SIPConnectionPool
    {
        private readonly ILogger<SIPConnectionPool> logger;

        private readonly object lockObject = new object();
        
        private readonly List<SIPTunnel> Connections = new List<SIPTunnel>();

        private readonly List<SIPMessageRelay> PendingConnections = new List<SIPMessageRelay>();
        
        public SIPConnectionPool(ILoggerFactory loggerFactory)
        {
            this.logger = loggerFactory.CreateLogger<SIPConnectionPool>();
        }

        public void Connect(SIPMessageRelay messageRelay)
        {
            if (!ParamsAreValid(messageRelay.Params))
            {
                // params are invalid - cannot create any connection
                return;
            }

            if (this.GetConnection(messageRelay) != null)
            {
                // connection does already exist
                return;
            }

            lock (this.lockObject)
            {
                SIPMessageRelay? pendingPeerMessageRelay = this.GetPendingPeer(messageRelay);

                if (pendingPeerMessageRelay == null)
                {
                    this.AddPending(messageRelay);
                    return;
                }

                this.CreateNewConnection(messageRelay, pendingPeerMessageRelay);
                this.PendingConnections.Remove(pendingPeerMessageRelay);
            }
        }

        //public bool IsConnected(ServerSideTransactionParams transactionParams)
        //{
        //    if (!ParamsAreValid(transactionParams))
        //    {
        //        // params are invalid. Cannot be connected
        //        return false;
        //    }

        //    return this.GetConnection(transactionParams)?.Connected ?? false;
        //}

        public bool IsConnected(SIPMessageRelay messageRelay)
        {
            if (!ParamsAreValid(messageRelay.Params))
            {
                // params are invalid. Cannot be connected
                return false;
            }

            return this.GetConnection(messageRelay)?.Connected ?? false;
        }

        //public SIPMessageRelay? GetMessageRelay(ServerSideTransactionParams transactionParams)
        //{
        //    return this.GetPendingMessageRelay(transactionParams)
        //        ?? this.Connections.SingleOrDefault(t => t.Left.Params == transactionParams)?.Left
        //        ?? this.Connections.SingleOrDefault(t => t.Right.Params == transactionParams)?.Right;
        //}

        // TODO: do we net it? (does this mean "do we need it?")
        public SIPTunnel? GetConnection(ServerSideTransactionParams transactionParams)
        {
            return this.Connections.SingleOrDefault(t => t.Left.Params == transactionParams || t.Right.Params == transactionParams);
        }

        private static bool ParamsAreValid(ServerSideTransactionParams transactionParams)
        {
            return
                //transactionParams.CallId != null
                transactionParams.ClientTag != null
                || transactionParams.RemoteTag != null;
        }

        private SIPTunnel? GetConnection(SIPMessageRelay messageRelay)
        {
            // TODO: also get connections with same parameters not just same reference? Equality comparer in transaction?
            return this.Connections.SingleOrDefault(t => t.Left == messageRelay || t.Right == messageRelay);
        }

        private SIPMessageRelay? GetPendingPeer(SIPMessageRelay messageRelay)
        {
            //string callId = messageRelay.Params.CallId;

            string peerClientTag = messageRelay.Params.RemoteTag; // TODO: could not be set
            string peerRemoteTag = messageRelay.Params.ClientTag;

            string peerUsername = messageRelay.Params.RemoteParticipant.Name;
            string peerRemoteUser = messageRelay.Params.ClientParticipant.Name;

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

        //private SIPMessageRelay? GetPendingMessageRelay(ServerSideTransactionParams transactionParams)
        //{
        //    // TODO: implement equality comparer
        //    return this.PendingConnections.SingleOrDefault(r => r.Params == transactionParams);
        //}

        private void AddPending(SIPMessageRelay messageRelay)
        {
            lock (this.lockObject)
            {
                // TODO: which equality comparer gets used? override?
                if (this.PendingConnections.Contains(messageRelay))
                {
                    // already contains messageRelay

                    return;
                }

                messageRelay.Params.CallId = CallProperties.CreateNewCallId(); // creates new call id for connection

                this.logger.LogDebug("Added new pending connection. From:'{caller}', to:'{remote}'.", messageRelay.Params.ClientParticipant, messageRelay.Params.RemoteParticipant);
                this.PendingConnections.Add(messageRelay);
            }
        }

        private void CreateNewConnection(SIPMessageRelay messageRelay, SIPMessageRelay pendingPeerMessageRelay)
        {
            messageRelay.Params.CallId = pendingPeerMessageRelay.Params.CallId;

            // TODO: Check if we should have ip addresses in logs on info level
            this.logger.LogInformation("Connection established. '{caller}' - '{remote}'.", messageRelay.Params.ClientParticipant, pendingPeerMessageRelay.Params.ClientParticipant);
            this.Connections.Add(new SIPTunnel(messageRelay, pendingPeerMessageRelay));
        }
    }
}
