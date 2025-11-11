using WebRTCClient.Transactions.SIP.Interfaces;
using WebRTCClient.Transactions.SIP.Interfaces.TransactionFactories;
using Advokat.WebRTC.Library.SIP.Interfaces;
using Advokat.WebRTC.Library.SIP.Models;

namespace SIPClientTests.SIPConnectionTests.Mocks.TransactionFactories
{
    internal class SIPRegistrationTransaction_Factory<T> : ISIPRegistrationTransactionFactory
        where T : ISIPRegistrationTransaction, new()
    {
        private T? RegistrationTransaction { get; set; }

        public SIPRegistrationTransaction_Factory()
        {
        }

        public SIPRegistrationTransaction_Factory(T registrationTransaction)
        {
            this.RegistrationTransaction = registrationTransaction;
        }

        public ISIPRegistrationTransaction Create(ISIPConnection connection, TransactionParams transactionParams)
        {
            return this.RegistrationTransaction ?? new T();
        }
    }
}
