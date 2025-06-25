using SIPSignalingServer.Models;
using SIPSignalingServer.Transactions;

namespace SIPSignalingServer.Interfaces
{
    public interface ISIPConnectionPool
    {
        public delegate Task ConnectionRemovedDelegate(ISIPConnectionPool sender, SIPTunnel connectionParams);

        public event ConnectionRemovedDelegate? ConnectionRemoved;

        public delegate Task ConnectionEstablishedDelegate(ISIPConnectionPool sender, SIPTunnel tunnel);

        public event ConnectionEstablishedDelegate? ConnectionEstablished;

        public Task<SIPTunnel> Connect(SIPMessageRelay messageRelay);

        public Task Disconnect(SIPMessageRelay messageRelay);

        public Task Disconnect(SIPTunnel tunnel);

        public bool IsConnected(SIPMessageRelay messageRelay);

        public SIPTunnel? GetConnection(ServerSideTransactionParams transactionParams);
    }
}
