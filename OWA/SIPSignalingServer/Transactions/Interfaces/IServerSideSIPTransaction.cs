using Advokat.WebRTC.Library.SIP.Interfaces;
using SIPSignalingServer.Models;

namespace SIPSignalingServer.Transactions.Interfaces
{
    public interface IServerSideSIPTransaction : ISIPTransaction
    {
        public new ServerSideTransactionParams Params { get; }
    }
}
