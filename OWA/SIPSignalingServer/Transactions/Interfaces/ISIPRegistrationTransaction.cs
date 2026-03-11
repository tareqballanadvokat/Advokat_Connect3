namespace SIPSignalingServer.Transactions.Interfaces
{
    using Advokat.WebRTC.Library.SIP.Interfaces;
    using SIPSignalingServer.Utils.CustomEventArgs;

    public interface ISIPRegistrationTransaction : IServerSideSIPTransaction
    {
        public delegate Task RegistrationFailedDelegate(ISIPRegistrationTransaction sender, FailedRegistrationEventArgs e);

        public event RegistrationFailedDelegate? OnRegistrationFailed;

        public new ISIPDialogConfig Config { get; set; }

        public bool Registered { get; }
    }
}
