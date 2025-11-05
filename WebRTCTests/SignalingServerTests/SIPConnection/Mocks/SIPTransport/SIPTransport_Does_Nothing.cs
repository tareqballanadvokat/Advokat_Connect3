using SIPSorcery.SIP;
using System.Net.Sockets;
using Advokat.WebRTC.Library.SIP.Interfaces;

namespace SignalingServerTests.SIPConnection.Mocks.SIPTransport
{
    internal class SIPTransport_Does_Nothing : ISIPTransport
    {
        public List<SIPRequest> SentRequests { get; set; } = [];

        public List<SIPResponse> SentResponses { get; set; } = [];

        public event SIPTransportRequestAsyncDelegate SIPTransportRequestReceived;
        public event SIPTransportResponseAsyncDelegate SIPTransportResponseReceived;

        public void AddSIPChannel(SIPChannel sIPChannel)
        {
            throw new NotImplementedException();
        }

        public void Dispose()
        {
            throw new NotImplementedException();
        }

        public async Task<SocketError> SendRequestAsync(SIPRequest request, bool waitForDns = false)
        {
            this.SentRequests.Add(request);
            return SocketError.Success;
        }

        public async Task<SocketError> SendResponseAsync(SIPResponse response, bool waitForDns = false)
        {
            this.SentResponses.Add(response);
            return SocketError.Success;
        }
    }
}
