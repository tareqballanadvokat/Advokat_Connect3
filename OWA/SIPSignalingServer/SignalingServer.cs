using SIPSignalingServer.Models;
using SIPSorcery.SIP;
using System.Net;
using WebRTCLibrary.SIP;
using WebRTCLibrary.SIP.Models;
using WebRTCLibrary.SIP.Utils;

namespace SIPSignalingServer
{
    internal class SignalingServer : AbstractSIPMessager
    {
        //private IPEndPoint ServerEndpoint = new IPEndPoint(Dns.GetHostAddresses(Dns.GetHostName()).Last(), 8081);
        private IPEndPoint ServerEndpoint = IPEndPoint.Parse("192.168.1.58:8081");


        private SIPRegisty Registry = new SIPRegisty();

        private SIPSchemesEnum SIPScheme = SIPSchemesEnum.sip;

        private SIPConnection Connection;

        internal SignalingServer()
        {
            this.Connection = this.GetConnection(this.ServerEndpoint);
            Console.WriteLine($"listening on {ServerEndpoint}");
            this.Connection.SIPRequestReceived += this.RegistraionRequestListener;
            //this.Connection.SIPResponseReceived += this.RequestListener;

        }

        private SIPConnection GetConnection(IPEndPoint sourceEndpoint)
        {
            SIPTransport transport = new SIPTransport();

            // set listening channel
            //SIPUDPChannel channel = new SIPUDPChannel(this.SourceParticipant.Endpoint.GetIPEndPoint());
            SIPUDPChannel channel = new SIPUDPChannel(sourceEndpoint);

            // TODO: add more channels for TCP / ws support
            // TODO: add factory for channels
            transport.AddSIPChannel(channel);

            return new SIPConnection(SIPScheme, transport);
        }

        //private async Task RequestListener(SIPEndPoint localEndPoint, SIPEndPoint remoteEndPoint, SIPResponse sipResponse)
        //{
        //    // whaaaaaat
        //}


        /// <summary>General listener for all requests from clients.</summary>
        /// <version date="20.03.2025" sb="MAC"></version>
        private async Task RegistraionRequestListener(SIPEndPoint localEndPoint, SIPEndPoint remoteEndPoint, SIPRequest sipRequest)
        {
            if (sipRequest.Method == SIPMethodsEnum.REGISTER)
            {
                // TODO: check already if registered
                SIPResponse accpetedResponse = this.GetRegisteredAcceptedResponse(localEndPoint, remoteEndPoint, sipRequest);
                await this.Connection.SendSIPResponse(accpetedResponse);
            }

            if (sipRequest.Method == SIPMethodsEnum.ACK)
            {
                this.Register(localEndPoint, remoteEndPoint, sipRequest); // TODO: register on first request or on ACK?
            }

        }

        private void Register(SIPEndPoint localEndPoint, SIPEndPoint remoteEndPoint, SIPRequest sipRequest)
        {
            SIPRegistration registration = new SIPRegistration()
            {
                SourceUserName = sipRequest.Header.From.FromUserField.Name,
                RemoteUserName = sipRequest.Header.To.ToUserField.Name,
            };

            this.Registry.Register(registration);
        }


        private SIPResponse GetRegisteredAcceptedResponse(SIPEndPoint localEndPoint, SIPEndPoint remoteEndPoint, SIPRequest sipRequest)
        {
            SIPParticipant signalingServerParticipant = new SIPParticipant(string.Empty, localEndPoint);
            SIPParticipant clientParticipant = new SIPParticipant(sipRequest.Header.From.FromName, remoteEndPoint); // or from endpoint?

            SIPHeaderParams headerParams = this.GetHeaderParams(
                signalingServerParticipant,
                clientParticipant,
                fromTag: CallProperties.CreateNewTag(), // TODO: pass tag to ACK listener
                cSeq: sipRequest.Header.CSeq + 1,
                callID: null); // TODO: add callId

            return SIPHelper.GetResponse(this.SIPScheme, SIPResponseStatusCodesEnum.Accepted, headerParams);
        }

    }
}
