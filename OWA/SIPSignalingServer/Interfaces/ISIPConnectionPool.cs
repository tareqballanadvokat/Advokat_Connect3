using SIPSignalingServer.Models;
using SIPSignalingServer.Transactions;

namespace SIPSignalingServer.Interfaces
{
    public interface ISIPConnectionPool
    {
        public delegate Task ConnectionRemovedDelegate(ISIPConnectionPool sender, ServerSideTransactionParams connectionParams);

        public event ConnectionRemovedDelegate? ConnectionRemoved;

        public void Connect(SIPMessageRelay messageRelay);

        public void Disconnect(SIPMessageRelay messageRelay);

        public bool IsConnected(SIPMessageRelay messageRelay);

        public SIPTunnel? GetConnection(ServerSideTransactionParams transactionParams);
    }
}
