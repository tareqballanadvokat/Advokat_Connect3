using SIPSorcery.SIP;
using System.Net.Sockets;
using WebRTCLibrary.SIP.Models;

namespace WebRTCLibrary.SIP.Interfaces
{
    public interface ISIPConnection
    {
        public event SIPTransportResponseAsyncDelegate? SIPResponseReceived;

        public event SIPTransportRequestAsyncDelegate? SIPRequestReceived;

        //public int MessageTimeout { get; set; }

        public delegate bool AcceptMessage(SIPMessageBase message);

        public AcceptMessage? MessagePredicate { get; set; }

        public SIPSchemesEnum SIPScheme { get; }

        public Task<SocketError> SendSIPRequest(SIPMethodsEnum method, SIPHeaderParams headerParams, CancellationToken ct);

        public Task<SocketError> SendSIPRequest(SIPMethodsEnum method, SIPHeaderParams headerParams, string message, string contentType, CancellationToken ct);

        public Task<SocketError> SendSIPRequest(SIPRequest request, CancellationToken ct);

        public Task<SocketError> SendSIPResponse(SIPResponseStatusCodesEnum statusCode, SIPHeaderParams headerParams, CancellationToken ct);

        public Task<SocketError> SendSIPResponse(SIPResponseStatusCodesEnum statusCode, SIPHeaderParams headerParams, string message, string contentType, CancellationToken ct);

        public Task<SocketError> SendSIPResponse(SIPResponse response, CancellationToken ct);
    }
}
