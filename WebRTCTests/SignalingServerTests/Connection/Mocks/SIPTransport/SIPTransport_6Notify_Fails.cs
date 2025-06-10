using SIPSorcery.SIP;
using System.Net;
using System.Net.Sockets;
using WebRTCLibrary.SIP.Interfaces;

namespace SignalingServerTests.Connection.Mocks.SIPTransport
{
    internal class SIPTransport_6Notify_Fails : ISIPTransport
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
                    await this.Send5AckAfterTimeout(request);
                }

                if (request.Header.CSeq == 6)
                {
                    return SocketError.AccessDenied;
                }
            }

            return SocketError.Success;
        }

        private async Task Send5AckAfterTimeout(SIPRequest request)
        {
            SIPEndPoint sipEndPoint = new SIPEndPoint(IPEndPoint.Parse("1.1.1.1:1"));
            SIPURI uri = new SIPURI(SIPSchemesEnum.sip, sipEndPoint);

            SIPRequest AckRequest = new SIPRequest(SIPMethodsEnum.ACK, uri)
            {
                Header = new SIPHeader(
                    new SIPFromHeader(request.Header.To.ToName, uri, request.Header.To.ToTag),
                    new SIPToHeader(request.Header.From.FromName, uri, request.Header.From.FromTag),
                    callId: request.Header.CallId,
                    cseq: 5)
            };

            await (this.SIPTransportRequestReceived?.Invoke(sipEndPoint, sipEndPoint, AckRequest) ?? Task.CompletedTask);
        }

        public async Task<SocketError> SendResponseAsync(SIPResponse response, bool waitForDns = false)
        {
            this.SentResponses.Add(response);

            if (response.Status == SIPResponseStatusCodesEnum.Accepted)
            {
                await this.Send3Ack(response);
            }

            return SocketError.Success;
        }

        private async Task Send3Ack(SIPResponse response)
        {
            SIPEndPoint sipEndPoint = new SIPEndPoint(IPEndPoint.Parse("1.1.1.1:1"));
            SIPURI uri = new SIPURI(SIPSchemesEnum.sip, sipEndPoint);

            SIPRequest AckRequest = new SIPRequest(SIPMethodsEnum.ACK, uri)
            {
                Header = new SIPHeader(
                    new SIPFromHeader(response.Header.To.ToName, uri, response.Header.To.ToTag),
                    new SIPToHeader(response.Header.From.FromName, uri, response.Header.From.FromTag),
                    callId: response.Header.CallId,
                    cseq: 3)
            };

            await (this.SIPTransportRequestReceived?.Invoke(sipEndPoint, sipEndPoint, AckRequest) ?? Task.CompletedTask);
        }
    }
}