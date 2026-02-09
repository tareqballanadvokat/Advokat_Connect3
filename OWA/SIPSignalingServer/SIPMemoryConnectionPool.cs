using SIPSignalingServer.Transactions;
using SIPSignalingServer.Models;
using SIPSorcery.SIP;
using Microsoft.Extensions.Logging;
using SIPSignalingServer.Interfaces;
using SIPSignalingServer.Utils.CustomEventArgs;

namespace SIPSignalingServer
{
    internal class SIPMemoryConnectionPool : ISIPConnectionPool
    {
        private readonly ILogger<SIPMemoryConnectionPool> logger;

        private readonly SemaphoreSlim connectionPoolLock = new SemaphoreSlim(1, 1);

        private readonly List<SIPTunnel> Connections = new List<SIPTunnel>();

        public event EventHandler<SIPConnectionPoolEventArgs>? ConnectionRemoved;

        public SIPMemoryConnectionPool(ILoggerFactory loggerFactory)
        {
            this.logger = loggerFactory.CreateLogger<SIPMemoryConnectionPool>();
        }

        public SIPTunnel Connect(SIPMessageRelay messageRelay)
        {
            if (!ParamsAreValid(messageRelay.Params))
            {
                // params are invalid - cannot create any connection
                throw new ArgumentException("Invalid params. Cannot connect");
            }


            this.connectionPoolLock.Wait();

            try
            {
                SIPTunnel? tunnel = this.LockedGetConnection(messageRelay);
                if (tunnel != null)
                {
                    // is already a pending connection or connected
                    return tunnel;
                }

                // TODO Get tunnel by params - close old Tunnel?

                SIPTunnel? pendingTunnel = this.GetPendingFor(messageRelay);
                if (pendingTunnel == null)
                {
                    // add new pending connection
                    return this.AddPending(messageRelay);
                }

                return this.Connect(pendingTunnel, messageRelay);

                //IEnumerable<SIPTunnel> pendingTunnels = this.GetPendingFor(messageRelay);
                //if (!pendingTunnels.Any())
                //{
                //    // create new pending connection
                //    return this.AddPending(messageRelay);
                //}

                //IEnumerable<SIPTunnel> oldTunnels = this.LockedGetConnections(messageRelay.Params.ClientParticipant.Name, messageRelay.Params.RemoteParticipant.Name);
                //foreach (SIPTunnel oldTunnel in oldTunnels.Except(pendingTunnels))
                //{
                //    await this.LockedDisconnect(oldTunnel);
                //}

                //foreach(SIPTunnel pendingTunnel in pendingTunnels)
                //{
                //    // TODO: Return multiple tunnels?
                //    tunnel = this.Connect(pendingTunnel, messageRelay);
                //}
            }
            finally
            {
                this.connectionPoolLock.Release();
            }
        }

        private SIPTunnel Connect(SIPTunnel pendingConnection, SIPMessageRelay messageRelay)
        {
            messageRelay.Params.CallId = pendingConnection.Left.Params.CallId;

            pendingConnection.Connect(messageRelay);

            // TODO: Check if we should have ip addresses in logs on info level
            this.logger.LogInformation("Connection established. '{caller}' - '{remote}'.", pendingConnection.Left.Params.ClientParticipant, messageRelay.Params.ClientParticipant);
            return pendingConnection;
        }

        public async Task Disconnect(SIPMessageRelay messageRelay)
        {
            await this.connectionPoolLock.WaitAsync();

            try
            {
                SIPTunnel? tunnel = this.LockedGetConnection(messageRelay);
                if (tunnel != null)
                {
                    await this.LockedDisconnect(tunnel);
                }
            }
            finally
            {
                this.connectionPoolLock.Release();
            }
        }

        public async Task Disconnect(SIPTunnel tunnel)
        {
            await this.connectionPoolLock.WaitAsync();

            try
            {
                await this.LockedDisconnect(tunnel);
            }
            finally
            {
                this.connectionPoolLock.Release();
            }
        }

        private async Task LockedDisconnect(SIPTunnel tunnel)
        {
            bool success = this.Connections.Remove(tunnel);
            tunnel.ConnectionStateChanged -= this.SIPTunnelConnectionStateChanged;
            await tunnel.Disconnect();

            if (success)
            {
                // TODO: Log
                this.ConnectionRemoved?.Invoke(this, new SIPConnectionPoolEventArgs(tunnel));
            }
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

        public IEnumerable<SIPTunnel> GetConnections(string fromName, string toName)
        {

            this.connectionPoolLock.Wait();
            try
            {
                return this.LockedGetConnections(fromName, toName);
            }
            finally
            {
                this.connectionPoolLock.Release();
            }
        }

        private SIPTunnel? GetConnection(SIPMessageRelay messageRelay)
        {

            this.connectionPoolLock.Wait();
            try
            {
                return this.LockedGetConnection(messageRelay);
            }
            finally
            {
                this.connectionPoolLock.Release();
            }
        }

        private IEnumerable<SIPTunnel> LockedGetConnections(string fromName, string toName)
        {
            return this.Connections.Where(t =>
                    (t.Left.Params.ClientParticipant.Name == fromName && (t.Right == null || t.Right.Params.ClientParticipant.Name == toName))
                    || (t.Left.Params.ClientParticipant.Name == toName && (t.Right == null || t.Right.Params.ClientParticipant.Name == fromName)));
        }

        private SIPTunnel? LockedGetConnection(SIPMessageRelay messageRelay)
        {
            // TODO: also get connections with same parameters not just same reference? Equality comparer in transaction?
            // 
            // TODO: Throws a nullreference exception when more than one pair try to connect

            return this.Connections.SingleOrDefault(t => t.Left == messageRelay || t.Right == messageRelay);
        }

        private static bool ParamsAreValid(ServerSideTransactionParams transactionParams)
        {
            return
                //transactionParams.CallId != null
                transactionParams.ClientTag != null
                || transactionParams.RemoteTag != null;
        }

        private SIPTunnel? GetPendingFor(SIPMessageRelay messageRelay)
        {
            // TODO: What if there are multiple?
            return this.Connections.SingleOrDefault(c => c.Left.Params.IsPeer(messageRelay.Params));
        }

        private SIPTunnel AddPending(SIPMessageRelay messageRelay)
        {
            messageRelay.Params.CallId = CallProperties.CreateNewCallId(); // creates new call id for connection
            SIPTunnel tunnel = new SIPTunnel(messageRelay);

            //tunnel.ConnectionEstablished += 
                
            tunnel.ConnectionStateChanged += SIPTunnelConnectionStateChanged;
            this.Connections.Add(tunnel);
            this.logger.LogDebug("Added new pending connection. From:'{caller}', to:'{remote}'.", messageRelay.Params.ClientParticipant, messageRelay.Params.RemoteParticipant);

            return tunnel;
        }

        private async void SIPTunnelConnectionStateChanged(object? sender, SIPTunnelConnectionStateEventArgs e)
        {
            if (sender is SIPTunnel tunnel && !e.Connected)
            {
                await this.Disconnect(tunnel);
            }
        }
    }
}
