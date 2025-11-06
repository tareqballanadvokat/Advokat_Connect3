using SIPSorcery.SIP;
using System.Net.Sockets;
using System.Net;
using Advokat.WebRTC.Library.SIP.Models;
using Advokat.WebRTC.Library.SIP.Interfaces;

namespace SIPClientTests.RegistrationTests.Mocks
{
    internal class SIPConnection_Responds_With_2Bye_And_2Accept : ISIPConnection
    {
        public int RequestsSent = 0;

        public ISIPConnection.AcceptMessage? MessagePredicate { get => throw new NotImplementedException(); set => throw new NotImplementedException(); }

        public SIPSchemesEnum SIPScheme => throw new NotImplementedException();

        public ISIPTransport Transport => throw new NotImplementedException();

        public event SIPTransportResponseAsyncDelegate? SIPResponseReceived;
        public event SIPTransportRequestAsyncDelegate? SIPRequestReceived;

        public async Task<SocketError> SendSIPRequest(SIPMethodsEnum method, SIPHeaderParams headerParams, CancellationToken ct)
        {
            ct.ThrowIfCancellationRequested();

            this.RequestsSent++;

            SIPEndPoint sIPEndPoint = new SIPEndPoint(new IPEndPoint(IPAddress.Parse("1.1.1.1"), 1));

            SIPRequest request = new SIPRequest(SIPMethodsEnum.BYE, "sip:1.1.1.1");
            request.Header = new SIPHeader();
            request.Header.CSeq = 2;

            this.SIPRequestReceived?.Invoke(sIPEndPoint, sIPEndPoint, request);

            if (method == SIPMethodsEnum.REGISTER)
            {
                await this.SendAccepted();
            }

            return SocketError.Success;
            //throw new NotImplementedException();
        }

        private async Task SendAccepted()
        {
            SIPEndPoint sIPEndPoint = new SIPEndPoint(new IPEndPoint(IPAddress.Parse("1.1.1.1"), 1));

            SIPURI mySIPUri = new SIPURI(SIPSchemesEnum.sip, sIPEndPoint);

            SIPResponse response = new SIPResponse(SIPResponseStatusCodesEnum.Accepted, string.Empty);
            response.Header = new SIPHeader();
            response.Header.CSeq = 2;
            response.Header.From = new SIPFromHeader(string.Empty, mySIPUri, "fromTag-abcdefg");

            this.SIPResponseReceived?.Invoke(sIPEndPoint, sIPEndPoint, response);
        }

        public async Task<SocketError> SendSIPRequest(SIPMethodsEnum method, SIPHeaderParams headerParams, string message, string contentType, CancellationToken ct)
        {
            return await this.SendSIPRequest(method, headerParams, ct);
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
