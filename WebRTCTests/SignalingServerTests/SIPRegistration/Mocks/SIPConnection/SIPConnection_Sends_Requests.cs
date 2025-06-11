using Org.BouncyCastle.Asn1.Ocsp;
using SIPSorcery.SIP;
using System.Net.Sockets;
using WebRTCLibrary.SIP.Interfaces;
using WebRTCLibrary.SIP.Models;

namespace SignalingServerTests.SIPRegistration.Mocks.SIPConnection
{
    internal class SIPConnection_Sends_Requests : ISIPConnection
    {
        public List<(SIPMethodsEnum method, SIPHeaderParams headerParams)> SentRequests = [];
        public List<(SIPResponseStatusCodesEnum statusCode, SIPHeaderParams headerParams)> SentResponses = [];

        public int MessageTimeout { get => throw new NotImplementedException(); set => throw new NotImplementedException(); }
        public ISIPConnection.AcceptMessage? MessagePredicate { get => throw new NotImplementedException(); set => throw new NotImplementedException(); }

        public SIPSchemesEnum SIPScheme => SIPSchemesEnum.sip;

        public event SIPTransportResponseAsyncDelegate? SIPResponseReceived;
        public event SIPTransportRequestAsyncDelegate? SIPRequestReceived;

        public async Task<SocketError> SendSIPRequest(SIPMethodsEnum method, SIPHeaderParams headerParams, CancellationToken ct, int? timeOut = null)
        {
            this.SentRequests.Add((method, headerParams));
            return SocketError.Success;
        }

        public async Task<SocketError> SendSIPRequest(SIPMethodsEnum method, SIPHeaderParams headerParams, string message, string contentType, CancellationToken ct, int? timeOut = null)
        {
            this.SentRequests.Add((method, headerParams));
            return SocketError.Success;
        }

        public async Task<SocketError> SendSIPRequest(SIPRequest request, CancellationToken ct, int? timeOut = null)
        {
            this.SentRequests.Add((request.Method, null));
            return SocketError.Success;
        }

        public async Task<SocketError> SendSIPResponse(SIPResponseStatusCodesEnum statusCode, SIPHeaderParams headerParams, CancellationToken ct, int? timeOut = null)
        {
            this.SentResponses.Add((statusCode, headerParams));
            return SocketError.Success;
        }

        public async Task<SocketError> SendSIPResponse(SIPResponseStatusCodesEnum statusCode, SIPHeaderParams headerParams, string message, string contentType, CancellationToken ct, int? timeOut = null)
        {
            this.SentResponses.Add((statusCode, headerParams));
            return SocketError.Success;
        }

        public async Task<SocketError> SendSIPResponse(SIPResponse response, CancellationToken ct, int? timeOut = null)
        {
            SIPHeaderParams headerParams = new SIPHeaderParams(
                new SIPParticipant(response.Header.From.FromName, response.LocalSIPEndPoint),
                new SIPParticipant(response.Header.To.ToName, response.RemoteSIPEndPoint),
                response.Header.From.FromTag,
                response.Header.To.ToTag,
                response.Header.CSeq,
                response.Header.CallId);

            this.SentResponses.Add((response.Status, headerParams));
            return SocketError.Success;
        }
    }
}
