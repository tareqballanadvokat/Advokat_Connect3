using SIPSorcery.SIP;
using WebRTCClient.Transactions.SIP.Interfaces;
using Advokat.WebRTC.Library.SIP.Interfaces;
using Advokat.WebRTC.Library.SIP.Models;

namespace SIPClientTests.SIPConnectionTests.Mocks.Transactions
{
    internal class SIPRegistrationTransaction_Unregistering_Possible : ISIPRegistrationTransaction
    {
        public SIPRegistrationTransaction_Unregistering_Possible()
        {
        }

        public SIPRegistrationTransaction_Unregistering_Possible(TransactionParams transactionParams)
        {
            this.Params = transactionParams;
        }

        public TransactionParams PassedParams { get; }

        public TransactionParams PassedInCreated { get; set; }

        public bool Registered { get; set; } = true;

        public ISIPConnection Connection => throw new NotImplementedException();

        public TransactionParams Params { get; }

        public int SendTimeout { get; set; }

        public SIPSchemesEnum SIPScheme => throw new NotImplementedException();

        public bool Running => throw new NotImplementedException();

        public int CurrentCseq => 4;

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
            // Updates SIPDialogParams to the passed ones

            this.PassedInCreated.SourceParticipant.Name = this.Params.SourceParticipant.Name;
            this.PassedInCreated.SourceParticipant.Endpoint = this.Params.SourceParticipant.Endpoint;
            this.PassedInCreated.SourceTag = this.Params.SourceTag;

            this.PassedInCreated.RemoteParticipant.Name = this.Params.RemoteParticipant.Name;
            this.PassedInCreated.RemoteParticipant.Endpoint = this.Params.RemoteParticipant.Endpoint;
            this.PassedInCreated.RemoteTag = this.Params.RemoteTag;

            this.PassedInCreated.CallId = this.Params.CallId;
        }

        public async Task Stop()
        {
            this.Registered = false;
        }
    }
}
