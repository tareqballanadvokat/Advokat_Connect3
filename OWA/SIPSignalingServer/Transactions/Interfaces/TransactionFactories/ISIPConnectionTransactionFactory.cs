namespace SIPSignalingServer.Transactions.Interfaces.TransactionFactories
{
    using Advokat.WebRTC.Library.SIP.Interfaces;
    using Microsoft.Extensions.Logging;
    using SIPSignalingServer.Interfaces;
    using SIPSignalingServer.Models;
    using SIPSorcery.SIP;

    public interface ISIPConnectionTransactionFactory
    {
        public ISIPConnectionTransaction Create(
            SIPSchemesEnum sipScheme,
            ISIPTransport transport,
            ServerSideTransactionParams sipParams,
            SIPRegistration registration,
            SIPRegistration peerRegistration,
            ISIPConnectionPool connectionPool,
            ILoggerFactory loggerFactory);
    }
}
