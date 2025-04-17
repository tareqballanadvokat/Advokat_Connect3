using SIPSorcery.SIP;
using System.Net.Sockets;

namespace WebRTCLibrary.SIP
{
    public interface ISIPMessager
    {
        public delegate Task RequestReceivedDelegate(ISIPMessager sender, SIPRequest request);
        public delegate Task ResponseReceivedDelegate(ISIPMessager sender, SIPResponse response);

        public event RequestReceivedDelegate? OnRequestReceived;
        public event ResponseReceivedDelegate? OnResponseReceived;

        public Task<SocketError> SendRequest(SIPMethodsEnum method, string message, string contentType, int cSeq);
        public Task<SocketError> SendResponse(SIPResponseStatusCodesEnum statusCode, string message, string contentType, int cSeq);
    }
}
