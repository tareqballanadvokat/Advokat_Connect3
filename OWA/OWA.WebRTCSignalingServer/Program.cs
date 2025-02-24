using System.Net.WebSockets;
using System.Text;
using SIPSorcery.Net;
using WebSocketState = System.Net.WebSockets.WebSocketState;

class Remote
{
    private static ClientWebSocket _wsClient = new ClientWebSocket();

    private static RTCPeerConnection _peerConnection;
    private static readonly string _clientId = "Remote"; // Identyfikator klienta

    static RTCDataChannel dataChannel;
    static async Task Main()
    {
        await _wsClient.ConnectAsync(new Uri("ws://92.205.233.81:8081/"), CancellationToken.None);
        Console.WriteLine("Remote połączony z serwerem sygnalizacyjnym.");
        RTCConfiguration config = new RTCConfiguration
        {
            iceServers = new List<RTCIceServer> {
                    new RTCIceServer { urls = "stun:freestun.net:3478" },
                    new RTCIceServer { urls = "stun:stun1.l.google.com:19302" },
                    new RTCIceServer { urls = "turn:freestun.net:3478", credential = "free", credentialType = RTCIceCredentialType.password, username = "free" }
                }
        };
        _peerConnection = new RTCPeerConnection(config);
        _peerConnection.onicecandidate += (candidate) =>
        {
            if (candidate != null)
            {
                SendSignal($"{{\"id\": \"{_clientId}\", \"ice\": \"{candidate.toJSON()}\"}}");
            }
        };

        _peerConnection.ondatachannel += (dc) =>
        {
            dataChannel = dc;
            Console.WriteLine("📡 Otrzymano Data Channel");

            // Obsługa zdarzeń DataChannel
            dataChannel.onopen += () => Console.WriteLine("✅ Data Channel opened.");
            dataChannel.onmessage += (dc, protocol, data) =>
                Console.WriteLine($"📩 Message received: {Encoding.UTF8.GetString(data)}");
            dataChannel.onclose += () => Console.WriteLine("❌ Data Channel closed.");
        };
        new Thread(async () =>
        {
            ReceiveSignal();

        }).Start();

        Console.WriteLine("Czekam na ofertę SDP od Callera...");
        Console.ReadLine();
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

            //if (message.Contains("\"sdp\""))
            //{
            //    var sdp = RTCSessionDescriptionInit.TryParse(message, out var initialization);
            //    _peerConnection.setRemoteDescription(initialization);

            //    var answer = _peerConnection.createAnswer(null);
            //    await _peerConnection.setLocalDescription(answer);
            //    SendSignal($"{{\"id\": \"{_clientId}\", \"sdp\": \"{answer.toJSON()}\"}}");
            //}

            if (message.Contains("\"sdp\""))
            {
                var sdp = RTCSessionDescriptionInit.TryParse(message, out var initialization);
                _peerConnection.setRemoteDescription(initialization);

                // Poczekaj na więcej ICE Candidates przed wysłaniem odpowiedzi
                await Task.Delay(1000);

                var answer = _peerConnection.createAnswer(null);
                await _peerConnection.setLocalDescription(answer);
                SendSignal($"{{\"id\": \"{_clientId}\", \"sdp\": \"{answer.toJSON()}\"}}");
            }
            else if (message.Contains("\"ice\""))
            {
                var data = message.Split("\"ice\": \"")[1].Split("\"}")[0];
                data += "\"}";
                try
                {
                    RTCIceCandidateInit.TryParse(data, out var iceCandidate);
                    _peerConnection.addIceCandidate(iceCandidate);
                }
                catch (Exception e)
                {
                    Console.WriteLine(e.Message);
                }
            }
        }
    }
}
