using SIPSorcery.SIP;
using System.Net.Sockets;
using WebRTCLibrary.SIP.Interfaces;
using WebRTCLibrary.SIP.Models;

namespace SIPClientTests.RegistrationTests.Mocks
{
    public class SIPConnection_Does_Not_Send_Request : ISIPConnection
    {
        public List<(SIPMethodsEnum method, SIPHeaderParams headerParams)> SentRequests = [];

        public ISIPConnection.AcceptMessage? MessagePredicate { get => throw new NotImplementedException(); set => throw new NotImplementedException(); }

        public SIPSchemesEnum SIPScheme => throw new NotImplementedException();

        public ISIPTransport Transport => throw new NotImplementedException();

        public event SIPTransportResponseAsyncDelegate? SIPResponseReceived;
        public event SIPTransportRequestAsyncDelegate? SIPRequestReceived;

        public async Task<SocketError> SendSIPRequest(SIPMethodsEnum method, SIPHeaderParams headerParams, CancellationToken ct)
        {
            SentRequests.Add((method, headerParams));
            return SocketError.SocketError;
        }

        public Task<SocketError> SendSIPRequest(SIPMethodsEnum method, SIPHeaderParams headerParams, string message, string contentType, CancellationToken ct)
        {
            throw new NotImplementedException();
        }

        public Task<SocketError> SendSIPRequest(SIPRequest request, CancellationToken ct)
        {
            throw new NotImplementedException();
        }

        public Task<SocketError> SendSIPResponse(SIPResponseStatusCodesEnum statusCode, SIPHeaderParams headerParams, CancellationToken ct)
        {
            throw new NotImplementedException();
        }

        public Task<SocketError> SendSIPResponse(SIPResponseStatusCodesEnum statusCode, SIPHeaderParams headerParams, string message, string contentType, CancellationToken ct)
        {
            throw new NotImplementedException();
        }

        public Task<SocketError> SendSIPResponse(SIPResponse response, CancellationToken ct)
        {
            throw new NotImplementedException();
        }
    }
}
