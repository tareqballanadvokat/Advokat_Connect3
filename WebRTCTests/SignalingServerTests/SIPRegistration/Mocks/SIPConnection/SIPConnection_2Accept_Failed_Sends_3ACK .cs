using SIPSorcery.SIP;
using System.Net;
using System.Net.Sockets;
using Advokat.WebRTC.Library.SIP.Interfaces;
using Advokat.WebRTC.Library.SIP.Models;
using Advokat.WebRTC.Library.SIP.Utils;

namespace SignalingServerTests.SIPRegistration.Mocks.SIPConnection
{
    internal class SIPConnection_2Accept_Failed_Sends_3ACK : ISIPConnection
    {
        public List<(SIPMethodsEnum method, SIPHeaderParams headerParams)> SentRequests = [];

        public List<(SIPResponseStatusCodesEnum statusCode, SIPHeaderParams headerParams)> SentResponses = [];
        public List<(SIPResponseStatusCodesEnum statusCode, SIPHeaderParams headerParams)> FailedResponses = [];

        public ISIPConnection.AcceptMessage? MessagePredicate { get => throw new NotImplementedException(); set => throw new NotImplementedException(); }

        public SIPSchemesEnum SIPScheme => SIPSchemesEnum.sip;

        public ISIPTransport Transport => throw new NotImplementedException();

        public event SIPTransportResponseAsyncDelegate? SIPResponseReceived;
        public event SIPTransportRequestAsyncDelegate? SIPRequestReceived;

        private async Task SendACK(SIPHeaderParams headerParams)
        {
            SIPEndPoint sIPEndPoint = new SIPEndPoint(new IPEndPoint(IPAddress.Parse("1.1.1.1"), 1));
            SIPRequest request = SIPHelper.GetRequest(this.SIPScheme, SIPMethodsEnum.ACK, headerParams);

            this.SIPRequestReceived?.Invoke(sIPEndPoint, sIPEndPoint, request);
        }

        public async Task<SocketError> SendSIPRequest(SIPMethodsEnum method, SIPHeaderParams headerParams, CancellationToken ct)
        {
            this.SentRequests.Add((method, headerParams));
            
            return SocketError.Success;
        }

        public Task<SocketError> SendSIPRequest(SIPMethodsEnum method, SIPHeaderParams headerParams, string message, string contentType, CancellationToken ct)
        {
            throw new NotImplementedException();
        }

        public Task<SocketError> SendSIPRequest(SIPRequest request, CancellationToken ct)
        {
            throw new NotImplementedException();
        }

        public async Task<SocketError> SendSIPResponse(SIPResponseStatusCodesEnum statusCode, SIPHeaderParams headerParams, CancellationToken ct)
        {
            if (statusCode == SIPResponseStatusCodesEnum.Accepted)
            {
                this.FailedResponses.Add((statusCode, headerParams));

                _ = Task.Run(async () => await this.SendACK(headerParams));

                return SocketError.NotConnected;
            }

            this.SentResponses.Add((statusCode, headerParams));
            return SocketError.Success;
        }

        public async Task<SocketError> SendSIPResponse(SIPResponseStatusCodesEnum statusCode, SIPHeaderParams headerParams, string message, string contentType, CancellationToken ct)
        {
            if (statusCode == SIPResponseStatusCodesEnum.Accepted)
            {
                //this.FailedResponses.Add((statusCode, headerParams));

                //_ = Task.Run(async () => await this.SendACK(headerParams));

                return SocketError.NotConnected;
            }

            this.SentResponses.Add((statusCode, headerParams));
            return SocketError.Success;
        }

        public async Task<SocketError> SendSIPResponse(SIPResponse response, CancellationToken ct)
        {
            SIPEndPoint sipEndPoint = new SIPEndPoint(new IPEndPoint(IPAddress.Parse("1.1.1.1"), 1));

            // This is the worst case: 2 - Accepted Response does not get sent but the client has the info for the connection somehow
            SIPHeaderParams reverseHeaderParams = new SIPHeaderParams(
                new SIPParticipant(response.Header.From.FromName, sipEndPoint),
                new SIPParticipant(response.Header.To.ToName, sipEndPoint),
                response.Header.From.FromTag,
                response.Header.To.ToTag,
                3,
                response.Header.CallId
               );


            if (response.Status == SIPResponseStatusCodesEnum.Accepted)
            {
                this.FailedResponses.Add((response.Status, null));

                _ = Task.Run(async () => await this.SendACK(reverseHeaderParams));

                return SocketError.NotConnected;
            }

            this.SentResponses.Add((response.Status, null));
            return SocketError.Success;
        }
    }
}
