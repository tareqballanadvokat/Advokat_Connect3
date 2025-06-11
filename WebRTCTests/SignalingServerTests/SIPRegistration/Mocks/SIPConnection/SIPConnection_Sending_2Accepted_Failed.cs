using SIPSorcery.SIP;
using System.Net.Sockets;
using WebRTCLibrary.SIP.Interfaces;
using WebRTCLibrary.SIP.Models;

namespace SignalingServerTests.SIPRegistration.Mocks.SIPConnection
{
    internal class SIPConnection_Sending_2Accepted_Failed : ISIPConnection
    {
        public List<(SIPMethodsEnum method, SIPHeaderParams headerParams)> SentRequests = [];
        public List<(SIPResponseStatusCodesEnum statusCode, SIPHeaderParams headerParams)> SentResponses = [];
        public List<(SIPResponseStatusCodesEnum statusCode, SIPHeaderParams headerParams)> FailedResponses = [];

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

        public Task<SocketError> SendSIPRequest(SIPMethodsEnum method, SIPHeaderParams headerParams, string message, string contentType, CancellationToken ct, int? timeOut = null)
        {
            throw new NotImplementedException();
        }

        public Task<SocketError> SendSIPRequest(SIPRequest request, CancellationToken ct, int? timeOut = null)
        {
            throw new NotImplementedException();
        }

        public async Task<SocketError> SendSIPResponse(SIPResponseStatusCodesEnum statusCode, SIPHeaderParams headerParams, CancellationToken ct, int? timeOut = null)
        {
            if (statusCode == SIPResponseStatusCodesEnum.Accepted)
            {
                this.FailedResponses.Add((statusCode, headerParams));
                return SocketError.NotConnected;
            }
            
            this.SentResponses.Add((statusCode, headerParams));
            return SocketError.Success;
        }

        public async Task<SocketError> SendSIPResponse(SIPResponseStatusCodesEnum statusCode, SIPHeaderParams headerParams, string message, string contentType, CancellationToken ct, int? timeOut = null)
        {
            if (statusCode == SIPResponseStatusCodesEnum.Accepted)
            {
                this.FailedResponses.Add((statusCode, headerParams));
                return SocketError.NotConnected;
            }

            this.SentResponses.Add((statusCode, headerParams));
            return SocketError.Success;
        }

        public async Task<SocketError> SendSIPResponse(SIPResponse response, CancellationToken ct, int? timeOut = null)
        {
            if (response.Status == SIPResponseStatusCodesEnum.Accepted)
            {
                this.FailedResponses.Add((response.Status, null));
                return SocketError.NotConnected;
            }

            this.SentResponses.Add((response.Status, null));
            return SocketError.Success;
        }
    }
}
