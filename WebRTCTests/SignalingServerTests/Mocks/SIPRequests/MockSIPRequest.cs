using SIPSorcery.SIP;
using System.Net;
using System.Text;

namespace SignalingServerTests.Mocks.SIPRequests
{
    internal class MockSIPRequest : SIPRequest
    {
        public MockSIPRequest(SIPMethodsEnum method, string uri) : base(method, uri)
        {
        }

        public MockSIPRequest(SIPMethodsEnum method, SIPURI uri) : base(method, uri)
        {
        }

        public MockSIPRequest(SIPMethodsEnum method, SIPURI uri, Encoding sipEncoding, Encoding sipBodyEncoding) : base(method, uri, sipEncoding, sipBodyEncoding)
        {
        }

        public void SetRemoteEndPoint(SIPEndPoint endPoint)
        {
            RemoteSIPEndPoint = endPoint;
        }

        public void SetLocalEndPoint(SIPEndPoint localEndPoint) 
        {
            LocalSIPEndPoint = localEndPoint;
        }

    }
}
