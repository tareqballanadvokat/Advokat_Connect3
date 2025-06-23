using SIPSorcery.SIP;
using WebRTCClient.Transactions.SIP.Interfaces;
using WebRTCLibrary.SIP.Interfaces;
using WebRTCLibrary.SIP.Models;

namespace SIPClientTests.SIPConnectionTests.Mocks.Transactions
{
    internal class SIPRegistrationTransaction_Unregistering_Possible : ISIPRegistrationTransaction
    {
        public bool Registered { get; set; } = true;

        public ISIPConnection Connection => throw new NotImplementedException();

        public TransactionParams Params => throw new NotImplementedException();

        public int ReceiveTimeout { get; set; }
        public int SendTimeout { get; set; }

        public SIPSchemesEnum SIPScheme => throw new NotImplementedException();

        public bool Running => throw new NotImplementedException();

        public int CurrentCseq => throw new NotImplementedException();

        public int StartCseq { get => throw new NotImplementedException(); set => throw new NotImplementedException(); }

        public event ISIPTransaction.ConnectionLostDelegate? ConnectionLost;

        public async Task Start(CancellationToken? ct = null)
        {
        }

        public Task Stop()
        {
            throw new NotImplementedException();
        }

        public async Task Unregister()
        {
            this.Registered = false;
        }
    }
}
