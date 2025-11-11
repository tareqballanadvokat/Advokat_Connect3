using Advokat.WebRTC.Library.SIP.Interfaces;
using Advokat.WebRTC.Library.SIP.Models;
using SIPSorcery.SIP;
using System.Net.Sockets;

namespace SIPClientTests.SIPConnectionTests.Mocks.SIPTransport
{
    internal class SIPTransport_Does_Not_Send_6Notify : ISIPTransport
    {
        public List<SIPRequest> SentRequests { get; private set; } = [];
        public List<SIPResponse> SentResponses { get; private set; } = [];

        public event SIPTransportRequestAsyncDelegate SIPTransportRequestReceived;
        public event SIPTransportResponseAsyncDelegate SIPTransportResponseReceived;

        public void AddSIPChannel(SIPChannel sIPChannel)
        {
            throw new NotImplementedException();
        }

        public void Dispose()
        {
            throw new NotImplementedException();
        }

        public async Task<SocketError> SendRequestAsync(SIPRequest request, bool waitForDns = false)
        {
            this.SentRequests.Add(request);
            return SocketError.Success;
        }

        public async Task<SocketError> SendResponseAsync(SIPResponse response, bool waitForDns = false)
        {
            this.SentResponses.Add(response);
            return SocketError.Success;
        }

        public async Task Send4Notify(TransactionParams transactionParams)
        {
            SIPURI remoteUri = new SIPURI(SIPSchemesEnum.sip, transactionParams.RemoteParticipant.Endpoint);
            SIPURI callerUri = new SIPURI(SIPSchemesEnum.sip, transactionParams.SourceParticipant.Endpoint);

            SIPRequest notify4Request = new SIPRequest(SIPMethodsEnum.NOTIFY, callerUri);

            notify4Request.Header = new SIPHeader();
            notify4Request.Header.CSeq = 4;

            notify4Request.Header.From = new SIPFromHeader(transactionParams.RemoteParticipant.Name, remoteUri, transactionParams.RemoteTag);
            notify4Request.Header.To = new SIPToHeader(transactionParams.SourceParticipant.Name, callerUri, transactionParams.SourceTag);
            notify4Request.Header.CallId = transactionParams.CallId;

            await (this.SIPTransportRequestReceived?.Invoke(transactionParams.SourceParticipant.Endpoint, transactionParams.RemoteParticipant.Endpoint, notify4Request) ?? Task.CompletedTask);
        }
    }
}
