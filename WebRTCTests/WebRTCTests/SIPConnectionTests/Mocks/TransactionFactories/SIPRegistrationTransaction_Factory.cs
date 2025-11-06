using WebRTCClient.Transactions.SIP.Interfaces;
using WebRTCClient.Transactions.SIP.Interfaces.TransactionFactories;
using Advokat.WebRTC.Library.SIP.Interfaces;
using Advokat.WebRTC.Library.SIP.Models;

namespace SIPClientTests.SIPConnectionTests.Mocks.TransactionFactories
{
    internal class SIPRegistrationTransaction_Factory<T> : ISIPRegistrationTransactionFactory
        where T : ISIPRegistrationTransaction, new()
    {
        public ISIPRegistrationTransaction Create(ISIPConnection connection, TransactionParams transactionParams)
        {
            return new T();
        }
    }
}
