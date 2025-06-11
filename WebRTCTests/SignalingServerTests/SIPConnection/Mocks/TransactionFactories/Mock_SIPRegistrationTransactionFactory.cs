using Microsoft.Extensions.Logging;
using SignalingServerTests.SIPConnection.Mocks.SIPRegistrationTransaction;
using SIPSignalingServer.Interfaces;
using SIPSignalingServer.Transactions.Interfaces;
using SIPSignalingServer.Transactions.Interfaces.TransactionFactories;
using SIPSorcery.SIP;
using WebRTCLibrary.SIP.Interfaces;

namespace SignalingServerTests.SIPConnection.Mocks.TransactionFactories
{
    internal class Mock_SIPRegistrationTransactionFactory(ISIPRegistrationTransaction sipRegistrationTransaction) : ISIPRegistrationTransactionFactory
    {
        public ISIPRegistrationTransaction Create(ISIPConnection connection, SIPRequest initialRequest, SIPEndPoint signalingServer, ISIPRegistry registry, ILoggerFactory loggerFactory)
        {
            return sipRegistrationTransaction;
        }
    }
}
