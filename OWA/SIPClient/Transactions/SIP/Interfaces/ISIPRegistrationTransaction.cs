using WebRTCLibrary.SIP.Interfaces;

namespace WebRTCClient.Transactions.SIP.Interfaces
{
    public interface ISIPRegistrationTransaction : ISIPTransaction
    {
        public bool Registered { get; }
    }
}
