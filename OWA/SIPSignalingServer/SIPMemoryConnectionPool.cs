using SIPSignalingServer.Transactions;
using SIPSignalingServer.Models;
using SIPSorcery.SIP;
using Microsoft.Extensions.Logging;
using SIPSignalingServer.Interfaces;

namespace SIPSignalingServer
{
    internal class SIPMemoryConnectionPool : ISIPConnectionPool
    {
        private readonly ILogger<SIPMemoryConnectionPool> logger;

        private readonly object lockObject = new object();

        private readonly List<SIPTunnel> Connections = new List<SIPTunnel>();

        private readonly List<SIPMessageRelay> PendingConnections = new List<SIPMessageRelay>();

        public event ISIPConnectionPool.ConnectionRemovedDelegate? ConnectionRemoved;

        public SIPMemoryConnectionPool(ILoggerFactory loggerFactory)
        {
            this.logger = loggerFactory.CreateLogger<SIPMemoryConnectionPool>();
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

        public void Disconnect(SIPMessageRelay messageRelay)
        {
            lock (lockObject)
            {
                if (this.IsConnected(messageRelay))
                {
                    // TODO: Disconnect both
                    //       stop the messaging
                }

                if (this.PendingConnections.Remove(messageRelay))
                {
                    this.ConnectionRemoved?.Invoke(this, messageRelay.Params);
                }
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
            // lock it?
            lock (lockObject)
            {
                return this.Connections.SingleOrDefault(t => t.Left.Params == transactionParams || t.Right.Params == transactionParams);
            }
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
            // 
            // TODO: Throws a nullreference exception when more than one pair try to connect
            // lock it?
            lock (lockObject)
            {
                return this.Connections.SingleOrDefault(t => t.Left == messageRelay || t.Right == messageRelay);
            }
        }

        private SIPMessageRelay? GetPendingPeer(SIPMessageRelay messageRelay)
        {
            return this.PendingConnections.SingleOrDefault(r => r.Params.IsPeer(messageRelay.Params));
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
                // TODO: check which equality comparer gets used? override?
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
