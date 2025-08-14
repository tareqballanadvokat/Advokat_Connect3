using WebRTCClient.Configs.Interfaces;
using WebRTCLibrary.SIP.Interfaces;

namespace WebRTCClient.Transactions.SIP.Interfaces
{
    public interface ISIPClient : ISIPMessager, IAsyncDisposable
    {
        public ISIPClientConfig Config { get; }
    }
}
