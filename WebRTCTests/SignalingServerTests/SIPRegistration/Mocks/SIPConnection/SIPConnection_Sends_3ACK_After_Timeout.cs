using SIPSorcery.SIP;
using System.Net;
using System.Net.Sockets;
using WebRTCLibrary.SIP.Interfaces;
using WebRTCLibrary.SIP.Models;
using WebRTCLibrary.SIP.Utils;

namespace SignalingServerTests.SIPRegistration.Mocks.SIPConnection
{
    internal class SIPConnection_Sends_3ACK_After_Timeout(int receiveTimeout, int delay) : ISIPConnection
    {
        public int MessageTimeout { get => throw new NotImplementedException(); set => throw new NotImplementedException(); }
        public ISIPConnection.AcceptMessage? MessagePredicate { get => throw new NotImplementedException(); set => throw new NotImplementedException(); }

        public SIPSchemesEnum SIPScheme => SIPSchemesEnum.sip;

        public event SIPTransportResponseAsyncDelegate? SIPResponseReceived;
        public event SIPTransportRequestAsyncDelegate? SIPRequestReceived;

        public async Task<SocketError> SendSIPRequest(SIPMethodsEnum method, SIPHeaderParams headerParams, CancellationToken ct, int? timeOut = null)
        {
            throw new NotImplementedException();
        }

        public async Task<SocketError> SendSIPRequest(SIPMethodsEnum method, SIPHeaderParams headerParams, string message, string contentType, CancellationToken ct, int? timeOut = null)
        {
            throw new NotImplementedException();
        }

        public async Task<SocketError> SendSIPRequest(SIPRequest request, CancellationToken ct, int? timeOut = null)
        {
            return SocketError.Success;
        }

        public Task<SocketError> SendSIPResponse(SIPResponseStatusCodesEnum statusCode, SIPHeaderParams headerParams, CancellationToken ct, int? timeOut = null)
        {
            throw new NotImplementedException();
        }

        public Task<SocketError> SendSIPResponse(SIPResponseStatusCodesEnum statusCode, SIPHeaderParams headerParams, string message, string contentType, CancellationToken ct, int? timeOut = null)
        {
            throw new NotImplementedException();
        }

        public async Task<SocketError> SendSIPResponse(SIPResponse response, CancellationToken ct, int? timeOut = null)
        {
            if (response.Status == SIPResponseStatusCodesEnum.Accepted)
            {
                // runs in background thread
                _ = Task.Run(async () =>
                {
                    await Task.Delay(receiveTimeout + delay);
                    await this.SendACK(response);
                });
            }

            return SocketError.Success;
        }

        private async Task SendACK(SIPResponse AcceptedResponse)
        {
            SIPEndPoint sipEndPoint = new SIPEndPoint(new IPEndPoint(IPAddress.Parse("1.1.1.1"), 1));
            
            SIPHeaderParams reverseHeaderParams = new SIPHeaderParams(
                new SIPParticipant(AcceptedResponse.Header.From.FromName, sipEndPoint),
                new SIPParticipant(AcceptedResponse.Header.To.ToName, sipEndPoint),
                AcceptedResponse.Header.From.FromTag,
                AcceptedResponse.Header.To.ToTag,
                3,
                AcceptedResponse.Header.CallId
               );


            //SIPURI mySIPUri = new SIPURI(SIPSchemesEnum.sip, sipEndPoint);
            SIPRequest ackRequest = SIPHelper.GetRequest(SIPSchemesEnum.sip, SIPMethodsEnum.ACK, reverseHeaderParams);

            ////SIPResponse response = new SIPResponse(SIPResponseStatusCodesEnum.Accepted, string.Empty);
            //AcceptedResponse.Header = new SIPHeader();
            //AcceptedResponse.Header.CSeq = 3;

            this.SIPRequestReceived?.Invoke(sipEndPoint, sipEndPoint, ackRequest);
        }
    }
}
