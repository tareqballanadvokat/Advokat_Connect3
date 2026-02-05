using SIPSignalingServer.Models;
using SIPSignalingServer.Transactions;
using SIPSignalingServer.Utils.CustomEventArgs;

namespace SIPSignalingServer.Interfaces
{
    public interface ISIPConnectionPool
    {
        public event EventHandler<SIPConnectionPoolEventArgs>? ConnectionRemoved;

        public SIPTunnel Connect(SIPMessageRelay messageRelay);

        public Task Disconnect(SIPMessageRelay messageRelay);

        public Task Disconnect(SIPTunnel tunnel);

        public bool IsConnected(SIPMessageRelay messageRelay);

        public IEnumerable<SIPTunnel> GetConnections(string fromName, string toName);
    }
}
