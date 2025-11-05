using SIPSorcery.SIP;
using System.Net.Sockets;
using System.Net;
using Advokat.WebRTC.Library.SIP.Models;
using Advokat.WebRTC.Library.SIP.Interfaces;

namespace SIPClientTests.RegistrationTests.Mocks
{
    internal class SIPConnection_Sends_Multiple_2Accepted(int delay) : ISIPConnection
    {
        public List<(SIPMethodsEnum method, SIPHeaderParams headerParams)> SentRequests = [];

        public ISIPConnection.AcceptMessage? MessagePredicate { get => throw new NotImplementedException(); set => throw new NotImplementedException(); }

        public SIPSchemesEnum SIPScheme => throw new NotImplementedException();

        public ISIPTransport Transport => throw new NotImplementedException();

        public event SIPTransportResponseAsyncDelegate? SIPResponseReceived;
        public event SIPTransportRequestAsyncDelegate? SIPRequestReceived;

        public async Task<SocketError> SendSIPRequest(SIPMethodsEnum method, SIPHeaderParams headerParams, CancellationToken ct)
        {
            this.SentRequests.Add((method, headerParams));

            if (method == SIPMethodsEnum.REGISTER)
            {
                // runs in background thread
                _ = Task.Run(async () =>
                {
                    await this.SendAccepted();

                    await Task.Delay(delay);
                    await this.SendAccepted();
                });
            }

            return SocketError.Success;
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
