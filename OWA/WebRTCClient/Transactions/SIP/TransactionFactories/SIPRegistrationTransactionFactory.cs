using Microsoft.Extensions.Logging;
using WebRTCClient.Transactions.SIP.Interfaces;
using WebRTCClient.Transactions.SIP.Interfaces.TransactionFactories;
using WebRTCLibrary.SIP.Interfaces;
using WebRTCLibrary.SIP.Models;

namespace WebRTCClient.Transactions.SIP.TransactionFactories
{
    internal class SIPRegistrationTransactionFactory(ILoggerFactory loggerFactory) : ISIPRegistrationTransactionFactory
    {
        public ISIPRegistrationTransaction Create(ISIPConnection connection, TransactionParams transactionParams)
        {
            return new SIPRegistrationTransaction(connection, transactionParams, loggerFactory);
        }
    }
}
