using SIPSorcery.SIP;
using System.Net.Sockets;
using Advokat.WebRTC.Library.SIP.Interfaces;

namespace SIPClientTests.SIPConnectionTests.Mocks.SIPTransport
{
    internal class SIPTransport_Does_Nothing : ISIPTransport
    {
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

        public Task<SocketError> SendRequestAsync(SIPRequest request, bool waitForDns = false)
        {
            throw new NotImplementedException();
        }

        public Task<SocketError> SendResponseAsync(SIPResponse response, bool waitForDns = false)
        {
            throw new NotImplementedException();
        }
    }
}
