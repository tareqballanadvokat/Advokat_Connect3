//using System;
//using System.Net;
//using System.Text;
//using System.Threading.Channels;
//using System.Threading.Tasks;
//using SIPSorcery.SIP;
//using SIPSorcery.SIP.App;

//namespace SipSignalServer
//{
//    class Program
//    {
//        static SIPTransport Transport;
//        //static SIPMessage msg;
//        static string inputMsg;
//        static SIPUDPChannel channel;
//        static SIPRequest subscribeRequest;

//        static async Task Main(string[] args)
//        {
//            await InitializeSIPAsync();
//            Console.Read();
//        }

//        static async Task InitializeSIPAsync()
//        {
//            //ResolveIPEndPoint
//            SIPEndPoint sipep = new SIPEndPoint(new IPEndPoint(IPAddress.Parse("127.0.0.1"), 5060));
//            IPEndPoint remoteEP = new IPEndPoint(IPAddress.Parse("127.0.0.1"), 5060);

//            //Set Transport
//            //Transport = new SIPTransport();

//            ////IPEndPoint
//            //IPEndPoint localEndPoint = new IPEndPoint(IPAddress.Parse("192.168.100.10"), 8080);

//            ////Create Channel object
//            //channel = new SIPUDPChannel(localEndPoint);
//            //Transport.AddSIPChannel(channel);


//            IPAddress listenAddress = IPAddress.Any;
//            int listenPort = 5060;
//            Transport = new SIPTransport();
//            channel = new SIPUDPChannel(new IPEndPoint(listenAddress, listenPort));
//            Transport.AddSIPChannel(channel);


//            Transport = new SIPTransport();
//            //Wire transport with incoming requests
//            Transport.SIPTransportRequestReceived //+= new SIPTransportRequestAsyncDelegate(Transport_SIPTransportRequestReceived);
//                += async (localEndPoint, remoteEndPoint, sipRequest) =>
//                            {
//                                Console.WriteLine($"Received SIP request: {sipRequest.Method} from {remoteEndPoint} with data: {sipRequest.Body}");


//                                if (sipRequest.Method == SIPMethodsEnum.REGISTER)
//                                {
//                                    var response = SIPResponse.GetResponse(sipRequest, SIPResponseStatusCodesEnum.Ok, null);
//                                    await Transport.SendResponseAsync(response);
//                                    Console.WriteLine("SIP Registration OK");
//                                }
//                                else if (sipRequest.Method == SIPMethodsEnum.INVITE)
//                                {
//                                    var tryingResponse = SIPResponse.GetResponse(sipRequest, SIPResponseStatusCodesEnum.Trying, null);
//                                    await  Transport.SendResponseAsync(tryingResponse);

//                                    //var ringingResponse = SIPResponse.GetResponse(sipRequest, SIPResponseStatusCodesEnum.Ringing, null);
//                                    //await sipTransport.SendResponseAsync(ringingResponse);

//                                    //var okResponse = SIPResponse.GetResponse(sipRequest, SIPResponseStatusCodesEnum.Ok, "TEst returned from Signallin server");
//                                    //okResponse.Body = "Body retuned form signalling server";
//                                    //await sipTransport.SendResponseAsync(okResponse);
//                                    //var dataf = sipTransport.GetSIPChannels();
//                                    Console.WriteLine("Call established");
//                                }
//                                else
//                                {
//                                    var notAllowedResponse = SIPResponse.GetResponse(sipRequest, SIPResponseStatusCodesEnum.MethodNotAllowed, null);
//                                    await Transport.SendResponseAsync(notAllowedResponse);
//                                }
//                            };
//            //Wire transport with incoming responses
//            Transport.SIPTransportResponseReceived += new SIPTransportResponseAsyncDelegate(Transport_SIPTransportResponseReceived);

//            string inputMsgStr = "SUBSCRIBE sip:myUSer@192.168.102.12 SIP/2.0" + SIPConstants.CRLF +
//            "Via: SIP/2.0/UDP 192.168.100.10:8080;rport;branch=z9hG4bKFBB7EAC06934405182D13950BD51F001" + SIPConstants.CRLF +
//            "From: <sip:subscribeUser@192.168.102.12>;tag=196468136" + SIPConstants.CRLF +
//            "To: <sip:myUser@192.168.102.12>" + SIPConstants.CRLF +
//            "Contact: <sip:subscribeUser@>" + SIPConstants.CRLF +
//            "Call-ID: 1337505490-453410046-705466123" + SIPConstants.CRLF +
//            "CSeq: 1 SUBSCRIBE" + SIPConstants.CRLF +
//            "Max-Forwards: 70" + SIPConstants.CRLF +
//            "Event: Presence" + SIPConstants.CRLF +
//            "Content-Length: 0";

//            var inputMsg = Encoding.UTF8.GetBytes(inputMsgStr);
//            subscribeRequest = SIPRequest.ParseSIPRequest(inputMsgStr);
//            SIPEndPoint sIPEndPoint = new SIPEndPoint(new IPEndPoint(IPAddress.Parse(remoteEP.Address.ToString()), remoteEP.Port));
//            await channel.SendAsync(sIPEndPoint, inputMsg, false, string.Empty);

//             await Task.Delay(-1); // Keep the server running
//        }

//        static async Task Transport_SIPTransportResponseReceived(SIPEndPoint localSIPEndPoint, SIPEndPoint remoteEndPoint, SIPResponse sipResponse)
//        {
//            Console.WriteLine("Response method: " + sipResponse.Header.CSeqMethod);
//            if (sipResponse.StatusCode == 401 && sipResponse.Header.CSeqMethod == SIPMethodsEnum.SUBSCRIBE)
//            {
//                //Resubscribe with Digist
//                //SIP Header
//                SIPHeader header = subscribeRequest.Header;
//                header.CSeq++;
//                header.CallId = "some_new_callID";
//                //header.AuthenticationHeader = sipResponse.Header.AuthenticationHeader;
//                header.Expires = 120;

//                //New Request
//                SIPRequest request = new SIPRequest(SIPMethodsEnum.SUBSCRIBE, new SIPURI(SIPSchemesEnum.sip, remoteEndPoint));
//                //request.LocalSIPEndPoint = localSIPEndPoint;
//                //request.RemoteSIPEndPoint = remoteEndPoint;
//                request.Header = header;

//                //Send request

//                string inputMsgStr = "SUBSCRIBE sip:myUSer@192.168.102.12 SIP/2.0" + SIPConstants.CRLF +
//                "Via: SIP/2.0/UDP 192.168.100.10:8080;rport;branch=z9hG4bKFBB7EAC06934405182D13950BD51F001" + SIPConstants.CRLF +
//                "From: <sip:subscribeUser@192.168.102.12>;tag=196468136" + SIPConstants.CRLF +
//                "To: <sip:myUser@192.168.102.12>" + SIPConstants.CRLF +
//                "Contact: <sip:subscribeUser@>" + SIPConstants.CRLF +
//                "Call-ID: 1337505490-453410046-705466123" + SIPConstants.CRLF +
//                "CSeq: 1 SUBSCRIBE" + SIPConstants.CRLF +
//                "Max-Forwards: 70" + SIPConstants.CRLF +
//                "Event: Presence" + SIPConstants.CRLF +
//                "Content-Length: 0";

//                var inputMsg = Encoding.UTF8.GetBytes(inputMsgStr);
//                subscribeRequest = SIPRequest.ParseSIPRequest(inputMsgStr);
//                await channel.SendAsync(remoteEndPoint, inputMsg, false, string.Empty);
//            }
//            else
//                Console.WriteLine(string.Format("Error {0} {1}.", sipResponse.StatusCode, sipResponse.Status));
//        }

//        static async Task Transport_SIPTransportRequestReceived(SIPEndPoint localSIPEndPoint, SIPEndPoint remoteEndPoint, SIPRequest sipRequest)
//        {
//            Console.WriteLine("Request body: " + sipRequest.Body);
//        }
//    }
//}
