using WebRTCLibrary.SIP.Interfaces;

namespace WebRTCClient.Transactions.SIP.Interfaces
{
    public interface ISIPConnectionTransaction : ISIPTransaction, ISIPMessager
    {
        public bool Connected { get; }
    }
}
