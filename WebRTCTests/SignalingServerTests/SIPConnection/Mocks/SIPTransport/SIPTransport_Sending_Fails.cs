using SIPSorcery.SIP;
using System.Net.Sockets;
using WebRTCLibrary.SIP.Interfaces;

namespace SignalingServerTests.SIPConnection.Mocks.SIPTransport
{
    internal class SIPTransport_Sending_Fails : ISIPTransport
    {
        public event SIPTransportRequestAsyncDelegate SIPTransportRequestReceived;
        public event SIPTransportResponseAsyncDelegate SIPTransportResponseReceived;

        public void AddSIPChannel(SIPChannel sIPChannel)
        {
            throw new NotImplementedException();
        }

        public async Task<SocketError> SendRequestAsync(SIPRequest request, bool waitForDns = false)
        {
            return SocketError.NotConnected;
        }

        public Task<SocketError> SendResponseAsync(SIPResponse response, bool waitForDns = false)
        {
            throw new NotImplementedException();
        }
    }
}
