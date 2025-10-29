using Microsoft.Extensions.Logging.Abstractions;
using System;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Advokat.WebRTC.Plugin.Chunking.DTOs;
using Advokat.WebRTC.Plugin.DTOs;
using WebRTCClient;

namespace Caller
{
    internal class Program
    {
        static WebRTCPeer UserAgent { get; set; }

        static async Task Main(string[] args)
        {
            //_ = Task.Run(Run);

            await Run();

            while (true)
            {
            };
        }

        private static string[]? Response = null;

        private async static Task Run()
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
                        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                    });

                    Console.WriteLine(Encoding.UTF8.GetString(message));
                    return;
                }

                WebRTCChunkAck? ack = null;
                try
                {
                    ack = JsonSerializer.Deserialize<WebRTCChunkAck>(message, new JsonSerializerOptions()
                    {
                        AllowTrailingCommas = true,
                        PropertyNameCaseInsensitive = true,
                        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull,
                        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
                    });

                    Console.WriteLine(Encoding.UTF8.GetString(message));
                    Console.WriteLine("+++");
                }
                catch
                {

                }

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
                    Console.WriteLine($"totalChunks: {response.Payload.TotalChunks}; currentChunk: {response.Payload.CurrentChunk}");
                    //Console.WriteLine("---");
                    //Console.WriteLine("base64 string: ", response.Payload.Body);

                    //Console.WriteLine(Encoding.UTF8.GetString(Convert.FromBase64String(response.Payload.Body)));
                }
                catch
                {
                    if (ack == null)
                    {
                        throw;
                    }

                    return;
                }

                if (response == null)
                {
                    throw new Exception();
                }

                //string ackBody = $$"""
                //{
                //    "timestamp": {{((DateTimeOffset)DateTime.UtcNow).ToUnixTimeMilliseconds()}},
                //    "chunk": {{((JsonElement)response.Payload).GetProperty("currentChunk").GetInt32()}}
                //}
                //""";
                //string responseAck = $$"""
                //{
                //  "checksum": "{{Convert.ToBase64String(MD5.HashData(Encoding.UTF8.GetBytes(ackBody)))}}",
                //  "id": "{{response.Id}}",
                //  "body": {{ackBody}}
                //}
                //""";

                //await sender.SendMessageToPeer(responseAck);

                //if (Response == null)
                //{
                //    Response = new string[((JsonElement)response.Payload).GetProperty("totalChunks").GetInt32()];
                //}

                //Response[((JsonElement)response.Payload).GetProperty("currentChunk").GetInt32() - 1] = ((JsonElement?)response?.Payload)?.GetProperty("body").GetString();




                string ackBody = $$"""
                {
                    "timestamp": {{((DateTimeOffset)DateTime.UtcNow).ToUnixTimeMilliseconds()}},
                    "chunk": {{response.Payload.CurrentChunk}}
                }
                """;
                string responseAck = $$"""
                {
                  "checksum": "{{Convert.ToBase64String(MD5.HashData(Encoding.UTF8.GetBytes(ackBody)))}}",
                  "id": "{{response.Id}}",
                  "body": {{ackBody}}
                }
                """;

                await sender.SendMessageToPeer(responseAck);
                Console.WriteLine($"confirmed: {response.Payload.CurrentChunk}");

                if (Response == null)
                {
                    Response = new string[response.Payload.TotalChunks];
                }

                //Response[response.Payload.CurrentChunk - 1] = response.Payload?.Body;
                Response[response.Payload.CurrentChunk - 1] = "yes";



                if (Response.All(c => c != null))
                {
                    Console.WriteLine("ooo");
                    //Console.WriteLine(Encoding.UTF8.GetString(Convert.FromBase64String(string.Join("", Response))));
                    Console.WriteLine("Done");

                    Console.WriteLine("ooo");

                    Response = null;
                }
            };

            await UserAgent.Connect();
        }

        private async static Task SendRequest()
        {
            string guid = Guid.NewGuid().ToString();
            string uri = "/akten";
            //string uri = "/connect/token";
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

            byte[] calculatedHash = MD5.HashData(Encoding.UTF8.GetBytes(guid));
;
            StringBuilder calculatedChecksum = new StringBuilder();
            foreach (byte h in calculatedHash[..2])
            {
                calculatedChecksum.Append(h.ToString("x2"));
            }

            string guidChecksum = calculatedChecksum.ToString();

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
            ];

            for (int i = 1; i <= chunks.Count; i++)
            {
                await SendMessage(guid, guidChecksum, method, uri, headers, chunks.Count, i, chunks[i - 1]);
            }
        }

        private async static Task SendMessage(string guid, string guidChecksum, string method, string uri, string headers, int totalChunks, int currentChunk, string body)
        {
            string payload = $$"""
                {
                    "timestamp": {{((DateTimeOffset)DateTime.UtcNow).ToUnixTimeMilliseconds()}},
                    "totalChunks": {{totalChunks}},
                    "currentChunk": {{currentChunk}},
                    "method": "{{method}}",
                    "uri": "{{uri}}",
                    "Headers": {{headers}},
                    "body": "{{body}}"
                  }
                """;

            byte[] checksum = MD5.HashData(Encoding.UTF8.GetBytes(payload));
            string checksumString = Convert.ToBase64String(checksum);

            string requestString = $$"""
                {
                  "checksum": "{{checksumString}}",
                  "id": "{{guid}}{{guidChecksum}}",
                  "messageType": "testmessagetype",
                  "request": {{payload}}
                }
                """;

            await UserAgent.SendMessageToPeer(requestString);
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