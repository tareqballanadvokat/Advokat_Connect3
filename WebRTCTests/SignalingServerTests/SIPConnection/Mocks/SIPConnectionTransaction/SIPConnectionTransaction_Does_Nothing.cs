using SIPSignalingServer.Models;
using SIPSignalingServer.Transactions.Interfaces;
using SIPSorcery.SIP;
using WebRTCLibrary.SIP.Interfaces;
using WebRTCLibrary.SIP.Models;

namespace SignalingServerTests.SIPConnection.Mocks.SIPConnectionTransaction
{
    internal class SIPConnectionTransaction_Does_Nothing : ISIPConnectionTransaction
    {
        public bool Connected => throw new NotImplementedException();

        public ServerSideTransactionParams Params => throw new NotImplementedException();

        public ISIPConnection Connection => throw new NotImplementedException();

        public int ReceiveTimeout { get => throw new NotImplementedException(); set => throw new NotImplementedException(); }
        public int SendTimeout { get => throw new NotImplementedException(); set => throw new NotImplementedException(); }

        public bool Running => throw new NotImplementedException();

        public int StartCseq { get => throw new NotImplementedException(); set => throw new NotImplementedException(); }

        public int CurrentCseq => throw new NotImplementedException();

        public SIPSchemesEnum SIPScheme => throw new NotImplementedException();

        TransactionParams ISIPTransaction.Params => Params;

        public event ISIPConnectionTransaction.ConnectionFailedDelegate? OnConnectionFailed;
        public event ISIPTransaction.ConnectionLostDelegate? ConnectionLost;

        public List<DateTime> Started = [];

        public List<DateTime> Stopped = [];

        public async Task Start(CancellationToken? ct = null)
        {


            this.Started.Add(DateTime.Now);
        }

        public async Task Stop()
        {
            this.Stopped.Add(DateTime.Now);
        }
    }
}
