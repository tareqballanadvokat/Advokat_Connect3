using SIPSignalingServer.Models;

namespace SIPSignalingServer
{
    internal class ConnectionPool
    {
        // readonly?
        public List<SIPTunnel> Connections = new List<SIPTunnel>();
    }
}
