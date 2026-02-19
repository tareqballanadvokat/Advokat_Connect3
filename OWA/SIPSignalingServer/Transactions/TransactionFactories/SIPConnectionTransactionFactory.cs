namespace SIPSignalingServer.Transactions.TransactionFactories
{
    using Advokat.WebRTC.Library.SIP.Interfaces;
    using Microsoft.Extensions.Logging;
    using SIPSignalingServer.Interfaces;
    using SIPSignalingServer.Models;
    using SIPSignalingServer.Transactions.Interfaces;
    using SIPSignalingServer.Transactions.Interfaces.TransactionFactories;
    using SIPSorcery.SIP;

    internal class SIPConnectionTransactionFactory : ISIPConnectionTransactionFactory
    {
        public ISIPConnectionTransaction Create(
            SIPSchemesEnum sipScheme,
            ISIPTransport transport,
            ServerSideTransactionParams sipParams,
            SIPRegistration registration,
            SIPRegistration peerRegistation,
            ISIPConnectionPool connectionPool,
            ILoggerFactory loggerFactory)
        {
            return new SIPConnectionTransaction(
                sipScheme,
                transport,
                sipParams,
                registration,
                peerRegistation,
                connectionPool,
                loggerFactory);
        }
    }
}
