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

            string serverIp = "127.0.0.1";
            int serverPort = 5060;
            var sipTransport = new SIPTransport();

            // Konfiguracja klienta SIP
            var clientChannel = new SIPUDPChannel(new IPEndPoint(IPAddress.Any, 0));
            sipTransport.AddSIPChannel(clientChannel);

            // Obsługa odpowiedzi z serwera
            sipTransport.SIPTransportResponseReceived +=  (localSIPEndPoint, remoteEndPoint, sipResponse) =>
            {
                Console.WriteLine($"Received SIP response: {sipResponse.Status} ({sipResponse.ReasonPhrase})({sipResponse.Body})");
                return Task.CompletedTask;
            };

            // Wysłanie żądania REGISTER
            var registerRequest = SIPRequest.GetRequest(SIPMethodsEnum.REGISTER, new SIPURI(null, serverIp, null));
            registerRequest.Header.From = new SIPFromHeader("client", new SIPURI("client", serverIp, null), null);
            registerRequest.Header.To = new SIPToHeader("client", new SIPURI("client", serverIp, null), "TAG");
            registerRequest.Header.CSeq = 1;
            registerRequest.Header.CallId = CallProperties.CreateNewCallId();
            registerRequest.Header.MaxForwards = 70;
            registerRequest.Header.Contact = new List<SIPContactHeader>();
            registerRequest.Header.Contact.Add(new SIPContactHeader(null, new SIPURI("client", "127.0.0.1", string.Empty)));

            registerRequest.Body = "Client 1 Body sent";


            await sipTransport.SendRequestAsync(registerRequest);
            Console.WriteLine("SIP REGISTER sent.");

            await Task.Delay(1000); // Poczekaj na odpowiedź
            // Wysłanie żądania INVITE (połączenie)
            var inviteRequest = SIPRequest.GetRequest(SIPMethodsEnum.INVITE, new SIPURI("server", serverIp, null));
            inviteRequest.Header.From = new SIPFromHeader("client", new SIPURI("client", serverIp, null), null);
            inviteRequest.Header.To = new SIPToHeader("server", new SIPURI("server", serverIp, null), "TAG");
            inviteRequest.Header.CSeq = 2;
            inviteRequest.Header.CallId = CallProperties.CreateNewCallId();
            inviteRequest.Header.MaxForwards = 70;
            inviteRequest.Header.Contact = new List<SIPContactHeader>();
            inviteRequest.Header.Contact.Add( new SIPContactHeader(null, new SIPURI("client", serverIp, string.Empty)));

            await sipTransport.SendRequestAsync(inviteRequest);
            Console.WriteLine("SIP INVITE sent.");

            await Task.Delay(-1); // Keep the client running
        }
    }
}
