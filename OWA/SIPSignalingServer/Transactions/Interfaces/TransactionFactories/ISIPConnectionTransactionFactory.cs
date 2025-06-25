using Microsoft.Extensions.Logging;
using SIPSignalingServer.Interfaces;
using SIPSignalingServer.Models;
using SIPSorcery.SIP;
using WebRTCLibrary.SIP.Interfaces;

namespace SIPSignalingServer.Transactions.Interfaces.TransactionFactories
{
    public interface ISIPConnectionTransactionFactory
    {
        public ISIPConnectionTransaction Create(
            SIPSchemesEnum sipScheme,
            ISIPTransport transport,
            ServerSideTransactionParams sipParams,
            ISIPRegistry registry,
            ISIPConnectionPool connectionPool,
            ILoggerFactory loggerFactory);
    }
}
