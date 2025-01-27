//using System;
//using System.IO;
//using System.Net.WebSockets;
//using System.Text;
//using System.Threading.Tasks;
//using Microsoft.Extensions.Logging.Abstractions;
//using SIPSorcery.Net;
//using SIPSorceryMedia.Abstractions;
//using WebSocketSharp.Server;

//class Program
//{
//    private const int WEBSOCKET_PORT = 8081;
//    private const string IP = "ws://92.205.233.81:8081/";
//    private const string STUN_URL = "stun1.l.google.com";// "stun:stun.sipsorcery.com";
//    private const int JAVASCRIPT_SHA256_MAX_IN_SIZE = 65535;
//    private const int SHA256_OUTPUT_SIZE = 32;
//    private const int MAX_LOADTEST_COUNT = 100;

//    private static Microsoft.Extensions.Logging.ILogger logger = NullLogger.Instance;

//    private static uint _loadTestPayloadSize = 0;
//    private static int _loadTestCount = 0;
//    private static List<RTCDataChannel> rtcPeerConnections = new List<RTCDataChannel>();
//    static async Task Main(string[] args)
//    {
//        Console.WriteLine("WebRTC Server with DataChannel file transfer");

//        // Stwórz RTCPeerConnection
//        RTCConfiguration config = new RTCConfiguration
//        {
//            iceServers = new List<RTCIceServer> { new RTCIceServer { urls = STUN_URL } }
//        };

//        var peerConnection = new RTCPeerConnection(config);

//        // Utwórz DataChannel
//        var dataChannel = await peerConnection.createDataChannel("fileTransfer");
//        dataChannel.onopen += () =>
//        {
//            Console.WriteLine("DataChannel opened.");
//            SendFile(dataChannel, "example.txt"); // Wysyłanie pliku
//        };

 

//        //Obsłuż połączenie SDP(od peerów)
//        peerConnection.onicecandidate += async (rtcSessionDescription) =>
//        {
//            //rtcSessionDescription.candidate && ws.send(JSON.stringify(evt.candidate));

//            Console.WriteLine("Received SDP offer");
//            //await peerConnection.setRemoteDescription(rtcSessionDescription);
//            //var answer = peerConnection.createAnswer();
//            var answer = peerConnection.createOffer();
//            await peerConnection.setLocalDescription(answer);

//            // Wyświetl odpowiedź SDP, którą należy przesłać do klienta
//            Console.WriteLine("SDP Answer:");
//            Console.WriteLine(answer.sdp);
//        };
//        peerConnection.createDataChannel("dc1");


//        Uri uri = new(IP);

//        using SocketsHttpHandler handler = new();
//        using ClientWebSocket ws = new();
//        CancellationToken cancellationToken = new();
//        await ws.ConnectAsync(uri, new HttpMessageInvoker(handler), cancellationToken);

//        var bytes = new byte[1024];
//        System.Net.WebSockets.WebSocketReceiveResult result = await ws.ReceiveAsync(bytes, default);
//         await ws.SendAsync(bytes, WebSocketMessageType.Binary, true, cancellationToken);
//        string res = Encoding.UTF8.GetString(bytes, 0, result.Count);

//        await ws.CloseAsync(WebSocketCloseStatus.NormalClosure, "Client closed", default);
//        Console.WriteLine($"Result ({result.Count} bytes): {res}");

//        // Obsługa ICE Candidate
//        peerConnection.onicecandidate += (candidate) =>
//        {
//            if (candidate != null)
//            {
//                Console.WriteLine($"ICE Candidate: {candidate.candidate}");
//            }
//        };

//        Console.WriteLine("Server ready. Awaiting WebRTC connections...");
//        Console.ReadLine();
//    }

//    private static void SendFile(RTCDataChannel dataChannel, string filePath)
//    {
//        if (!File.Exists(filePath))
//        {
//            Console.WriteLine($"File {filePath} not found.");
//            return;
//        }

//        var fileBytes = File.ReadAllBytes(filePath);
//        const int chunkSize = 16384; // 16KB, max dla WebRTC DataChannel
//        int totalChunks = (int)Math.Ceiling((double)fileBytes.Length / chunkSize);

//        Console.WriteLine($"Sending file {filePath}, size {fileBytes.Length} bytes in {totalChunks} chunks.");

//        for (int i = 0; i < totalChunks; i++)
//        {
//            int offset = i * chunkSize;
//            int size = Math.Min(chunkSize, fileBytes.Length - offset);
//            var chunk = new byte[size];
//            Array.Copy(fileBytes, offset, chunk, 0, size);

//            dataChannel.send(chunk);
//            Console.WriteLine($"Sent chunk {i + 1}/{totalChunks}");
//        }

//        Console.WriteLine("File transfer completed.");
//    }
//}
