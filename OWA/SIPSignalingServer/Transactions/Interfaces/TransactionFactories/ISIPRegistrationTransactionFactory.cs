using Microsoft.Extensions.Logging;
using SIPSignalingServer.Interfaces;
using SIPSorcery.SIP;
using WebRTCLibrary.SIP.Interfaces;

namespace SIPSignalingServer.Transactions.Interfaces.TransactionFactories
{
    public interface ISIPRegistrationTransactionFactory
    {
        public ISIPRegistrationTransaction Create(ISIPConnection connection, SIPRequest initialRequest, SIPEndPoint signalingServer, ISIPRegistry registry, ILoggerFactory loggerFactory);
    }
}
