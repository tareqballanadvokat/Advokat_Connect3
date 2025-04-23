using Microsoft.Extensions.Logging;
using SIPSignalingServer.Models;
using SIPSorcery.SIP;
using WebRTCLibrary.SIP;

namespace SIPSignalingServer.Transactions
{
    internal abstract class ServerSideSIPTransaction : WebRTCLibrary.SIP.SIPTransaction
    {
        public new ServerSideTransactionParams Params
        { 
            get => (ServerSideTransactionParams)base.Params;
            set => base.Params = value;
        }

        public ServerSideSIPTransaction(SIPSchemesEnum sipScheme, SIPTransport transport, ServerSideTransactionParams transactionParams, ILoggerFactory loggerFactory)
            : base(sipScheme, transport, transactionParams, loggerFactory)
        {
        }

        public ServerSideSIPTransaction(SIPConnection connection, ServerSideTransactionParams transactionParams, ILoggerFactory loggerFactory)
            : base(connection, transactionParams, loggerFactory)
        {
        }
    }
}
