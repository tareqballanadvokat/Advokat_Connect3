using Microsoft.Extensions.Logging;
using SIPSignalingServer.Models;
using SIPSorcery.SIP;
using WebRTCLibrary.SIP;
using WebRTCLibrary.SIP.Interfaces;

namespace SIPSignalingServer.Transactions
{
    internal abstract class ServerSideSIPTransaction : WebRTCLibrary.SIP.SIPTransaction
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
