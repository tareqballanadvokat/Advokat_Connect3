using Microsoft.Extensions.Logging;
using SIPSignalingServer.Interfaces;
using SIPSignalingServer.Transactions.Interfaces;
using SIPSignalingServer.Transactions.Interfaces.TransactionFactories;
using SIPSorcery.SIP;
using WebRTCLibrary.SIP.Interfaces;

namespace SIPSignalingServer.Transactions.TransactionFactories
{
    internal class SIPRegistrationTransactionFactory : ISIPRegistrationTransactionFactory
    {
        public ISIPRegistrationTransaction Create(ISIPConnection connection, SIPRequest initialRequest, SIPEndPoint signalingServer, ISIPRegistry registry, ILoggerFactory loggerFactory)
        {
            return new SIPRegistrationTransaction(
                connection,
                initialRequest,
                signalingServer,
                registry,
                loggerFactory);
        }
    }
}
