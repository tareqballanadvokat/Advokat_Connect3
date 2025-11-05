using SIPSorcery.SIP;
using WebRTCClient.Transactions.SIP.Interfaces;
using Advokat.WebRTC.Library.SIP.Interfaces;
using Advokat.WebRTC.Library.SIP.Models;

namespace SIPClientTests.SIPConnectionTests.Mocks.Transactions
{
    internal class SIPRegistrationTransaction_Is_Registered : ISIPRegistrationTransaction
    {
        public bool Registered => true;

        public ISIPConnection Connection => throw new NotImplementedException();

        public TransactionParams Params => throw new NotImplementedException();

        public SIPSchemesEnum SIPScheme => throw new NotImplementedException();

        public bool Running => throw new NotImplementedException();

        public int CurrentCseq => throw new NotImplementedException();

        public int StartCseq { get => throw new NotImplementedException(); set => throw new NotImplementedException(); }
        public ISIPConfig Config { get => throw new NotImplementedException(); set => throw new NotImplementedException(); }
        ISIPDialogConfig ISIPRegistrationTransaction.Config { get => throw new NotImplementedException(); set => Config = value; }

        public event ISIPTransaction.ConnectionLostDelegate? ConnectionLost;
        public event ISIPTransaction.TransactionStoppedDelegate? TransactionStopped;

        public ValueTask DisposeAsync()
        {
            throw new NotImplementedException();
        }

        public async Task Start(CancellationToken? ct = null)
        {
        }

        public Task Stop()
        {
            throw new NotImplementedException();
        }

        public Task Unregister()
        {
            throw new NotImplementedException();
        }
    }
}
