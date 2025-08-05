using WebRTCLibrary.SIP.Interfaces;

namespace WebRTCClient.Transactions.SIP.Interfaces
{
    public interface ISIPClient : ISIPMessager
    {
        public SIPClientConfig Config { get; }
    }
}
