using System;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using Newtonsoft.Json;
using SIPSorcery.Net;

class Caller
{
    private static ClientWebSocket _wsClient = new ClientWebSocket();

    private static RTCPeerConnection _peerConnection;
    private static readonly string _clientId = "Caller";

    static async Task Main()
    {
        RTCConfiguration config = new RTCConfiguration
        {
            iceServers = new List<RTCIceServer> {
                    new RTCIceServer { urls = "stun:freestun.net:3478" },
                    new RTCIceServer { urls = "stun:stun1.l.google.com:19302" },
                    new RTCIceServer { urls = "turn:freestun.net:3478", credential = "free", credentialType = RTCIceCredentialType.password, username = "free" }
                }
        };
        _peerConnection = new RTCPeerConnection(config);
        await _wsClient.ConnectAsync(new Uri("ws://92.205.233.81:8081/"), CancellationToken.None);
        Console.WriteLine("Caller połączony z serwerem sygnalizacyjnym.");

        // Data Channel
        var dataChannel = await _peerConnection.createDataChannel("dc1");
        dataChannel.onopen += () => Console.WriteLine("Data Channel opened.");
        dataChannel.onmessage += (dc, protocol, data) =>
            Console.WriteLine($"Message received: {Encoding.UTF8.GetString(data)}");
        dataChannel.onclose += () => Console.WriteLine("Data Channel closed.");
 
        _peerConnection.onicecandidate += (candidate) =>
        {
            Console.WriteLine("onicecandidate invoked.");
            if (candidate != null)
            {
                string jsonCandidate = JsonConvert.SerializeObject(new { ice = candidate.toJSON(), type = "candidate" });
                //      SendSignal(jsonCandidate);
                sendCandidates.Add(jsonCandidate);
            }
        };

        _peerConnection.onnegotiationneeded += async () =>
        {
            Console.WriteLine("Negotiation needed.");
            //var offer = _peerConnection.createOffer(null);
            //_peerConnection.setLocalDescription(offer);
            //SendSignal($"{{\"id\": \"{_clientId}\", \"sdp\": \"{offer.toJSON()}\"}}");

        };

        await CreateAndSendOffer();

        new Thread(async () =>
        {
            ReceiveSignal();

        }).Start();
        new Thread(async () =>
        {
            Task.Delay(2000).Wait();
            AddIceCandidates();
            SendIceCandidates();
        }).Start();
        new Thread(async () =>
        {
            Task.Delay(20000).Wait();
            dataChannel.send("client sended");
        }).Start();
        Console.WriteLine("Naciśnij ENTER, aby rozpocząć połączenie...");
        Console.ReadLine(); 
    }

    private static async Task CreateAndSendOffer()
    {
        var offer = _peerConnection.createOffer(null);
        await _peerConnection.setLocalDescription(offer);

        Console.WriteLine("SDP Offer Created:");
        Console.WriteLine(offer.sdp);

        var sdpOfferJson = JsonConvert.SerializeObject(new { sdp = offer.sdp, type = "offer" });
        SendSignal(sdpOfferJson);
    }
    static async void SendSignal(string message)
    {
        Console.WriteLine($"[{_clientId}] Wysyłanie: {message}");
        var buffer = Encoding.UTF8.GetBytes(message);
        await _wsClient.SendAsync(new ArraySegment<byte>(buffer), WebSocketMessageType.Text, true, CancellationToken.None);
    }
    public static List<RTCIceCandidateInit> candidatesInit = new List<RTCIceCandidateInit>();
    public static List<string> sendCandidates = new List<string>();

    static async Task ReceiveSignal()
    {
        var buffer = new byte[1024];

        while (_wsClient.State == System.Net.WebSockets.WebSocketState.Open)
        {
            var result = await _wsClient.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None);
            string message = Encoding.UTF8.GetString(buffer, 0, result.Count);
            Console.WriteLine($"[{_clientId}] Otrzymano: {message}");

            if (message.Contains("\"sdp\""))
            {
                var sdp = RTCSessionDescriptionInit.TryParse(message, out var initialization);
                _peerConnection.setRemoteDescription(initialization);
            }
            else if (message.Contains("\"ice\""))
            {
                var messageObject  = CandidatesIncomming.Create(message);

                RTCIceCandidateInit.TryParse(messageObject.Ice, out var iceCandidate);
                candidatesInit.Add(iceCandidate);
                //_peerConnection.addIceCandidate(iceCandidate);
            }
        }
    }

    static void AddIceCandidates()
    {
        Console.WriteLine("Dodawanie ICE Candidates...");
        foreach (var ice in candidatesInit)
        _peerConnection.addIceCandidate(ice);
    }
    static void SendIceCandidates()
    {
        Console.WriteLine("Dodawanie ICE Candidates...");
        foreach (var ice in sendCandidates)
        {
           // string jsonCandidate = JsonConvert.SerializeObject(new { ice = candidate.toJSON(), type = "candidate" });
            SendSignal(ice);
        }
    }
}

public class CandidatesIncomming
{
    public string Type { get; set; }

    public string Ice { get; set; }
    public static CandidatesIncomming Create(string input)
    {
        return JsonConvert.DeserializeObject<CandidatesIncomming>(input);
    }
}
