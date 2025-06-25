using WebRTCLibrary.SIP.Interfaces;
using WebRTCLibrary.SIP.Models;

namespace WebRTCClient.Transactions.SIP.Interfaces.TransactionFactories
{
    public interface ISIPRegistrationTransactionFactory
    {
        public ISIPRegistrationTransaction Create(ISIPConnection connection, TransactionParams transactionParams);
    }
}
