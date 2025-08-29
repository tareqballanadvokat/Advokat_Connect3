using SIPSignalingServer.Utils.CustomEventArgs;
using WebRTCLibrary.SIP.Interfaces;

namespace SIPSignalingServer.Transactions.Interfaces
{
    public interface ISIPRegistrationTransaction : IServerSideSIPTransaction
    {
        public delegate Task RegistrationFailedDelegate(ISIPRegistrationTransaction sender, FailedRegistrationEventArgs e);

        public event RegistrationFailedDelegate? OnRegistrationFailed;

        public new ISIPDialogConfig Config {  get; set; }

        public bool Registered { get; }

        public Task Unregister();
    }
}
