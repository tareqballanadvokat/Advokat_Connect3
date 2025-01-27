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
    private const string STUN_URL = "stun1.l.google.com";// "stun:stun.sipsorcery.com";
    static async Task Main(string[] args)
    {
        string webSocketServerUrl = "ws://92.205.233.81:8081/";

        // Funkcja tworząca RTCPeerConnection
        Func<Task<RTCPeerConnection>> createPeerConnection = async () =>
        {       
            RTCConfiguration config = new RTCConfiguration
            {
                iceServers = new List<RTCIceServer> { new RTCIceServer { urls = STUN_URL } }
                };
            var peerConnection = new RTCPeerConnection(config);


            // Dodaj Data Channel
            dataChannel = await peerConnection.createDataChannel("dc1");

            // Obsługa zdarzeń Data Channel
            dataChannel.onopen += () =>
            {
                Console.WriteLine("Data Channel otwarty.");
                // Możesz tutaj wysłać dane przez Data Channel
            };

            dataChannel.onmessage += (RTCDataChannel dc, DataChannelPayloadProtocols protocol, byte[] data) =>
            {
                Console.WriteLine($"Otrzymano wiadomość: {System.Text.Encoding.UTF8.GetString(data)}");
            };

            dataChannel.onclose += () =>
            {
                Console.WriteLine("Data Channel zamknięty.");
            };

            // Obsługa kandydatów ICE
            peerConnection.onicecandidate += (RTCIceCandidate candidate) =>
            {
                if (candidate != null)
                {
                    Console.WriteLine($"Nowy kandydat ICE: {candidate.candidate}");
                }
                else
                {
                    Console.WriteLine("Wszystkie kandydaty ICE zostały wygenerowane.");
                }
            };

            return peerConnection;
        };

        // Inicjalizacja WebRTCWebSocketClient
        var webSocketClient = new WebRTCWebSocketClient(webSocketServerUrl, createPeerConnection);

        // Token anulowania
        var cancellationTokenSource = new CancellationTokenSource();

        // Rozpoczęcie komunikacji
        await webSocketClient.Start(cancellationTokenSource.Token);
     
        // Utrzymuj aplikację aktywną
        Console.WriteLine("Naciśnij dowolny klawisz, aby zakończyć...");
        Console.ReadKey();
        dataChannel.send("newnewnewnew");
        cancellationTokenSource.Cancel();
    }

    //static async Task Main(string[] args)
    //{
    //    Console.WriteLine("WebRTC Client using SIPSorcery with WebSocket signaling");
    //    WebRTCWebSocketClient client = new WebRTCWebSocketClient("ws://92.205.233.81:8081/", new Func<Task<RTCPeerConnection>>);


    //    // Inicjalizacja połączenia WebSocket
    //    _webSocket = new WebSocket("ws://92.205.233.81:8081/");
    //    _webSocket.OnMessage += WebSocket_OnMessage;
    //    _webSocket.Connect();

    //    // Utwórz instancję WebRTC PeerConnection
    //    RTCConfiguration config = new RTCConfiguration
    //    {
    //        iceServers = new List<RTCIceServer> { new RTCIceServer { urls = STUN_URL } }
    //    };

    //    _peerConnection = new RTCPeerConnection(config);



    //    // Dodaj Data Channel
    //    var dataChannel = _peerConnection.createDataChannel("dc1");

    //    //// Obsługa zdarzeń Data Channel
    //    //dataChannel.onopen += () =>
    //    //{
    //    //    Console.WriteLine("Data Channel is open!");

    //    //    // Przykład wysyłania danych
    //    //    string message = "Hello, WebRTC Server!";
    //    //    dataChannel.send(Encoding.UTF8.GetBytes(message));
    //    //    Console.WriteLine($"Sent: {message}");
    //    //};

    //    //dataChannel.onmessage += (byte[] msg) =>
    //    //{
    //    //    Console.WriteLine($"Received message on Data Channel: {Encoding.UTF8.GetString(msg)}");
    //    //};

    //    //dataChannel.onclose += () =>
    //    //{
    //    //    Console.WriteLine("Data Channel closed.");
    //    //};

    //    // Obsługa zdarzenia wymiany ICE
    //    _peerConnection.onicecandidate += (iceCandidate) =>
    //    {
    //        if (iceCandidate != null)
    //        {
    //            Console.WriteLine($"Generated ICE Candidate: {iceCandidate.ToString()}");
    //            // Wysyłanie kandydatów ICE do serwera
    //            SendMessage(new { type = "ice", candidate = iceCandidate.ToString() });
    //        }
    //        else
    //        {
    //            Console.WriteLine("All ICE candidates generated.");
    //        }
    //    };

    //    // Obsługa zmian stanu połączenia
    //    _peerConnection.onconnectionstatechange += (state) =>
    //    {
    //        Console.WriteLine($"Connection state changed: {state}");
    //    };

    //    // Tworzenie lokalnej oferty SDP
    //    var offer = _peerConnection.createOffer(null);
    //    await _peerConnection.setLocalDescription(offer);

    //    Console.WriteLine($"Local SDP Offer: {offer.sdp}");
    //    // Wyślij ofertę SDP do serwera
    //    //SendMessage(new { type = "offer", sdp = offer.sdp });
    //    SendMessage(new { type = "answer", sdp = offer.sdp });

    //    // Utrzymuj aplikację aktywną do celów testowych
    //    Console.WriteLine("WebRTC Client is running. Press Ctrl+C to exit.");
    //    var exitEvent = new ManualResetEvent(false);
    //    Console.CancelKeyPress += (s, e) =>
    //    {
    //        e.Cancel = true;
    //        exitEvent.Set();
    //    };
    //    exitEvent.WaitOne();
    //}

    private static void WebSocket_OnMessage(object sender, MessageEventArgs e)
    {
        // Obsługa wiadomości otrzymanych z serwera sygnalizacyjnego
        var message = Encoding.UTF8.GetString(e.RawData);
        var json = Newtonsoft.Json.Linq.JObject.Parse(message);

        if (json["type"]?.ToString() == "answer")
        {
            // Otrzymano odpowiedź SDP od serwera
            var sdp = json["sdp"]?.ToString();
            //var remoteSdp = SDP.ParseSDPDescription(sdp);
            //_peerConnection.setRemoteDescription(remoteSdp);
        }
        else if (json["type"]?.ToString() == "ice")
        {
            // Otrzymano kandydata ICE od serwera
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