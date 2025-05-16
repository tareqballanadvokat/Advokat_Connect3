using SIPSorcery.SIP;
using System.Net;
using System.Net.Sockets;
using WebRTCLibrary.Interfaces;
using WebRTCLibrary.SIP.Models;

namespace SIPClientTests.RegistrationTests.Mocks
{
    internal class SIPConnection_Responds_With_2_BYE : ISIPConnection
    {
        public int RequestsSent = 0;

        public int MessageTimeout { get; set; }
        public ISIPConnection.AcceptMessage? MessagePredicate { get => throw new NotImplementedException(); set => throw new NotImplementedException(); }

        public SIPSchemesEnum SIPScheme => throw new NotImplementedException();

        public event SIPTransportResponseAsyncDelegate? SIPResponseReceived;
        public event SIPTransportRequestAsyncDelegate? SIPRequestReceived;

        public async Task<SocketError> SendSIPRequest(SIPMethodsEnum method, SIPHeaderParams headerParams, CancellationToken ct, int? timeOut = null)
        {
            this.RequestsSent++;

            SIPEndPoint sIPEndPoint = new SIPEndPoint(new IPEndPoint(IPAddress.Parse("1.1.1.1"), 1));

            SIPRequest request = new SIPRequest(SIPMethodsEnum.BYE, "sip:1.1.1.1");
            request.Header = new SIPHeader();
            request.Header.CSeq = 2;

            this.SIPRequestReceived?.Invoke(sIPEndPoint, sIPEndPoint, request);
            return SocketError.Success;
            //throw new NotImplementedException();
        }

        public  Task<SocketError> SendSIPRequest(SIPMethodsEnum method, SIPHeaderParams headerParams, string message, string contentType, CancellationToken ct, int? timeOut = null)
        {
            throw new NotImplementedException();
        }

        public Task<SocketError> SendSIPRequest(SIPRequest request, CancellationToken ct, int? timeOut = null)
        {
            throw new NotImplementedException();
        }

        public Task<SocketError> SendSIPResponse(SIPResponseStatusCodesEnum statusCode, SIPHeaderParams headerParams, CancellationToken ct, int? timeOut = null)
        {
            throw new NotImplementedException();
        }

        public Task<SocketError> SendSIPResponse(SIPResponseStatusCodesEnum statusCode, SIPHeaderParams headerParams, string message, string contentType, CancellationToken ct, int? timeOut = null)
        {
            throw new NotImplementedException();
        }

        public Task<SocketError> SendSIPResponse(SIPResponse response, CancellationToken ct, int? timeOut = null)
        {
            throw new NotImplementedException();
        }
    }
}
