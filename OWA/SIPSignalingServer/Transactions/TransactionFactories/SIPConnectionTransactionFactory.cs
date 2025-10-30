using Advokat.WebRTC.Library.SIP.Interfaces;
using Microsoft.Extensions.Logging;
using SIPSignalingServer.Interfaces;
using SIPSignalingServer.Models;
using SIPSignalingServer.Transactions.Interfaces;
using SIPSignalingServer.Transactions.Interfaces.TransactionFactories;
using SIPSorcery.SIP;

namespace SIPSignalingServer.Transactions.TransactionFactories
{
    internal class SIPConnectionTransactionFactory : ISIPConnectionTransactionFactory
    {
        public ISIPConnectionTransaction Create(
            SIPSchemesEnum sipScheme,
            ISIPTransport transport,
            ServerSideTransactionParams sipParams,
            ISIPRegistry registry,
            ISIPConnectionPool connectionPool,
            ILoggerFactory loggerFactory)
        {
            return new SIPConnectionTransaction(
                sipScheme,
                transport,
                sipParams,
                registry,
                connectionPool,
                loggerFactory);
        }
    }
}
