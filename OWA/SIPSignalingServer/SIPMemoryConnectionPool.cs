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

        public event ISIPConnectionPool.ConnectionRemovedDelegate? ConnectionRemoved;

        public event ISIPConnectionPool.ConnectionEstablishedDelegate? ConnectionEstablished;

        public SIPMemoryConnectionPool(ILoggerFactory loggerFactory)
        {
            this.logger = loggerFactory.CreateLogger<SIPMemoryConnectionPool>();
        }

        public async Task<SIPTunnel> Connect(SIPMessageRelay messageRelay)
        {
            if (!ParamsAreValid(messageRelay.Params))
            {
                // params are invalid - cannot create any connection
                throw new ArgumentException("Invalid params. Cannot connect");

                //return;
            }

            SIPTunnel? tunnel;

            lock (this.lockObject)
            {
                tunnel = this.GetConnection(messageRelay);

                if (tunnel != null)
                {
                    if (tunnel.Right == null)
                    {
                        // is already a pending connection
                        return tunnel;
                    }

                    return tunnel;
                }

                tunnel = this.GetPendingFor(messageRelay);

                if (tunnel == null)
                {
                    // Add new pending connection
                    return this.AddPending(messageRelay);
                }

                tunnel = this.Connect(tunnel, messageRelay);
            }

            await tunnel.CheckForConnection();
            return tunnel;
        }

        private SIPTunnel Connect(SIPTunnel pendingConnection, SIPMessageRelay messageRelay)
        {
            messageRelay.Params.CallId = pendingConnection.Left.Params.CallId;

            // TODO: Check if we should have ip addresses in logs on info level
            this.logger.LogInformation("Connection established. '{caller}' - '{remote}'.", pendingConnection.Left.Params.ClientParticipant, messageRelay.Params.ClientParticipant);
            pendingConnection.Connect(messageRelay);
            return pendingConnection;
        }

        public async Task Disconnect(SIPMessageRelay messageRelay)
        {
            SIPTunnel? tunnel;

            tunnel = this.GetConnection(messageRelay);

            if (tunnel == null)
            {
                // no connection to disconnect
                return;
            }

            await tunnel.Disconnect();
        }

        public async Task Disconnect(SIPTunnel tunnel)
        {
            this.Connections.Remove(tunnel);
            await tunnel.Disconnect();
            await (this.ConnectionRemoved?.Invoke(this, tunnel) ?? Task.CompletedTask);
        }

        public bool IsConnected(SIPMessageRelay messageRelay)
        {
            if (!ParamsAreValid(messageRelay.Params))
            {
                // params are invalid. Cannot be connected
                return false;
            }

            return this.GetConnection(messageRelay)?.Connected ?? false;
        }

        public SIPTunnel? GetConnection(string fromName, string toName)
        {
            // lock it?
            lock (lockObject)
            {
                return this.Connections.SingleOrDefault(t => 
                    (t.Left.Params.ClientParticipant.Name == fromName && (t.Right == null || t.Right.Params.ClientParticipant.Name == toName))
                    || (t.Left.Params.ClientParticipant.Name == toName && (t.Right == null || t.Right.Params.ClientParticipant.Name == fromName)));
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

        private SIPTunnel? GetPendingFor(SIPMessageRelay messageRelay)
        {
            // TODO: What if there are multiple?
            return this.Connections.SingleOrDefault(c => c.Left.Params.IsPeer(messageRelay.Params));
        }

        private SIPTunnel AddPending(SIPMessageRelay messageRelay)
        {
            lock (this.lockObject)
            {
                if (this.GetConnection(messageRelay) != null)
                {
                    throw new ArgumentException("Messagerelay already connected. Cannot add as pending connection.");
                }

                messageRelay.Params.CallId = CallProperties.CreateNewCallId(); // creates new call id for connection
                SIPTunnel tunnel = new SIPTunnel(messageRelay);

                //tunnel.ConnectionEstablished += 
                
                tunnel.ConnectionStopped += this.Disconnect;
                this.Connections.Add(tunnel);
                this.logger.LogDebug("Added new pending connection. From:'{caller}', to:'{remote}'.", messageRelay.Params.ClientParticipant, messageRelay.Params.RemoteParticipant);

                return tunnel;
            }
        }
    }
}
