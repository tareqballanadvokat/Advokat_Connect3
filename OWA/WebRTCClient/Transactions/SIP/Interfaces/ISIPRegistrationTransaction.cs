using WebRTCLibrary.SIP.Interfaces;

namespace WebRTCClient.Transactions.SIP.Interfaces
{
    public interface ISIPRegistrationTransaction : ISIPTransaction
    {
        new ISIPDialogConfig Config { get; set; }

        public bool Registered { get; }
    }
}
