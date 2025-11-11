using Advokat.WebRTC.Library.SIP.Interfaces;
using Advokat.WebRTC.Library.SIP.Models;
using SIPSorcery.SIP;
using System.Net.Sockets;

namespace SIPClientTests.SIPConnectionTests.Mocks.SIPTransport
{
    internal class SIPTransport_Can_Send_ConnectionBye_And_Notifies : ISIPTransport
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

        public async Task SendBye(TransactionParams connectionParams, int Cseq)
        {
            SIPURI remoteUri = new SIPURI(SIPSchemesEnum.sip, connectionParams.RemoteParticipant.Endpoint);
            SIPURI callerUri = new SIPURI(SIPSchemesEnum.sip, connectionParams.SourceParticipant.Endpoint);

            SIPRequest notify4Request = new SIPRequest(SIPMethodsEnum.BYE, callerUri);

            notify4Request.Header = new SIPHeader();
            notify4Request.Header.CSeq = Cseq;

            notify4Request.Header.From = new SIPFromHeader(connectionParams.RemoteParticipant.Name, remoteUri, connectionParams.RemoteTag);
            notify4Request.Header.To = new SIPToHeader(connectionParams.SourceParticipant.Name, callerUri, connectionParams.SourceTag);
            notify4Request.Header.CallId = connectionParams.CallId;

            await (this.SIPTransportRequestReceived?.Invoke(connectionParams.SourceParticipant.Endpoint, connectionParams.RemoteParticipant.Endpoint, notify4Request) ?? Task.CompletedTask);
        }

        public async Task SendNotify(TransactionParams connectionParams, int Cseq)
        {
            SIPURI remoteUri = new SIPURI(SIPSchemesEnum.sip, connectionParams.RemoteParticipant.Endpoint);
            SIPURI callerUri = new SIPURI(SIPSchemesEnum.sip, connectionParams.SourceParticipant.Endpoint);

            SIPRequest notify4Request = new SIPRequest(SIPMethodsEnum.NOTIFY, callerUri);

            notify4Request.Header = new SIPHeader();
            notify4Request.Header.CSeq = Cseq;

            notify4Request.Header.From = new SIPFromHeader(connectionParams.RemoteParticipant.Name, remoteUri, connectionParams.RemoteTag);
            notify4Request.Header.To = new SIPToHeader(connectionParams.SourceParticipant.Name, callerUri, connectionParams.SourceTag);
            notify4Request.Header.CallId = connectionParams.CallId;

            await (this.SIPTransportRequestReceived?.Invoke(connectionParams.SourceParticipant.Endpoint, connectionParams.RemoteParticipant.Endpoint, notify4Request) ?? Task.CompletedTask);
        }
    }
}
