//using System;
//using System.Collections.Concurrent;
//using System.Net;
//using System.Threading.Tasks;
//using SIPSorcery.SIP;
//using SIPSorcery.SIP.App;

//namespace SipSignalServer
//{
//    class Program
//    {
//        static ConcurrentDictionary<string, SIPURI> registeredUsers = new();
//        static ConcurrentDictionary<string, (SIPURI Caller, SIPURI Callee)> activeCalls = new();
//        static SIPTransport sipTransport;

//        static async Task Main(string[] args)
//        {
//            Console.WriteLine("Starting SIP Server...");

//            IPAddress listenAddress = IPAddress.Any;
//            int listenPort = 5060;
//            sipTransport = new SIPTransport();

//            try
//            {
//                sipTransport.AddSIPChannel(new SIPUDPChannel(new IPEndPoint(listenAddress, listenPort)));

//                sipTransport.SIPTransportRequestReceived += async (localEndPoint, remoteEndPoint, sipRequest) =>
//                {
//                    Console.WriteLine($"Received SIP request: {sipRequest.Method} from {remoteEndPoint}");

//                    if (sipRequest.Method == SIPMethodsEnum.REGISTER)
//                    {
//                        var contact = sipRequest.Header.Contact[0].ContactURI;
//                        registeredUsers[sipRequest.Header.From.FromURI.User] = contact;
//                        var response = SIPResponse.GetResponse(sipRequest, SIPResponseStatusCodesEnum.Ok, null);
//                        await sipTransport.SendResponseAsync(response);
//                        Console.WriteLine($"User registered: {sipRequest.Header.From.FromURI.User} -> {contact}");
//                        new Thread(async () =>
//                        {
//                            Task.Delay(5000).Wait();
//                            await SendMessageToClient(sipRequest.Header.From.FromURI.User, "dupa");
//                        }).Start();
//                    }
//                    else if (sipRequest.Method == SIPMethodsEnum.INVITE)
//                    {
//                        var callId = sipRequest.Header.CallId;
//                        var caller = sipRequest.Header.From.FromURI;
//                        var callee = sipRequest.Header.To.ToURI;
//                        activeCalls[callId] = (caller, callee);

//                        Console.WriteLine($"Call initiated: {caller} -> {callee}");

//                        var tryingResponse = SIPResponse.GetResponse(sipRequest, SIPResponseStatusCodesEnum.Trying, null);
//                        await sipTransport.SendResponseAsync(tryingResponse);

//                        var ringingResponse = SIPResponse.GetResponse(sipRequest, SIPResponseStatusCodesEnum.Ringing, null);
//                        await sipTransport.SendResponseAsync(ringingResponse);

//                        var okResponse = SIPResponse.GetResponse(sipRequest, SIPResponseStatusCodesEnum.Ok, null);
//                        await sipTransport.SendResponseAsync(okResponse);

//                        Console.WriteLine("Call established. Sending message...");

//                        // Sprawdzamy, czy użytkownik jest zarejestrowany przed wysłaniem wiadomości
//                        if (registeredUsers.ContainsKey(caller.User))
//                        {
//                            await SendMessageToClient(caller.User, "dupa");
//                            Console.WriteLine($"Message sent to {caller.User}");
//                        }
//                        else
//                        {
//                            Console.WriteLine($"User {caller.User} not registered. Cannot send message.");
//                        }
//                    }
//                    else if (sipRequest.Method == SIPMethodsEnum.MESSAGE)
//                    {
//                        var recipient = sipRequest.Header.To.ToURI.User;
//                        if (registeredUsers.TryGetValue(recipient, out var recipientUri))
//                        {
//                            var messageResponse = SIPResponse.GetResponse(sipRequest, SIPResponseStatusCodesEnum.Ok, null);
//                            await sipTransport.SendResponseAsync(messageResponse);
//                            Console.WriteLine($"Message forwarded to {recipient}: {sipRequest.Body}");
//                        }
//                        else
//                        {
//                            var notFoundResponse = SIPResponse.GetResponse(sipRequest, SIPResponseStatusCodesEnum.NotFound, null);
//                            await sipTransport.SendResponseAsync(notFoundResponse);
//                        }
//                    }
//                    else
//                    {
//                        var notAllowedResponse = SIPResponse.GetResponse(sipRequest, SIPResponseStatusCodesEnum.MethodNotAllowed, null);
//                        await sipTransport.SendResponseAsync(notAllowedResponse);
//                    }
//                };

//                Console.WriteLine($"SIP Server listening on {listenAddress}:{listenPort}");

//                await Task.Delay(-1);
//            }
//            catch (Exception ex)
//            {
//                Console.WriteLine($"Error: {ex.Message}");
//            }
//            finally
//            {
//                sipTransport.Shutdown();
//            }
//        }

//        public static async Task SendMessageToClient(string recipientUser, string message)
//        {
//            if (registeredUsers.TryGetValue(recipientUser, out var recipientUri))
//            {
//                Console.WriteLine($"Sending MESSAGE to {recipientUser} at {recipientUri}...");

//                var messageRequest = SIPRequest.GetRequest(SIPMethodsEnum.MESSAGE, recipientUri);

//                messageRequest.Header.From = new SIPFromHeader("server", new SIPURI("server", "127.0.0.1", null), null);
//                messageRequest.Header.To = new SIPToHeader(recipientUser, recipientUri, "Tag");
//                messageRequest.Header.CSeq = 1;
//                messageRequest.Header.CallId = CallProperties.CreateNewCallId();
//                messageRequest.Body = message;
//                messageRequest.Header.ContentType = "text/plain";

//                await sipTransport.SendRequestAsync(messageRequest);
//                Console.WriteLine($"MESSAGE sent to {recipientUser}: {message}");
//            }
//            else
//            {
//                Console.WriteLine($"User {recipientUser} not found in registeredUsers.");
//            }
//        }
//    }
//}
