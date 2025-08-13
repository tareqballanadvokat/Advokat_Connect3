using SIPSorcery.SIP;
using WebRTCLibrary.SIP.Models;

namespace WebRTCLibrary.SIP.Interfaces
{
    public interface ISIPTransaction //: IAsyncDisposable
    {
        public ISIPConnection Connection { get; }

        public TransactionParams Params { get; }

        public ISIPConfig Config { get; set; }

        public bool Running { get; }

        public int StartCseq { get; set; }

        public int CurrentCseq { get; }

        public SIPSchemesEnum SIPScheme { get; }

        public delegate Task ConnectionLostDelegate(ISIPTransaction sender);

        public event ConnectionLostDelegate? ConnectionLost;

        public delegate Task TransactionStoppedDelegate(ISIPTransaction sender);

        public event TransactionStoppedDelegate? TransactionStopped;

        public Task Start(CancellationToken? ct = null);
        
        public Task Stop();
    }
}