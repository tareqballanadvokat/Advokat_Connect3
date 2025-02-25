using System.Net;
using System.Net.WebSockets;
using System.Text;
using Newtonsoft.Json;
using SIPSorcery.Net;
using WebSocketSharp.Server;
using WebSocketState = System.Net.WebSockets.WebSocketState;

class Remote
{
    private static ClientWebSocket _wsClient = new ClientWebSocket();

    private static RTCPeerConnection _peerConnection;
    private static readonly string _clientId = "Remote"; // Identyfikator klienta
    static WebSocketServer webSocketServer;
    static RTCDataChannel dataChannel;
    static async Task Main()
    {
        await _wsClient.ConnectAsync(new Uri("ws://92.205.233.81:8081/"), CancellationToken.None);
        Console.WriteLine("Remote połączony z serwerem sygnalizacyjnym.");

        var ips = Dns.GetHostAddresses(Dns.GetHostName());
        var ip = ips.LastOrDefault();

        Console.WriteLine($"IP: {ip.ToString()}");
        webSocketServer = new WebSocketServer(ip, 9090); // true for secure connection
                                                         //webSocketServer.SslConfiguration.ServerCertificate = new X509Certificate2("path_to_certificate.pfx", "certificate_password");
        webSocketServer.AddWebSocketService<WebRTCWebSocketPeer>("/", (peer) =>
        {
            peer.CreatePeerConnection = CreatePeerConnection;
        });
        webSocketServer.Start();
        Console.WriteLine($"Waiting for web socket connections on {webSocketServer.Address}:{webSocketServer.Port}...");

        var localWS = new ClientWebSocket();
        await localWS.ConnectAsync(new Uri($"ws://{webSocketServer.Address}:{webSocketServer.Port}"), CancellationToken.None);

        new Thread(async () =>
        {
            ReceiveSignal();

        }).Start();


        new Thread(async () =>
        {
            Task.Delay(2000).Wait();
            AddIceCandidates();
        }).Start();
        new Thread(async () =>
        {

            Task.Delay(20000).Wait();
            dataChannel.send("server sended");
        }).Start();
        Console.WriteLine("Czekam na ofertę SDP od Callera...");
        Console.ReadLine();
    }

    private  static Task<RTCPeerConnection> CreatePeerConnection()
    {
        RTCConfiguration config = new RTCConfiguration
        {
            iceServers = new List<RTCIceServer> {
                    new RTCIceServer { urls = "stun:freestun.net:3478" },
                    new RTCIceServer { urls = "stun:stun1.l.google.com:19302" },
                    new RTCIceServer { urls = "turn:freestun.net:3478", credential = "free", credentialType = RTCIceCredentialType.password, username = "free" }
                }
        };

        var ps = new RTCPeerConnection(config);
        ps.onicecandidate += (candidate) =>
        {
            if (candidate != null)
            {
                string jsonCandidate = JsonConvert.SerializeObject(new { ice = candidate.toJSON(), type = "candidate" });
                SendSignal(jsonCandidate);
            }
        };

        ps.ondatachannel += (dc) =>
        {
            dataChannel = dc;
            Console.WriteLine("📡 Otrzymano Data Channel");

            // Obsługa zdarzeń DataChannel
            dataChannel.onopen += () => Console.WriteLine("✅ Data Channel opened.");
            dataChannel.onmessage += (dc, protocol, data) =>
                Console.WriteLine($"📩 Message received: {Encoding.UTF8.GetString(data)}");
            dataChannel.onclose += () => Console.WriteLine("❌ Data Channel closed.");
        };
        dataChannel = ps.createDataChannel("dc1").Result;
        _peerConnection = ps;
        return Task.FromResult( ps);
    }


    static async void SendSignal(string message)
    {

        Console.WriteLine($"[{_clientId}] Wysyłanie: {message}");
        var buffer = Encoding.UTF8.GetBytes(message);
        await _wsClient.SendAsync(new ArraySegment<byte>(buffer), WebSocketMessageType.Text, true, CancellationToken.None);
    }

    static async Task ReceiveSignal()
    {
        var buffer = new byte[1024];

        while (_wsClient.State == WebSocketState.Open)
        {
            var result = await _wsClient.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None);
            string message = Encoding.UTF8.GetString(buffer, 0, result.Count);
            Console.WriteLine($"[{_clientId}] Otrzymano: {message}");

            if (message.Contains("\"sdp\""))
            {
                var sdp = RTCSessionDescriptionInit.TryParse(message, out var initialization);
                _peerConnection.setRemoteDescription(initialization);

                var answer = _peerConnection.createAnswer(null);
                await _peerConnection.setLocalDescription(answer);
                //SendSignal($"{{\"id\": \"{_clientId}\", \"sdp\": \"{answer.toJSON()}\"}}");

                var sdpOfferJson = JsonConvert.SerializeObject(new { sdp = answer.sdp, type = "answer" });
                SendSignal(sdpOfferJson);
            }
            else if (message.Contains("\"ice\""))
            {

                var messageObject = CandidatesIncomming.Create(message);
                RTCIceCandidateInit.TryParse(messageObject.Ice, out var iceCandidate); 
                candidates.Add(iceCandidate);

                //{"ice":"{\"candidate\":\"candidate:1068029474 1 udp 2113937663 192.168.0.117 58456 typ host generation 0\",\"sdpMid\":\"0\",\"sdpMLineIndex\":0,\"usernameFragment\":\"OAPF\"}","type":"candidate"}
                _peerConnection.addIceCandidate(iceCandidate);
            }
        }
    }

    public static List<RTCIceCandidateInit> candidates = new List<RTCIceCandidateInit>();

    static void AddIceCandidates()
    {
        Console.WriteLine("Dodawanie ICE Candidates...");
        //foreach (var ice in candidates)
        //    _peerConnection.addIceCandidate(ice);
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
