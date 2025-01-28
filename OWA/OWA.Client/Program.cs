using System;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using SIPSorcery.Net;
using WebSocketSharp;

class Program
{
    private static WebSocket _webSocket;
    private static RTCPeerConnection _peerConnection;
    private static RTCDataChannel dataChannel;
    private const string STUN_URL = "stun1.l.google.com";
    static async Task Main(string[] args)
    {
        string webSocketServerUrl = "ws://92.205.233.81:8081/";

       
        Func<Task<RTCPeerConnection>> createPeerConnection = async () =>
        {
            RTCConfiguration config = new RTCConfiguration
            {
                iceServers = new List<RTCIceServer> { new RTCIceServer { urls = STUN_URL } }
            };
            var peerConnection = new RTCPeerConnection(config);


            // Add Data Channel
            dataChannel = await peerConnection.createDataChannel("dc1");

            // Event Data Channel
            dataChannel.onopen += () =>
            {
                Console.WriteLine("Data Channel opened.");
                // Send data by Data Channel
            };

            dataChannel.onmessage += (RTCDataChannel dc, DataChannelPayloadProtocols protocol, byte[] data) =>
            {
                Console.WriteLine($"Message recived: {System.Text.Encoding.UTF8.GetString(data)}");
            };

            dataChannel.onclose += () =>
            {
                Console.WriteLine("Data Channel closed.");
            };

            // Obsługa kandydatów ICE
            peerConnection.onicecandidate += (RTCIceCandidate candidate) =>
            {
                if (candidate != null)
                {
                    Console.WriteLine($"New ICE Candidate: {candidate.candidate}");
                }
                else
                {
                    Console.WriteLine("All ICE Candidates generated");
                }
            };

            return peerConnection;
        };

        // Initialization WebRTCWebSocketClient
        var webSocketClient = new WebRTCWebSocketClient(webSocketServerUrl, createPeerConnection);

        var cancellationTokenSource = new CancellationTokenSource();

        // Comunication start
        await webSocketClient.Start(cancellationTokenSource.Token);

        Console.WriteLine("Press any key to close");
        Console.ReadKey();
        dataChannel.send("test message");
        cancellationTokenSource.Cancel();
    }
 

    private static void WebSocket_OnMessage(object sender, MessageEventArgs e)
    {
        var message = Encoding.UTF8.GetString(e.RawData);
        var json = Newtonsoft.Json.Linq.JObject.Parse(message);

        if (json["type"]?.ToString() == "answer")
        {
            // Receied answer SDP from server
            var sdp = json["sdp"]?.ToString();
            //var remoteSdp = SDP.ParseSDPDescription(sdp);
            //_peerConnection.setRemoteDescription(remoteSdp);
        }
        else if (json["type"]?.ToString() == "ice")
        {
            // Received ICE Candidates from server
            var candidate = json["candidate"]?.ToString();
            _peerConnection.addIceCandidate(new RTCIceCandidateInit { candidate = candidate });
        }
    }

    private static void SendMessage(object message)
    {
        var json = Newtonsoft.Json.JsonConvert.SerializeObject(message);
        _webSocket.Send(json);
    }
}