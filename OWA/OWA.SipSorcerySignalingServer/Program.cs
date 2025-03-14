using System;
using System.Collections.Concurrent;
using System.Net;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using SIPSorcery.SIP;
using SIPSorcery.SIP.App;
using SIPSorcery.Net;
using Serilog.Extensions.Logging;
using Serilog;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Logging;

namespace SipSignalServer
{
    class Program
    {
        static ConcurrentDictionary<string, SIPURI> registeredUsers = new();
        static SIPTransport sipTransport;

        private static Microsoft.Extensions.Logging.ILogger logger = NullLogger.Instance;

        public static SIPRequest CreateMessageToClient(string recipientUser, string message, string from = "server")
        {
            if (registeredUsers.TryGetValue(recipientUser, out var recipientUri))
            {
                LogEntry($"{DateTime.Now} : Sending MESSAGE to {recipientUser} at {recipientUri}...");
                var spiuri = new SIPURI(recipientUri.User, "192.168.0.114:8082", string.Empty, SIPSchemesEnum.sip, SIPProtocolsEnum.ws);

                var messageRequest = SIPRequest.GetRequest(SIPMethodsEnum.MESSAGE, spiuri);
                //messageRequest.Header.From = new SIPFromHeader("server", new SIPURI("server", "127.0.0.1", null), null);
                messageRequest.Header.From = new SIPFromHeader(from, spiuri, "Tag");//check it
                messageRequest.Header.To = new SIPToHeader(recipientUser, recipientUri, "Tag");
                messageRequest.Header.CSeq = 1;
                messageRequest.Header.CallId = CallProperties.CreateNewCallId();
                messageRequest.Body = message;
                messageRequest.Header.ContentType = null;


                LogEntry($"{DateTime.Now} : MESSAGE sent to {recipientUser}: {message}");
                return messageRequest;
            }
            else
            {
                LogEntry($"{DateTime.Now} : User {recipientUser} not found in registeredUsers.");
            }
            return null;
        }

        public static SIPRequest CreateMessageToClient2(string recipientUser, string message, SIPRequest request, string from = "server")
        {
            if (registeredUsers.TryGetValue(recipientUser, out var recipientUri))
            {
                LogEntry($"{DateTime.Now} : Sending MESSAGE to {recipientUser} at {recipientUri}...");

                // request.Header.Vias.TopViaHeader.ReceivedFromAddress is the most important here
                var messageRequest = new SIPRequest(SIPMethodsEnum.MESSAGE, new SIPURI("server", request.Header.Vias.TopViaHeader.ReceivedFromAddress, "transport=ws", SIPSchemesEnum.sip));
                var CallId = CallProperties.CreateNewCallId();

                messageRequest.Header = new SIPHeader(
                    SIPFromHeader.ParseFromHeader(request.Header.To.ToString()), // should this also be set to ReceivedFromAddress?
                    SIPToHeader.ParseToHeader(request.Header.From.ToString()),
                    1,
                    CallId);
                messageRequest.Header.Contact = new List<SIPContactHeader>
                {
                    new SIPContactHeader(request.Header.To.ToUserField)
                };
                messageRequest.Header.CSeqMethod = SIPMethodsEnum.MESSAGE;
                messageRequest.Header.Vias = new SIPViaSet()
                {
                    Via = new List<SIPViaHeader>()
                        {
                            new SIPViaHeader(request.Header.Vias.TopViaHeader.ReceivedFromIPAddress, request.Header.Vias.TopViaHeader.ReceivedFromPort, CallProperties.CreateBranchId(), SIPProtocolsEnum.ws)
                        }
                };

                messageRequest.Header.ContentType = "text/plain";
                LogEntry($"{DateTime.Now} : MESSAGE sent to {recipientUser}: {message}");
               
                return messageRequest;
            }
            else
            {
                LogEntry($"{DateTime.Now} : User {recipientUser} not found in registeredUsers.");
            }
            return null;
        }

        public static async Task SendMessageToClient(string recipientUser, string message, string from = "server")
        {
            if (registeredUsers.TryGetValue(recipientUser, out var recipientUri))
            {
                LogEntry($"{DateTime.Now} : Sending MESSAGE to {recipientUser} at {recipientUri}...");

                var messageRequest = SIPRequest.GetRequest(SIPMethodsEnum.MESSAGE, recipientUri);
                //messageRequest.Header.From = new SIPFromHeader("server", new SIPURI("server", "127.0.0.1", null), null);
                messageRequest.Header.From = new SIPFromHeader(from, new SIPURI(from, "127.0.0.1", null), null);//check it
                messageRequest.Header.To = new SIPToHeader(recipientUser, recipientUri, "Tag");
                messageRequest.Header.CSeq = 1;
                messageRequest.Header.CallId = CallProperties.CreateNewCallId();
                messageRequest.Body = message;
                messageRequest.Header.ContentType = "text/plain";

                await sipTransport.SendRequestAsync(messageRequest);
                LogEntry($"{DateTime.Now} : MESSAGE sent to {recipientUser}: {message}");
            }
            else
            {
                LogEntry($"{DateTime.Now} : User {recipientUser} not found in registeredUsers.");
            }
        }

        public static async Task SendTypedMessageToClient(SIPMethodsEnum type, string fromUser, string toUser, string message = "")
        {
            if (registeredUsers.TryGetValue(toUser, out var toUri))
            {
                LogEntry($"{DateTime.Now} : Sending {type} to {toUser} at {toUri}...");

                var messageRequest = SIPRequest.GetRequest(type, toUri);
                messageRequest.Header.From = new SIPFromHeader(fromUser, new SIPURI(fromUser, "127.0.0.1", null), null);
                messageRequest.Header.To = new SIPToHeader(toUser, toUri, "Tag");
                messageRequest.Header.CSeq = 1;
                messageRequest.Header.CallId = CallProperties.CreateNewCallId();
                messageRequest.Body = message;
                messageRequest.Header.ContentType = "text/plain";

                await sipTransport.SendRequestAsync(messageRequest);
                Console.WriteLine($"{DateTime.Now} : {type} sent to {toUser}: {message}");
            }
            else
            {
                LogEntry($"{DateTime.Now} : User {toUser} not found in registeredUsers.");
            }
        }

        static async Task Main(string[] args)
        {
            logger = AddConsoleLogger();
            Console.WriteLine("Starting SIP Signal Server...");

            var ips = Dns.GetHostAddresses(Dns.GetHostName());
            sipTransport = new SIPTransport();
            var sipUdpChannel = new SIPUDPChannel(new IPEndPoint(ips[1], 8081));
            var sipWsChannel = new SIPWebSocketChannel(ips[1], 8082);
            //sipTransport.AddSIPChannel(sipUdpChannel);
            Console.WriteLine(ips[1]);
            sipTransport.AddSIPChannel(sipWsChannel);

            sipTransport.SIPTransportRequestReceived += async (localEndPoint, remoteEndPoint, sipRequest) =>
            {
                LogEntry($"{DateTime.Now} : Received SIP request: {sipRequest.Method} from {remoteEndPoint}");

                if (sipRequest.Method == SIPMethodsEnum.REGISTER)
                {
                    var remoteAddress = remoteEndPoint.Address.ToString();
                    var remotePort = remoteEndPoint.Port;
                    var contactUri = new SIPURI(sipRequest.Header.From.FromURI.User, $"{remoteAddress}:{remotePort}", null);

                    registeredUsers[sipRequest.Header.From.FromURI.User] = contactUri;

                    var response = SIPResponse.GetResponse(sipRequest, SIPResponseStatusCodesEnum.Accepted, null);
                    await sipTransport.SendResponseAsync(response);


                    var message = CreateMessageToClient2(sipRequest.Header.From.FromURI.User, $"Message From {sipRequest.Header.From.FromURI} TO {sipRequest.Header.To.ToURI}", sipRequest);
                    await sipTransport.SendRequestAsync(message);

                    LogEntry($"{DateTime.Now} : REGISTER: {sipRequest.Header.From.FromURI.User} -> {contactUri}");
                }
                else if (sipRequest.Method == SIPMethodsEnum.MESSAGE)
                {
                    var caller = sipRequest.Header.From.FromURI.User;
                    var callee = sipRequest.Header.To.ToURI.User;
                    if (registeredUsers.TryGetValue(callee, out var calleeUri))
                    {
                        LogEntry($"MESSAGE: {caller} -> {callee}");

                        await SendMessageToClient(sipRequest.Header.To.ToURI.User, $"Message From {sipRequest.Header.From.FromURI} TO {sipRequest.Header.To.ToURI}");
                    }
                    else
                    {
                        var notFoundResponse = SIPResponse.GetResponse(sipRequest, SIPResponseStatusCodesEnum.NotFound, null);
                        await sipTransport.SendResponseAsync(notFoundResponse);
                    }

                }
                else if (sipRequest.Method == SIPMethodsEnum.NOTIFY)
                {
                    var caller = sipRequest.Header.From.FromURI.User;
                    var callee = sipRequest.Header.To.ToURI.User;
                    if (registeredUsers.TryGetValue(callee, out var calleeUri))
                    {
                        LogEntry($"{DateTime.Now} : NOTIFY: {caller} -> {callee}");
                        await SendTypedMessageToClient(SIPMethodsEnum.NOTIFY, sipRequest.Header.From.FromURI.User, sipRequest.Header.To.ToURI.User, sipRequest.Body);
                    }
                    else
                    {
                        var notFoundResponse = SIPResponse.GetResponse(sipRequest, SIPResponseStatusCodesEnum.NotFound, null);
                        await sipTransport.SendResponseAsync(notFoundResponse);
                    }
                    await SendTypedMessageToClient(SIPMethodsEnum.NOTIFY, sipRequest.Header.From.FromURI.User, sipRequest.Header.From.FromURI.User, sipRequest.Body);
                }
                else if (sipRequest.Method == SIPMethodsEnum.PUBLISH)
                {
                    var recipient = sipRequest.Header.To.ToURI.User;
                    if (registeredUsers.TryGetValue(recipient, out var recipientUri))
                    {
                        var messageRequest = SIPRequest.GetRequest(SIPMethodsEnum.MESSAGE, recipientUri);
                        messageRequest.Header.From = sipRequest.Header.From;
                        messageRequest.Header.To = new SIPToHeader(recipient, recipientUri, "Tag");
                        messageRequest.Body = sipRequest.Body;
                        messageRequest.Header.ContentType = "text/plain";

                        var okResponse = SIPResponse.GetResponse(sipRequest, SIPResponseStatusCodesEnum.Ok, null);
                        await sipTransport.SendResponseAsync(okResponse);

                        await sipTransport.SendRequestAsync(messageRequest);
                        LogEntry($"PUBLISH to {recipient}: {sipRequest.Body}");
                    }
                    else
                    {
                        var notFoundResponse = SIPResponse.GetResponse(sipRequest, SIPResponseStatusCodesEnum.NotFound, null);
                        await sipTransport.SendResponseAsync(notFoundResponse);
                    }

                }
                else if (sipRequest.Method == SIPMethodsEnum.BYE)
                {
                    var user = sipRequest.Header.From.FromURI.User;
                    registeredUsers.TryRemove(user, out _);
                    LogEntry($"{DateTime.Now} : BYE {user} ");
                    var okResponse = SIPResponse.GetResponse(sipRequest, SIPResponseStatusCodesEnum.Accepted, null);
                    await sipTransport.SendResponseAsync(okResponse);
                }
                else if (sipRequest.Method == SIPMethodsEnum.ACK)
                {
                    var remoteAddress = remoteEndPoint.Address.ToString();
                    var remotePort = remoteEndPoint.Port;
                    var contactUri = new SIPURI(sipRequest.Header.From.FromURI.User, $"{remoteAddress}:{remotePort}", null);

                    LogEntry($"{DateTime.Now} : ACK : {sipRequest.Header.From.FromURI.User} -> {sipRequest.Header.To.ToURI.User}");


                    var caller = sipRequest.Header.From.FromURI.User;
                    var callee = sipRequest.Header.To.ToURI.User;
                    if (registeredUsers.TryGetValue(callee, out var calleeUri))
                    {
                        //var okResponse = SIPResponse.GetResponse(sipRequest, SIPResponseStatusCodesEnum.Ok, null);
                        //await sipTransport.SendResponseAsync(okResponse);
                        LogEntry($"{DateTime.Now} : ACK callee: {caller} -> {callee}");

                        await SendTypedMessageToClient(SIPMethodsEnum.ACK, sipRequest.Header.From.FromURI.User, sipRequest.Header.To.ToURI.User, sipRequest.Body);
                    }
                    else
                    {
                        LogEntry($"{DateTime.Now} : ACK callee not found: {caller} -> {callee}");
                        var notFoundResponse = SIPResponse.GetResponse(sipRequest, SIPResponseStatusCodesEnum.NotFound, null);
                        await sipTransport.SendResponseAsync(notFoundResponse);
                    }


                }
                else if (sipRequest.Method == SIPMethodsEnum.INFO)
                {
                    var remoteAddress = remoteEndPoint.Address.ToString();
                    var remotePort = remoteEndPoint.Port;
                    var contactUri = new SIPURI(sipRequest.Header.From.FromURI.User, $"{remoteAddress}:{remotePort}", null);

                    LogEntry($"{DateTime.Now} : INFO: {sipRequest.Header.From.FromURI.User} -> {sipRequest.Header.To.ToURI.User}");


                    var caller = sipRequest.Header.From.FromURI.User;
                    var callee = sipRequest.Header.To.ToURI.User;
                    if (registeredUsers.TryGetValue(callee, out var calleeUri))
                    {
                        //var okResponse = SIPResponse.GetResponse(sipRequest, SIPResponseStatusCodesEnum.Ok, null);
                        //await sipTransport.SendResponseAsync(okResponse);
                        LogEntry($"{DateTime.Now} : INFO callee: {caller} -> {callee}");

                        await SendTypedMessageToClient(SIPMethodsEnum.INFO, sipRequest.Header.From.FromURI.User, sipRequest.Header.To.ToURI.User, sipRequest.Body);
                    }
                    else
                    {
                        LogEntry($"{DateTime.Now} : INFO callee not found: {caller} -> {callee}");
                        var notFoundResponse = SIPResponse.GetResponse(sipRequest, SIPResponseStatusCodesEnum.NotFound, null);
                        await sipTransport.SendResponseAsync(notFoundResponse);
                    }


                }

                else if (sipRequest.Method == SIPMethodsEnum.SERVICE)
                {
                    var remoteAddress = remoteEndPoint.Address.ToString();
                    var remotePort = remoteEndPoint.Port;
                    var contactUri = new SIPURI(sipRequest.Header.From.FromURI.User, $"{remoteAddress}:{remotePort}", null);

                    LogEntry($"{DateTime.Now} : SERVICE: {sipRequest.Header.From.FromURI.User} -> {sipRequest.Header.To.ToURI.User}");
                    var caller = sipRequest.Header.From.FromURI.User;
                    var callee = sipRequest.Header.To.ToURI.User;
                    if (registeredUsers.TryGetValue(callee, out var calleeUri))
                    {
                        LogEntry($"{DateTime.Now} : SERVICE callee: {caller} -> {callee}");
                        await SendTypedMessageToClient(SIPMethodsEnum.SERVICE, sipRequest.Header.From.FromURI.User, sipRequest.Header.To.ToURI.User, sipRequest.Body);
                    }
                    else
                    {
                        LogEntry($"{DateTime.Now} : SERVICE callee not found: {callee}");
                        var notFoundResponse = SIPResponse.GetResponse(sipRequest, SIPResponseStatusCodesEnum.NotFound, null);
                        await sipTransport.SendResponseAsync(notFoundResponse);
                    }


                }
                else
                {
                    LogEntry($"{DateTime.Now} : NOT IMPLEMETED MESSAGE TYPE  {sipRequest.Method}");
                    var notAllowedResponse = SIPResponse.GetResponse(sipRequest, SIPResponseStatusCodesEnum.MethodNotAllowed, null);
                    await sipTransport.SendResponseAsync(notAllowedResponse);
                }
            };

            Console.WriteLine("SIP Server listening on udp://0.0.0.0:8081 and ws://0.0.0.0:8082");
            _ = StartWebSocketServer();
            await Task.Delay(-1);
        }

        private static async Task StartWebSocketServer()
        {
            HttpListener httpListener = new HttpListener();
            httpListener.Prefixes.Add("http://192.168.0.114:8082/");
            httpListener.Start();
            Console.WriteLine("WebSocket server listening on ws://0.0.0.0:8082");

            while (true)
            {
                HttpListenerContext context = await httpListener.GetContextAsync();
                if (context.Request.IsWebSocketRequest)
                {
                    HttpListenerWebSocketContext wsContext = await context.AcceptWebSocketAsync(null);
                    _ = HandleWebSocketClient(wsContext.WebSocket);
                }
                else
                {
                    context.Response.StatusCode = 400;
                    context.Response.Close();
                }
            }
        }

        private static async Task HandleWebSocketClient(WebSocket webSocket)
        {
            var buffer = new byte[1024];
            while (webSocket.State == WebSocketState.Open)
            {
                var result = await webSocket.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None);
                if (result.MessageType == WebSocketMessageType.Text)
                {
                    string message = Encoding.UTF8.GetString(buffer, 0, result.Count);
                    Console.WriteLine($"WebSocket message received: {message}");
                }
            }
        }


        public static void LogEntry(string message)
        {
            Console.WriteLine(message);
            logger.LogInformation(message);
        }

        private static Microsoft.Extensions.Logging.ILogger AddConsoleLogger()
        {
            var logFilePath = $"logs/signaling_server_{DateTime.Now:yyyyMMdd_HHmmss}.txt";
            var seriLogger = new LoggerConfiguration()
                .Enrich.FromLogContext()
                .MinimumLevel.Is(Serilog.Events.LogEventLevel.Debug)
                .WriteTo.File(logFilePath) // This line replaces the incorrect Console method
                .CreateLogger();
            var factory = new SerilogLoggerFactory(seriLogger);
            SIPSorcery.LogFactory.Set(factory);
            return factory.CreateLogger<Program>();
        }
    }
}
