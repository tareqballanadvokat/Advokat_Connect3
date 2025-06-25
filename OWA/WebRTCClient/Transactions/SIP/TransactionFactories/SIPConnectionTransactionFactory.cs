using Microsoft.Extensions.Logging;
using SIPSorcery.SIP;
using WebRTCClient.Transactions.SIP.Interfaces;
using WebRTCClient.Transactions.SIP.Interfaces.TransactionFactories;
using WebRTCLibrary.SIP.Interfaces;
using WebRTCLibrary.SIP.Models;

namespace WebRTCClient.Transactions.SIP.TransactionFactories
{
    internal class SIPConnectionTransactionFactory(ILoggerFactory loggerFactory) : ISIPConnectionTransactionFactory
    {
        public ISIPConnectionTransaction Create(SIPSchemesEnum sipScheme, ISIPTransport transport, TransactionParams transactionParams)
        {
            return new SIPConnectionTransaction(sipScheme, transport, transactionParams, loggerFactory);
        }
    }
}
