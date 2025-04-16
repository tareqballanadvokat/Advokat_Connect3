using SIPSignalingServer.Models;
using SIPSorcery.SIP;
using WebRTCLibrary.SIP;

namespace SIPSignalingServer.Transactions
{
    internal abstract class ServerSideSIPTransaction : WebRTCLibrary.SIP.SIPTransaction
    {
        public new ServerSideTransactionParams Params
        { 
            get => (ServerSideTransactionParams)base.Params;
            set => base.Params = value;
        }

        public ServerSideSIPTransaction(SIPSchemesEnum sipScheme, SIPTransport transport, ServerSideTransactionParams transactionParams)
            : base(sipScheme, transport, transactionParams)
        {
        }

        public ServerSideSIPTransaction(SIPConnection connection, ServerSideTransactionParams transactionParams)
            : base(connection, transactionParams)
        {
        }
    }
}
