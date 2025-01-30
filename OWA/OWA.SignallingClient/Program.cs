//using System;
//using System.Net;
//using System.Threading.Tasks;
//using SIPSorcery.SIP;
//using SIPSorcery.SIP.App;

//namespace SipClient
//{
//    class Program
//    {
//        static async Task Main(string[] args)
//        {
//            Console.WriteLine("Starting SIP Client...");

//            string serverIp = "127.0.0.1";
//            int serverPort = 5060;

//            var sipTransport = new SIPTransport();
//            sipTransport.AddSIPChannel(new SIPUDPChannel(new IPEndPoint(IPAddress.Any, 0)));

//            var registerRequest = new SIPRequest(SIPMethodsEnum.REGISTER, new SIPURI(null, serverIp, serverPort))
//            {
//                Header = new SIPHeader()
//                {
//                    From = new SIPFromHeader(null, new SIPURI("client", serverIp, serverPort), null),
//                    To = new SIPToHeader(null, new SIPURI("client", serverIp, serverPort),""),
//                    CSeq = 1,
//                    CallId = SIPCallDescriptor.NewCallId(),
//                    MaxForwards = 70,
//                    UserAgent = "SIP Client"
//                }
//            };

//            await sipTransport.SendRequestAsync(registerRequest);
//            Console.WriteLine("SIP REGISTER sent.");

//            // INVITE (połączenie)
//            var inviteRequest = new SIPRequest(SIPMethodsEnum.INVITE, new SIPURI("client", serverIp, serverPort))
//            {
//                Header = new SIPHeader()
//                {
//                    From = new SIPFromHeader(null, new SIPURI("client", serverIp, serverPort), null),
//                    To = new SIPToHeader(null, new SIPURI("server", serverIp, serverPort)),
//                    CSeq = 2,
//                    CallId = SIPCallDescriptor.NewCallId(),
//                    MaxForwards = 70,
//                    UserAgent = "SIP Client"
//                }
//            };

//            await sipTransport.SendRequestAsync(inviteRequest);
//            Console.WriteLine("SIP INVITE sent.");

//            await Task.Delay(-1);
//        }
//    }
//}
