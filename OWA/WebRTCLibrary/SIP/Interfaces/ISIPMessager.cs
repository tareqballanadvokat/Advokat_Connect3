using SIPSorcery.SIP;
using System.Net.Sockets;

namespace WebRTCLibrary.SIP.Interfaces
{
    public interface ISIPMessager
    {
        public delegate Task RequestReceivedDelegate(ISIPMessager sender, SIPRequest request);
        public delegate Task ResponseReceivedDelegate(ISIPMessager sender, SIPResponse response);

        public event RequestReceivedDelegate? OnRequestReceived;
        public event ResponseReceivedDelegate? OnResponseReceived;

        public Task<SocketError> SendSIPRequest(SIPMethodsEnum method, string message, string contentType, int cSeq);
        public Task<SocketError> SendSIPResponse(SIPResponseStatusCodesEnum statusCode, string message, string contentType, int cSeq);
    }
}
