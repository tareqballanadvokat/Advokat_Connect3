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
            string callerName = "caller";
            IPEndPoint? callerEndpoint = new IPEndPoint(Dns.GetHostAddresses(Dns.GetHostName()).LastOrDefault(), 8098);

            string remoteName = "remote";

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
            //string uri = "localhost:5183/test";
            string uri = "/test";
            
            Console.WriteLine();
            Console.WriteLine($"Enter to send GET request to {uri}");
            Console.ReadLine();

            HttpRequestMessage request = new HttpRequestMessage(HttpMethod.Get, uri);

            string requestString = await ToRawString(request); // Check if this is the entire method

            await UserAgent.SendMessageToPeer(requestString);
        }

        private static async Task<string> ToRawString(HttpRequestMessage request)
        {
            var sb = new StringBuilder();

            var line1 = $"{request.Method} {request.RequestUri} HTTP/{request.Version}";
            sb.AppendLine(line1);

            foreach (var (key, value) in request.Headers)
                foreach (var val in value)
                {
                    var header = $"{key}: {val}";
                    sb.AppendLine(header);
                }

            if (request.Content?.Headers != null)
            {
                foreach (var (key, value) in request.Content.Headers)
                    foreach (var val in value)
                    {
                        var header = $"{key}: {val}";
                        sb.AppendLine(header);
                    }
            }
            sb.AppendLine();

            var body = await (request.Content?.ReadAsStringAsync() ?? Task.FromResult<string>(null));
            if (!string.IsNullOrWhiteSpace(body))
                sb.AppendLine(body);

            return sb.ToString();
        }
    }
}
