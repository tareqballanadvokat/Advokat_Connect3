using SIPSignalingServer.Models;
using WebRTCLibrary.SIP.Interfaces;

namespace SIPSignalingServer.Transactions.Interfaces
{
    public interface IServerSideSIPTransaction : ISIPTransaction
    {
        public new ServerSideTransactionParams Params { get; }
    }
}
