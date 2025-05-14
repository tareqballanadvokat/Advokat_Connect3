using SIPSorcery.SIP;
using System.Net;
using System.Text;

namespace SignalingServerTests.Registration.Mocks.SIPRequests
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
            this.RemoteSIPEndPoint = endPoint;
        }

        public void SetLocalEndPoint(SIPEndPoint localEndPoint) 
        {
            this.LocalSIPEndPoint = localEndPoint;
        }

    }
}
