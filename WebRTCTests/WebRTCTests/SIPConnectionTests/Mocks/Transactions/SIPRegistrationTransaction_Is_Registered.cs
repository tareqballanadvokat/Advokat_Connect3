using SIPSorcery.SIP;
using WebRTCClient.Transactions.SIP.Interfaces;
using WebRTCLibrary.SIP.Interfaces;
using WebRTCLibrary.SIP.Models;

namespace SIPClientTests.SIPConnectionTests.Mocks.Transactions
{
    internal class SIPRegistrationTransaction_Is_Registered : ISIPRegistrationTransaction
    {
        public bool Registered => true;

        public ISIPConnection Connection => throw new NotImplementedException();

        public TransactionParams Params => throw new NotImplementedException();

        public int ReceiveTimeout { get; set; }
        public int SendTimeout { get; set; }

        public SIPSchemesEnum SIPScheme => throw new NotImplementedException();

        public async Task Start()
        {
        }

        public async Task Start(CancellationToken? ct = null)
        {
            throw new NotImplementedException();
        }

        public Task Unregister()
        {
            throw new NotImplementedException();
        }
    }
}
