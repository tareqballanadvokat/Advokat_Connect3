using WebRTCClient.Transactions.SIP.Interfaces;
using WebRTCClient.Transactions.SIP.Interfaces.TransactionFactories;
using Advokat.WebRTC.Library.SIP.Interfaces;
using Advokat.WebRTC.Library.SIP.Models;
using Microsoft.Extensions.Logging.Abstractions;
using SIPClientTests.SIPConnectionTests.Mocks.Transactions;

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
            if (this.RegistrationTransaction is SIPRegistrationTransaction_Unregistering_Possible registrationTransaction)
            {
                registrationTransaction.PassedInCreated = transactionParams;
                return registrationTransaction;
            }

            return (ISIPRegistrationTransaction)Activator.CreateInstance(typeof(T), new object[] {connection, transactionParams, NullLoggerFactory.Instance });
        }
    }
}
