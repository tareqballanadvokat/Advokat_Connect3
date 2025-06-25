using SIPSorcery.SIP;
using System.Net.Sockets;
using WebRTCLibrary.SIP.Interfaces;

namespace SIPClientTests.SIPConnectionTests.Mocks.SIPTransport
{
    internal class SIPTransport_Logs_Messages : ISIPTransport
    {
        public List<SIPRequest> SentRequests { get; private set; } = [];
        public List<SIPResponse> SentResponses { get; private set; } = [];


        public event SIPTransportRequestAsyncDelegate SIPTransportRequestReceived;
        public event SIPTransportResponseAsyncDelegate SIPTransportResponseReceived;

        public void AddSIPChannel(SIPChannel sIPChannel)
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
