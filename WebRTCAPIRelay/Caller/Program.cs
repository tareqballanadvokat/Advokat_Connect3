using Advokat.WebRTC.Client.Interfaces;
using Advokat.WebRTC.Client.Utils;
using Advokat.WebRTC.Plugin.Chunking.DTOs;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using SIPSorcery.Net;
using System.Net;
using System.Text;
using System.Text.Json;
using WebRTCClient;


namespace Caller
{
    internal class Program
    {
        static WebRTCPeer UserAgent { get; set; }

        static P2PConnection? DirectConnection { get; set; }

        private static bool Running { get; set; }

        static IPEndPoint SignalingServer { get; set; }

        static List<RTCIceServer> IceServers { get; set; } = [];

        static string CallerName { get; set; }

        static string RemoteName { get; set; }

        static async Task Main(string[] args)
        {
            ReadConfig();
            await Run();

            while (true)
            {
            };
        }

        private static string[]? Response = null;

        static void ReadConfig()
        {
            IConfigurationBuilder configuration = new ConfigurationBuilder()
                .SetBasePath(Directory.GetCurrentDirectory())
                .AddJsonFile($"appsettings.json");

            IConfiguration config = configuration.Build();

            try
            {
                ReadSignalingServer(config);
                ReadIceServers(config);
                ReadNames(config);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Cannot Start Caller. {ex.Message}");
                Environment.Exit(-1);
                return;
            }
        }

        static void ReadSignalingServer(IConfiguration config)
        {
            string? signalingServer = config.GetValue<string>("signalingServer")
                ?? throw new Exception("No valid signalignServer provided");

            SignalingServer = IPEndPoint.Parse(signalingServer);
        }

        static void ReadIceServers(IConfiguration config)
        {
            IceServers = config.GetValue<IEnumerable<string>>("iceServers")?
                .Select(s => new RTCIceServer() { urls = s })
                ?.ToList() ?? [];
        }

        static void ReadNames(IConfiguration config)
        {
            CallerName = config.GetValue<string>("caller")
                ?? throw new Exception("No valid caller provided");

            RemoteName = config.GetValue<string>("remote")
                ?? throw new Exception("No valid remote provided");
        }

        private async static Task Run()
        {
            IPEndPoint? callerEndpoint = new IPEndPoint(Dns.GetHostAddresses(Dns.GetHostName()).LastOrDefault(), 8098);

            ILoggerFactory loggerFactory = LoggerFactory.Create(
               (builder) => {
                   builder.SetMinimumLevel(LogLevel.Debug);
                   builder.AddConsole((options) => options.TimestampFormat = "[HH:mm:ss:ffff] ");
                   //builder.AddDebug();
               });

            SIPSorcery.LogFactory.Set(loggerFactory);

            Console.WriteLine($"caller name: {CallerName}");
            Console.WriteLine($"caller endpoint: {callerEndpoint}");
            Console.WriteLine();
            Console.WriteLine($"remote name: {RemoteName}");
            Console.WriteLine();
            Console.WriteLine($"signaling server endpoint: {SignalingServer}");
            Console.WriteLine("-----------------------------------------------------");

            Console.WriteLine("Enter to connect");
            Console.ReadLine();

            UserAgent = new WebRTCPeer(
                sourceUser: CallerName,
                remoteUser: RemoteName,
                sourceEndpoint: callerEndpoint,
                signalingServer: SignalingServer,
                isOffering: true,
                iceServers: IceServers,
                loggerFactory
                );

            //UserAgent.WebRTCConfig.SIPClientConfig.ConnectionTimeout = 10000;
            //UserAgent.WebRTCConfig.SIPClientConfig.ReceiveTimeout = 10000;
            //UserAgent.WebRTCConfig.SIPClientConfig.SIPPeerConnectionTimout = 10000;

            UserAgent.DirectConnectionEstablished += async (object? sender, DirectConnectionEventArgs e)  =>
            {
                DirectConnection = e.P2PConnection;
                Console.WriteLine("connected.");

                //// automatic disconnect
                //await Task.Delay(100);

                //Console.WriteLine("Disconnecting");
                //await UserAgent.Disconnect();

                //await Task.Delay(3000);

                //Console.WriteLine("Enter to reconnect");
                //Console.ReadLine();

                //await UserAgent.Connect();

                //// automatic reconnect done

                if (!Running)
                {
                    while (true)
                    {
                        Running = true;
                        await SendRequest();
                    }
                }

                DirectConnection.OnMessageReceived += async (P2PConnection sender, byte[] message) =>
                {
                    // project reference to WebRtcApiRelay is only for DTOs here.
                    var responseString = Encoding.UTF8.GetString(message);

                    if (responseString.Contains("error"))
                    {
                        var errorResponse = JsonSerializer.Deserialize<WebRTCErrorResponse>(message, new JsonSerializerOptions()
                        {
                            AllowTrailingCommas = true,
                            PropertyNameCaseInsensitive = true,
                            DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull,
                            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                        });

                        Console.WriteLine(Encoding.UTF8.GetString(message));
                        return;
                    }

                    //Console.WriteLine(Encoding.UTF8.GetString(message));
                    Console.WriteLine("+++");

                    WebRTCResponseChunk? response;
                    try
                    {
                        response = JsonSerializer.Deserialize<WebRTCResponseChunk>(message, new JsonSerializerOptions()
                        {
                            AllowTrailingCommas = true,
                            PropertyNameCaseInsensitive = true,
                            DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull,
                            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
                        });
                        //Console.WriteLine(Encoding.UTF8.GetString(message));
                        Console.WriteLine($"totalChunks: {response.TotalChunks}; currentChunk: {response.CurrentChunk}");
                        //Console.WriteLine("---");
                        //Console.WriteLine("base64 string: ", response.Payload.Body);

                        //Console.WriteLine(Encoding.UTF8.GetString(Convert.FromBase64String(response.Payload.Body)));
                    }
                    catch
                    {
                        return;
                    }

                    if (response == null)
                    {
                        throw new Exception();
                    }

                    if (Response == null)
                    {
                        Response = new string[response.TotalChunks];
                    }

                    Response[response.CurrentChunk - 1] = response.Body;
                    //Response[response.CurrentChunk - 1] = "yes";



                    if (Response.All(c => c != null))
                    {
                        Console.WriteLine("ooo");
                        Console.WriteLine(Encoding.UTF8.GetString(Convert.FromBase64String(string.Join("", Response))));
                        //Console.WriteLine("Done");

                        Console.WriteLine("ooo");

                        Response = null;
                    }
                };

            };

            await UserAgent.Connect();
        }

        private async static Task SendRequest()
        {

            string? input = Console.ReadLine();
            if (input == "c")
            {
                Console.WriteLine("Connecting");
                await UserAgent.Connect();
                return;
            }

            else if (input == "d")
            {
                Console.WriteLine("Disconnecting");
                await UserAgent.Disconnect();
                return;
            }

            else if (input == "close")
            {
                await UserAgent.DisposeAsync();
                Environment.Exit(0);
            }


            string guid = Guid.NewGuid().ToString();
            //string uri = "/akten";
            string uri = "/connect/token";
            string method = "POST";
            string headers = """
                {
                    "Content-Type":"application/json",
                    "Accept":"application/json"
                }
                """;
            
            Console.WriteLine();
            Console.WriteLine($"Enter to send GET request to {uri}");
            
            Console.ReadLine();

            List<string> chunks = [
                "eyJncmFudF90e",
                "XBlIjoicGFzc3",
                "dvcmQiLCJjbGllbnRfaWQiOiJhZH",
                "Zva2F0LmNsaWVudC5",
                "3ZWIiLCJjbGllbnRfc2VjcmV0IjoiYWR2",
                "b2thdCIsInVzZXJu",
                "YW1lIjoiSkNIIiwicGFzc3dvc",
                "mQiO",
                "iIif",
                "Q=="

                //"eyJncmFudF90eXBlIjoicGFzc3dvcmQiLCJjbGllbnRfaWQiOiJhZHZva2F0LmNsaWVudC53ZWIiLCJjbGllbnRfc2VjcmV0IjoiYWR2b2thdCIsInVzZXJuYW1lIjoiSkNIIiwicGFzc3dvcmQiOiIifQ=="
            ];

            for (int i = 1; i <= chunks.Count; i++)
            {
                SendMessage(guid, method, uri, headers, chunks.Count, i, chunks[i - 1]);
            }
        }

        private async static void SendMessage(string guid, string method, string uri, string headers, int totalChunks, int currentChunk, string body)
        {
            if (DirectConnection != null)
            {
                string requestString = $$"""
                    {
                        "id": "{{guid}}",
                        "messageType": "testmessagetype",
                        "timestamp": {{((DateTimeOffset)DateTime.UtcNow).ToUnixTimeMilliseconds()}},
                        "totalChunks": {{totalChunks}},
                        "currentChunk": {{currentChunk}},
                        "method": "{{method}}",
                        "uri": "{{uri}}",
                        "headers": {{headers}},
                        "body": "{{body}}"
                      }
                    """;

                Console.WriteLine($"Sending Chunk {currentChunk}");

                DirectConnection.SendMessage(requestString);
            }
        }
    }
}

//requestString = """
//    {
//        "checksum": "/qiexFpUhOxADHRr6rbToA==",
//        "id": "f87fd296-e36a-48f6-8e19-318cca0a4aceba0c",
//        "isMultipart": false,
//        "request": {
//            "timestamp": 1758092677449,
//            "totalChunks": 0,
//            "currentChunk": 0,
//            "method": "POST",
//            "uri": "connect/token",
//            "headers": {
//                "Content-Type": "application/json",
//                "Accept": "application/json"
//            },
//            "body": "eyJncmFudF90eXBlIjoicGFzc3dvcmQiLCJjbGllbnRfaWQiOiJhZHZva2F0LmNsaWVudC53ZWIiLCJ jbGllbnRfc2VjcmV0IjoiYWR2b2thdCIsInVzZXJuYW1lIjoiSkNIIiwicGFzc3dvcmQiOiIifQ=="
//        }
//    }
//    """;