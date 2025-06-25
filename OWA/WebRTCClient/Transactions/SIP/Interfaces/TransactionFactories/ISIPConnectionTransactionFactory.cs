using SIPSorcery.SIP;
using WebRTCLibrary.SIP.Interfaces;
using WebRTCLibrary.SIP.Models;

namespace WebRTCClient.Transactions.SIP.Interfaces.TransactionFactories
{
    public interface ISIPConnectionTransactionFactory
    {
        public ISIPConnectionTransaction Create(SIPSchemesEnum sipScheme, ISIPTransport transport, TransactionParams transactionParams);
    }
}
