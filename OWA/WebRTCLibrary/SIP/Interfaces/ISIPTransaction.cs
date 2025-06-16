using SIPSorcery.SIP;
using WebRTCLibrary.SIP.Models;

namespace WebRTCLibrary.SIP.Interfaces
{
    public interface ISIPTransaction
    {
        public ISIPConnection Connection { get; }

        public TransactionParams Params { get; }
        
        public int ReceiveTimeout { get; set; }
        
        public int SendTimeout { get; set; }
        
        public SIPSchemesEnum SIPScheme { get; }

        //public Task Start();
        
        public Task Start(CancellationToken? ct = null);
         
        public Task Stop();
    }
}