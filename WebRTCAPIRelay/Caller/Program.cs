using Microsoft.Extensions.Logging.Abstractions;
using System.Net;
using System.Text;
using System.Text.Json;
using WebRTCClient;
using WebRTCAPIRelay.DTOs;
using System.Security.Cryptography;

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
                // project reference to WebRtcApiRelay is only for DTOs here.
                var responseString = Encoding.UTF8.GetString(message);

                if (responseString.Contains("error"))
                {
                    var errorResponse = JsonSerializer.Deserialize<WebRTCErrorResponse>(message, new JsonSerializerOptions()
                    {
                        AllowTrailingCommas = true,
                        PropertyNameCaseInsensitive = true,
                        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull,
                        PropertyNamingPolicy = JsonNamingPolicy.KebabCaseLower
                    });

                    Console.WriteLine(Encoding.UTF8.GetString(message));
                    return;
                }

                var response = JsonSerializer.Deserialize<WebRTCResponse>(message, new JsonSerializerOptions()
                {
                    AllowTrailingCommas = true,
                    PropertyNameCaseInsensitive = true,
                    DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull,
                    PropertyNamingPolicy = JsonNamingPolicy.KebabCaseLower
                });

                Console.WriteLine(Encoding.UTF8.GetString(message));
                Console.WriteLine("---");
                Console.WriteLine(Encoding.UTF8.GetString(response.Payload.Body));
            };

            await UserAgent.Connect();
        }

        private async static Task SendRequest()
        {
            string uri = "/test";
            
            Console.WriteLine();
            Console.WriteLine($"Enter to send GET request to {uri}");
            Console.ReadLine();

            string guid = "079175de-6b75-4582-a2f8-64e776c60c44";
            string guidChecksum = Encoding.UTF8.GetString(MD5.HashData(Encoding.UTF8.GetBytes(guid)).Take(4).ToArray());

            string payload = """
                {
                    "timestamp": 1755511740818,
                    "method": "GET",
                    "uri": "/akten",
                    "Headers": {
                        "Content-Type":"application/json",
                        "Accept":"application/json"
                    },
                    "body": "ewogICAgICAgICAgICAgICAgICAgICAgICAiQWt0SWQiOiAxMiwKICAgICAgICAgICAgICAgICAgICAgICAgIkFLdXJ6TGlrZSI6ICJhYmMiLAogICAgICAgICAgICAgICAgICAgICAgICAiQ291bnQiOiA0LAogICAgICAgICAgICAgICAgICAgICAgICAiTnVyRmF2b3JpdGVuIjogdHJ1ZSwKICAgICAgICAgICAgICAgICAgICAgICAgIldpdGhDYXVzYSI6IGZhbHNlCiAgICAgICAgICAgICAgICAgICAgfQ=="
                  }
                """;

            byte[] checksum = MD5.HashData(Encoding.UTF8.GetBytes(payload));
            string checksumString = Convert.ToBase64String(checksum);

            string requestString = $$"""
                {
                  "checksum": "{{checksumString}}",
                  "id": "{{guid}}{{guidChecksum}}",
                  "request": {{ payload}}
                }
                """;

            await UserAgent.SendMessageToPeer(requestString);
        }
    }
}
