using SIPSorcery.SIP;
using System.Net;
using System.Net.Sockets;
using WebRTCLibrary.SIP.Interfaces;
using WebRTCLibrary.SIP.Models;
using WebRTCLibrary.SIP.Utils;

namespace SignalingServerTests.SIPConnection.Mocks.SIPTransport
{
    internal class SIPTransport_Registration_And_Connection_Working : ISIPTransport
    {
        public List<SIPRequest> SentRequests { get; set; } = [];

        public List<SIPResponse> SentResponses { get; set; } = [];


        public event SIPTransportRequestAsyncDelegate SIPTransportRequestReceived;
        public event SIPTransportResponseAsyncDelegate SIPTransportResponseReceived;

        public void AddSIPChannel(SIPChannel sIPChannel)
        {
            throw new NotImplementedException();
        }

        public async Task<SocketError> SendRequestAsync(SIPRequest request, bool waitForDns = false)
        {
            this.SentRequests.Add(request);

            if (request.Method == SIPMethodsEnum.NOTIFY)
            {
                if (request.Header.CSeq == 4)
                {
                    await this.Send5ACK(request);
                }
            }

            return SocketError.Success;
        }

        public async Task<SocketError> SendResponseAsync(SIPResponse response, bool waitForDns = false)
        {
            this.SentResponses.Add(response);

            if (response.Status == SIPResponseStatusCodesEnum.Accepted)
            {
                await this.Send3ACK(response);
            }

            return SocketError.Success;
        }

        private async Task Send3ACK(SIPResponse AcceptedResponse)
        {
            SIPEndPoint sipEndPoint = new SIPEndPoint(new IPEndPoint(IPAddress.Parse("1.1.1.1"), 1));

            SIPHeaderParams reverseHeaderParams = new SIPHeaderParams(
                new SIPParticipant(AcceptedResponse.Header.From.FromName, sipEndPoint),
                new SIPParticipant(AcceptedResponse.Header.To.ToName, sipEndPoint),
                AcceptedResponse.Header.To.ToTag,
                AcceptedResponse.Header.From.FromTag,
                3,
                AcceptedResponse.Header.CallId
               );

            SIPRequest ackRequest = SIPHelper.GetRequest(SIPSchemesEnum.sip, SIPMethodsEnum.ACK, reverseHeaderParams);
            this.SIPTransportRequestReceived?.Invoke(sipEndPoint, sipEndPoint, ackRequest);
        }

        private async Task Send5ACK(SIPRequest request)
        {
            SIPEndPoint sipEndPoint = new SIPEndPoint(new IPEndPoint(IPAddress.Parse("1.1.1.1"), 1));

            SIPHeaderParams reverseHeaderParams = new SIPHeaderParams(
                new SIPParticipant(request.Header.From.FromName, sipEndPoint),
                new SIPParticipant(request.Header.To.ToName, sipEndPoint),
                request.Header.To.ToTag,
                request.Header.From.FromTag,
                5,
                request.Header.CallId
               );


            SIPRequest ackRequest = SIPHelper.GetRequest(SIPSchemesEnum.sip, SIPMethodsEnum.ACK, reverseHeaderParams);
            this.SIPTransportRequestReceived?.Invoke(sipEndPoint, sipEndPoint, ackRequest);
        }
    }
}
