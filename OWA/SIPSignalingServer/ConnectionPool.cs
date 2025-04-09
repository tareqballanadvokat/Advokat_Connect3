using SIPSignalingServer.Models;

namespace SIPSignalingServer
{
    internal class ConnectionPool
    {
        // TODO: lock list

        private List<SIPTunnel> Connections = new List<SIPTunnel>();

        private List<(SIPTunnelEndpoint EndPoint, string CallID)> PendingConnections = new List<(SIPTunnelEndpoint EndPoint, string CallID)>();

        public void Connect(SIPTunnelEndpoint endpoint, string callID)
        {
            if (this.GetConnection(endpoint, callID) != null)
            {
                // connection does already exist
                return;
            }

            SIPTunnelEndpoint? peerEndpoint = this.GetPendingPeer(endpoint , callID);

            if (peerEndpoint == null)
            {
                this.CreatePending(endpoint, callID);
                return;
            }

            this.CreateNewConnection(endpoint, peerEndpoint, callID);
            this.RemovePending(peerEndpoint, callID);
        }

        public SIPTunnelEndpoint? GetTunnelEndpoint(SIPRegistration registration, string callID)
        {
            SIPTunnelEndpoint? pendingEndPoint = this.GetPendingEndpoint(registration.SourceParticipant.Name, callID);

            if (pendingEndPoint != null)
            {
                return pendingEndPoint;
            }

            SIPTunnelEndpoint? connectionLeft = this.Connections
                .SingleOrDefault(t =>
                    t.CallID == callID
                    && t.Left.SourceParticipant == registration.SourceParticipant
                    && t.Left.RemoteUser == registration.RemoteUser
                    && t.Left.FromTag == registration.FromTag)?
                .Left;

            if (connectionLeft != null)
            {
                return connectionLeft;
            }

            SIPTunnelEndpoint? connectionRight = this.Connections
                .SingleOrDefault(t =>
                    t.CallID == callID
                    && t.Right.SourceParticipant == registration.SourceParticipant
                    && t.Right.RemoteUser == registration.RemoteUser
                    && t.Right.FromTag == registration.FromTag)?
                .Right;

            if (connectionRight != null)
            {
                return connectionRight;
            }

            return null;
        }

        public SIPTunnel? GetConnection(SIPTunnelEndpoint endpoint, string callID)
        {
            return this.Connections.SingleOrDefault(t =>
                t.CallID == callID
                && (t.Left == endpoint || t.Right == endpoint)); // TODO: Implement equality operator?
        }

        private SIPTunnelEndpoint? GetPendingPeer(SIPTunnelEndpoint endpoint, string callID)
        {
            return this.GetPendingEndpoint(endpoint.RemoteUser, callID); // TODO: empty remoteUser?
        }

        private (SIPTunnelEndpoint EndPoint, string callID)? GetPendingObject(string name, string callID)
        {
            return this.PendingConnections.SingleOrDefault(p =>
                p.CallID == callID
                // TODO: tag?
                && p.EndPoint.SourceParticipant.Name == name);
        }

        private SIPTunnelEndpoint? GetPendingEndpoint(string name, string callID)
        {
            return this.GetPendingObject(name, callID)?.EndPoint;
        }

        private void CreatePending(SIPTunnelEndpoint endpoint, string callID)
        {
            this.PendingConnections.Add((endpoint, callID));
        }

        private void RemovePending(SIPTunnelEndpoint endpoint, string callID)
        {
            // can we just construct the tuple or is that a new object then - i would expect so
            // otherwise we could remove this call
            (SIPTunnelEndpoint EndPoint, string callID)? pendingObject = this.GetPendingObject(endpoint.SourceParticipant.Name, callID);
            
            if (pendingObject == null)
            {
                // not in pending
                return;
            }

            // does not work without the cast
            this.PendingConnections.Remove(((SIPTunnelEndpoint EndPoint, string callID))pendingObject);
        }

        private void CreateNewConnection(SIPTunnelEndpoint leftEndPoint, SIPTunnelEndpoint rightEndPoint, string callID)
        {
            this.Connections.Add(new SIPTunnel(leftEndPoint, rightEndPoint, callID));
        }
    }
}
