using SIPSorcery.SIP;
using System.Net.Sockets;

namespace WebRTCLibrary.SIP.Interfaces
{
    public interface ISIPTransport : IDisposable
    {
        public event SIPTransportRequestAsyncDelegate SIPTransportRequestReceived;

        public event SIPTransportResponseAsyncDelegate SIPTransportResponseReceived;

        void AddSIPChannel(SIPChannel sIPChannel);
        Task<SocketError> SendRequestAsync(SIPRequest request, bool waitForDns = false);
        Task<SocketError> SendResponseAsync(SIPResponse response, bool waitForDns = false);
    }
}
