using System;
using System.Net;
using System.Threading.Tasks;
using SIPSorcery.SIP;
using SIPSorcery.SIP.App;

namespace SipClient
{
    class Program
    {
        static async Task Main(string[] args)
        {
            Console.WriteLine("Starting SIP Client...");

            string serverIp = "92.205.233.81:8081";
            //int serverPort = 5060;
            int serverPort = 8081;
            int clientPort = 5062;
            var sipTransport = new SIPTransport();


            var ips = Dns.GetHostAddresses(Dns.GetHostName());
            var ipEndpoint =new IPEndPoint(ips[1], clientPort);
            // Konfiguracja klienta SIP
            var clientChannel = new SIPUDPChannel(ipEndpoint);
            sipTransport.AddSIPChannel(clientChannel);

            // Obsługa odpowiedzi z serwera
            sipTransport.SIPTransportResponseReceived += (localEndPoint, remoteEndPoint, sipResponse) =>
            {
                Console.WriteLine($"Received SIP response: {sipResponse.Status} ({sipResponse.ReasonPhrase})");
                return Task.CompletedTask;
            };

            // Obsługa wiadomości przychodzących
            sipTransport.SIPTransportRequestReceived += async (localEndPoint, remoteEndPoint, sipRequest) =>
            {
                Console.WriteLine($"Received SIP request: {sipRequest.Method} from {remoteEndPoint}");

                if (sipRequest.Method == SIPMethodsEnum.MESSAGE)
                {
                    Console.WriteLine($"MESSAGE received from {sipRequest.Header.From.FromURI.User}: {sipRequest.Body}");
                    var okResponse = SIPResponse.GetResponse(sipRequest, SIPResponseStatusCodesEnum.Ok, null);
                    await sipTransport.SendResponseAsync(okResponse);
                }
            };

            // Wysłanie żądania REGISTER
            var registerRequest = SIPRequest.GetRequest(SIPMethodsEnum.REGISTER, new SIPURI(null, serverIp, null));
            //registerRequest.Header.Contact = new SIPContactHeader(null, new SIPURI("client", $"127.0.0.1:{clientPort}", null));

            registerRequest.Header.From = new SIPFromHeader("server", new SIPURI("server", ipEndpoint.ToString(), null), null);
            registerRequest.Header.To = new SIPToHeader("client1", new SIPURI("client1", serverIp, null), "TAG");
            registerRequest.Header.CSeq = 1;
            registerRequest.Header.CallId = CallProperties.CreateNewCallId();
            registerRequest.Header.MaxForwards = 70;
            //registerRequest.Header.Contact = new List<SIPContactHeader> { new SIPContactHeader(null, new SIPURI("client", $"127.0.0.1:{clientPort}", string.Empty)) };
            registerRequest.Header.Contact = new List<SIPContactHeader> { new SIPContactHeader(null, new SIPURI("server", ipEndpoint.ToString(), string.Empty)) };

            await sipTransport.SendRequestAsync(registerRequest);
            Console.WriteLine("SIP REGISTER sent.");


            // Wysłanie żądania INVITE (połączenie)
            var inviteRequest = SIPRequest.GetRequest(SIPMethodsEnum.INVITE, new SIPURI("server", serverIp, null));
            inviteRequest.Header.From = new SIPFromHeader("server", new SIPURI("server", serverIp, null), null);
            inviteRequest.Header.To = new SIPToHeader("client1", new SIPURI("client1", serverIp, null), "TAG");
            inviteRequest.Header.CSeq = 2;
            inviteRequest.Header.CallId = CallProperties.CreateNewCallId();
            inviteRequest.Header.MaxForwards = 70;
            inviteRequest.Header.Contact = new List<SIPContactHeader>();
            inviteRequest.Header.Contact.Add(new SIPContactHeader(null, new SIPURI("server", serverIp, string.Empty)));
            inviteRequest.Body = "Inviting";
            await sipTransport.SendRequestAsync(inviteRequest);
            Console.WriteLine("SIP INVITE sent.");


            // Wysłanie żądania PUBLISH (połączenie)
            var publishRequest = SIPRequest.GetRequest(SIPMethodsEnum.PUBLISH, new SIPURI("server", serverIp, null));
            publishRequest.Header.From = new SIPFromHeader("server", new SIPURI("server", serverIp, null), null);
            publishRequest.Header.To = new SIPToHeader("client1", new SIPURI("client1", serverIp, null), "TAG");
            publishRequest.Header.CSeq = 2;
            publishRequest.Header.CallId = CallProperties.CreateNewCallId();
            publishRequest.Header.MaxForwards = 70;
            publishRequest.Header.Contact = new List<SIPContactHeader>();
            publishRequest.Header.Contact.Add(new SIPContactHeader(null, new SIPURI("client", serverIp, string.Empty)));
            publishRequest.Body = "MyOffer";
            await sipTransport.SendRequestAsync(publishRequest);
            Console.WriteLine("SIP PUBLISH sent.");


            await Task.Delay(-1); // Keep the client running
        }
    }
}
