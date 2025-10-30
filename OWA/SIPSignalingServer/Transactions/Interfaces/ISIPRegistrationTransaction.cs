using Advokat.WebRTC.Library.SIP.Interfaces;
using SIPSignalingServer.Utils.CustomEventArgs;

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
