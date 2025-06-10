using SIPSignalingServer.Utils.CustomEventArgs;
using WebRTCLibrary.SIP.Interfaces;

namespace SIPSignalingServer.Transactions.Interfaces
{
    public interface ISIPRegistrationTransaction : IServerSideSIPTransaction
    {
        public delegate Task RegistrationFailedDelegate(ISIPRegistrationTransaction sender, FailedRegistrationEventArgs e);

        public event RegistrationFailedDelegate? OnRegistrationFailed;

        public bool Registered { get; }

        public Task Unregister(int cSeq);
    }
}
