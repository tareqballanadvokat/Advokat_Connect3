using Microsoft.Extensions.Logging.Abstractions;
using System.Net;
using System.Text;
using WebRTCClient;

namespace Caller
{
    internal class Program
    {
        static WebRTCPeer UserAgent { get; set; }

        static void Main(string[] args)
        {
            _ = Task.Run(Run);

            while (true)
            {
            };
        }

        private async static void Run()
        {
            string callerName = "macc";
            IPEndPoint? callerEndpoint = new IPEndPoint(Dns.GetHostAddresses(Dns.GetHostName()).LastOrDefault(), 8098);

            string remoteName = "macs";

            IPEndPoint signalingServerEndpoint = new IPEndPoint(IPAddress.Loopback, 8009);

            Console.WriteLine($"caller name: {callerName}");
            Console.WriteLine($"caller endpoint: {callerEndpoint}");
            Console.WriteLine();
            Console.WriteLine($"remote name: {remoteName}");
            Console.WriteLine();
            Console.WriteLine($"signaling server endpoint: {signalingServerEndpoint}");
            Console.WriteLine("-----------------------------------------------------");

            Console.WriteLine("Enter to connect");
            Console.ReadLine();

            UserAgent = new WebRTCPeer(
                sourceUser: callerName,
                remoteUser: remoteName,
                sourceEndpoint: callerEndpoint,
                signalingServer: signalingServerEndpoint,
                iceServers: [],
                NullLoggerFactory.Instance
                );

            UserAgent.OnConnected += async sender =>
            {
                Console.WriteLine("connected.");
                while (true)
                {
                    await SendRequest();
                }
            };

            UserAgent.OnMessageReceived += async (IWebRTCPeer sender, byte[] message) =>
            {
                Console.WriteLine(Encoding.UTF8.GetString(message));
            };

            await UserAgent.Connect();

        }

        private async static Task SendRequest()
        {
            string uri = "/test";
            
            Console.WriteLine();
            Console.WriteLine($"Enter to send GET request to {uri}");
            Console.ReadLine();

            string requestString = """
                {
                	"Method": "Get",
                	"Uri": "/akten",
                	"Headers": {
                		"Host": "localhost",
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:141.0) Gecko/20100101 Firefox/141.0",
                        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                        "Accept-Language": "de,en-US;q=0.7,en;q=0.3",
                        "Accept-Encoding": "gzip, deflate, br, zstd",
                        "Connection": "keep-alive",
                        "Upgrade-Insecure-Requests": "1",
                        "Sec-Fetch-Dest": "document",
                        "Sec-Fetch-Mode": "navigate",
                        "Sec-Fetch-Site": "none",
                        "Sec-Fetch-User": "?1",
                        "Priority": "u=0, i",
                	},
                }
                """;
                    //"body": "{
                    //    "AktId": 12,
                    //    "AKurzLike": "abc",
                    //    "Count": 4,
                    //    "NurFavoriten": true,
                    //    "WithCausa": false,
                    //}"

            await UserAgent.SendMessageToPeer(requestString);
        }
    }
}
