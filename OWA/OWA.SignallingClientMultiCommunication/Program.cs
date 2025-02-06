using System;
using System.Net;
using System.Threading.Tasks;
using SIPSorcery.SIP;
using SIPSorcery.SIP.App;

namespace SipClient
{
    class Program
    {
        public static List<int> requestResponseList = new List<int>();
        static async Task Main(string[] args)
        {
            ///Setup custom information for the client - port, ip, source name (You/From), destination name (Who/To)
            Console.WriteLine("Starting SIP Real Client ...");

            string serverIp = "92.205.233.81:8081";//int serverPort = 8081;
            Console.WriteLine($"Signalling Server: {serverIp}");

            Console.WriteLine("Please type local port for communication (ex: 5061):");
            var portAsString = Console.ReadLine();
            int clientPort = int.Parse(portAsString);

            Console.WriteLine("Please choose correct IP:");
            var ips = Dns.GetHostAddresses(Dns.GetHostName());
            int i = 0;
            foreach (var ip in ips)
            {
                Console.WriteLine($"[{i}] - {ip}");
                i++;
            }
            var selectedValue = Console.ReadLine();
            var selectedIp = ips[int.Parse(selectedValue)];
            var ipEndpoint = new IPEndPoint(selectedIp, clientPort);
            Console.WriteLine($"Your IP: {ipEndpoint}");


            Console.WriteLine("Please type Your unique name [ex. xyz123]");
            var fromName = Console.ReadLine();
            var user = fromName;

            Console.WriteLine("Please type Unique name to Whom You want send message [ex. asd123]");
            var toName = Console.ReadLine();


            var sipTransport = new SIPTransport();
            var clientChannel = new SIPUDPChannel(ipEndpoint);
            //var clientChannel3 = new SIPTCPChannel(ipEndpoint);
            sipTransport.AddSIPChannel(clientChannel);

            sipTransport.SIPTransportResponseReceived += (localEndPoint, remoteEndPoint, sipResponse) =>
            {
                Console.WriteLine($"Received SIP response: {sipResponse.Status} ({sipResponse.ReasonPhrase})  {sipResponse.Header.CSeq} ");
                requestResponseList.Add(sipResponse.Header.CSeq);
                return Task.CompletedTask;
            };

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
            registerRequest.Header.From = new SIPFromHeader(fromName, new SIPURI(fromName, ipEndpoint.ToString(), null), null);
            registerRequest.Header.To = new SIPToHeader(toName, new SIPURI(toName, serverIp, null), "TAG");
            registerRequest.Header.CSeq = 1;
            registerRequest.Header.CallId = CallProperties.CreateNewCallId();
            registerRequest.Header.MaxForwards = 70;
            registerRequest.Header.Contact = new List<SIPContactHeader> { new SIPContactHeader(null, new SIPURI(fromName, ipEndpoint.ToString(), string.Empty)) };



            new Thread(async () =>
            {
                Task.Delay(5000).Wait();
                CheckConnectionStatus();
            }).Start();

            var data = await sipTransport.SendRequestAsync(registerRequest);
            Console.WriteLine($"SIP REGISTER sent. with CSeq {registerRequest.Header.CSeq}");


            // Wysłanie żądania INVITE (połączenie)
            var inviteRequest = SIPRequest.GetRequest(SIPMethodsEnum.INVITE, new SIPURI(user, serverIp, null));
            inviteRequest.Header.From = new SIPFromHeader(fromName, new SIPURI(fromName, serverIp, null), null);
            inviteRequest.Header.To = new SIPToHeader(toName, new SIPURI(toName, serverIp, null), "TAG");
            inviteRequest.Header.CSeq = 2;
            inviteRequest.Header.CallId = CallProperties.CreateNewCallId();
            inviteRequest.Header.MaxForwards = 70;
            inviteRequest.Header.Contact = new List<SIPContactHeader>();
            inviteRequest.Header.Contact.Add(new SIPContactHeader(null, new SIPURI(user, serverIp, string.Empty)));
            inviteRequest.Body = "Inviting";
            await sipTransport.SendRequestAsync(inviteRequest);
            Console.WriteLine($"SIP INVITE sent. with CSeq {inviteRequest.Header.CSeq}");


            // Wysłanie żądania PUBLISH (połączenie)
            var publishRequest = SIPRequest.GetRequest(SIPMethodsEnum.PUBLISH, new SIPURI(user, serverIp, null));
            publishRequest.Header.From = new SIPFromHeader(fromName, new SIPURI(fromName, serverIp, null), null);
            publishRequest.Header.To = new SIPToHeader(toName, new SIPURI(toName, serverIp, null), "TAG");
            publishRequest.Header.CSeq = 3;
            publishRequest.Header.CallId = CallProperties.CreateNewCallId();
            publishRequest.Header.MaxForwards = 70;
            publishRequest.Header.Contact = new List<SIPContactHeader>();
            publishRequest.Header.Contact.Add(new SIPContactHeader(null, new SIPURI(user, serverIp, string.Empty)));
            publishRequest.Body = "MyOffer";
            await sipTransport.SendRequestAsync(publishRequest);
            Console.WriteLine($"SIP PUBLISH sent. with CSeq {publishRequest.Header.CSeq}");
            int cseq = 4;
            bool isActive = true;
            while (isActive)
            {
                Console.WriteLine("Please type Your message:");
                var message = Console.ReadLine();
                // Wysłanie żądania MESSAGE (wiadomość)
                var messageRequest = SIPRequest.GetRequest(SIPMethodsEnum.MESSAGE, new SIPURI(user, serverIp, null));
                messageRequest.Header.From = new SIPFromHeader(fromName, new SIPURI(fromName, serverIp, null), null);
                messageRequest.Header.To = new SIPToHeader(toName, new SIPURI(toName, serverIp, null), "TAG");
                messageRequest.Header.CSeq = cseq;
                messageRequest.Header.CallId = CallProperties.CreateNewCallId();
                messageRequest.Header.MaxForwards = 70;
                messageRequest.Header.Contact = new List<SIPContactHeader>();
                messageRequest.Header.Contact.Add(new SIPContactHeader(null, new SIPURI(user, serverIp, string.Empty)));
                messageRequest.Body = message;
                await sipTransport.SendRequestAsync(messageRequest);
                Console.WriteLine($"SIP PUBLISH sent. with CSeq {cseq}");
                Console.WriteLine("Do You want to send another message? [Y/N]");
                var answer = Console.ReadLine();
                if (answer.ToUpper() == "N")
                {
                    isActive = false;
                    cseq++;
                    var byeRequest = SIPRequest.GetRequest(SIPMethodsEnum.BYE, new SIPURI(user, serverIp, null));
                    byeRequest.Header.From = new SIPFromHeader(fromName, new SIPURI(fromName, serverIp, null), null);
                    byeRequest.Header.To = new SIPToHeader(toName, new SIPURI(toName, serverIp, null), "TAG");
                    byeRequest.Header.CSeq = cseq;
                    byeRequest.Header.CallId = CallProperties.CreateNewCallId();
                    byeRequest.Header.MaxForwards = 70;
                    byeRequest.Header.Contact = new List<SIPContactHeader>();
                    byeRequest.Header.Contact.Add(new SIPContactHeader(null, new SIPURI(user, serverIp, string.Empty)));
                    byeRequest.Body = "BYE message";
                    Console.WriteLine($"SIP BYE sent. with CSeq {cseq}");
                    await sipTransport.SendRequestAsync(messageRequest);

                }

                cseq++;
            }

            await Task.Delay(-1); // Keep the client running
        }

        public static void CheckConnectionStatus()
        {
            int cseq = 1;
            if (requestResponseList.Count > 0)
            {
                foreach (var item in requestResponseList)
                {
                    if (item != cseq)
                    {
                        Console.WriteLine($"CONNECTION NOT ESTABLISHED");
                    }
                    else if (item == cseq)
                    {
                        Console.WriteLine($"CONNECTION ESTABLISHED");
                    }
                }
                return;
            }

            Console.WriteLine($"CONNECTION NOT ESTABLISHED");
        }
    }
}
