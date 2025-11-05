using SIPSorcery.SIP;
using WebRTCClient.Transactions.SIP.Interfaces;
using Advokat.WebRTC.Library.SIP.Interfaces;
using Advokat.WebRTC.Library.SIP.Models;

namespace SIPClientTests.SIPConnectionTests.Mocks.Transactions
{
    internal class SIPRegistrationTransaction_Unregistering_Possible : ISIPRegistrationTransaction
    {
        public bool Registered { get; set; } = true;

        public ISIPConnection Connection => throw new NotImplementedException();

        public TransactionParams Params => throw new NotImplementedException();

        public int SendTimeout { get; set; }

        public SIPSchemesEnum SIPScheme => throw new NotImplementedException();

        public bool Running => throw new NotImplementedException();

        public int CurrentCseq => 0;

        public int StartCseq { get => 4; set => throw new NotImplementedException(); }

        public ISIPConfig Config { get; set; }
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

        public async Task Stop()
        {
            this.Registered = false;
        }
    }
}
