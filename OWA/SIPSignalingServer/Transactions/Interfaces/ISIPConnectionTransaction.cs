using SIPSignalingServer.Utils.CustomEventArgs;

namespace SIPSignalingServer.Transactions.Interfaces
{
    public interface ISIPConnectionTransaction : IServerSideSIPTransaction
    {
        public bool Connected { get; }

        public delegate Task ConnectionFailedDelegate(ISIPConnectionTransaction sender, FailureEventArgs e);

        public event ConnectionFailedDelegate? OnConnectionFailed;
    }
}
