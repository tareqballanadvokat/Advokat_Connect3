using Advokat.WebRTC.Library.SIP.Interfaces;
using Microsoft.Extensions.Logging;
using SIPSignalingServer.Models;
using SIPSorcery.SIP;

namespace SIPSignalingServer.Transactions
{
    public abstract class ServerSideSIPTransaction : Advokat.WebRTC.Library.SIP.SIPTransaction, ISIPTransaction
    {
        public new ServerSideTransactionParams Params
        {
            get => (ServerSideTransactionParams)base.Params;
            set => base.Params = value;
        }

        public ServerSideSIPTransaction(SIPSchemesEnum sipScheme, ISIPTransport transport, ServerSideTransactionParams transactionParams, ILoggerFactory loggerFactory)
            : base(sipScheme, transport, transactionParams, loggerFactory)
        {
        }

        public ServerSideSIPTransaction(ISIPConnection connection, ServerSideTransactionParams transactionParams, ILoggerFactory loggerFactory)
            : base(connection, transactionParams, loggerFactory)
        {
        }
    }
}
