//using System;
//using System.Collections.Generic;
//using System.Linq;
//using System.Text;
//using System.Threading.Tasks;

//namespace OWA.Client;
//using System;
//using System.Linq;
//using System.Net.WebSockets;
//using System.Threading;
//using System.Threading.Tasks;
//using SIPSorcery.Net;
//using SIPSorceryMedia.Abstractions;
//using WebSocketSharp;
//using WebSocket = WebSocketSharp.WebSocket;

//class Program
//{
//    private const string IP = "ws://92.205.233.81:8081/";
//    private static ClientWebSocket _webSocket;
//    private static RTCPeerConnection _peerConnection;
//    private static WebSocket wss; 
//    static async Task Main(string[] args)
//    {  
//        wss = new WebSocket(IP);
//        wss.OnMessage += Wss_OnMessage;
//        Console.WriteLine("WebRTC Client using SIPSorcery with WebSocket signaling");

//        // Inicjalizacja połączenia WebSocket
//        _webSocket = new ClientWebSocket();// ("ws://your-signaling-server-address");
//        _webSocket.ConnectAsync(new Uri("ws://92.205.233.81:8081/"), CancellationToken.None);
        
 
    

    
//            Console.WriteLine("WebRTC Client using SIPSorcery (Data Channel)");

//        // Utwórz instancję WebRTC PeerConnection
//        var peerConnection = new RTCPeerConnection();

//        // Dodaj Data Channel
//        var dataChannel = await peerConnection.createDataChannel("myDataChannel");

//        // Obsługa zdarzeń Data Channel
//        dataChannel.onopen += () =>
//        {
//            Console.WriteLine("Data Channel is open!");

//            // Przykład wysyłania danych
//            dataChannel.send(Encoding.UTF8.GetBytes("Hello, WebRTC Server!"));
//        };

//        dataChannel.onmessage += (RTCDataChannel dc, DataChannelPayloadProtocols protocol, byte[] data) =>
//        {
//            Console.WriteLine($"Received message on Data Channel: {Encoding.UTF8.GetString(data)}");
//        };

//        dataChannel.onclose += () =>
//        {
//            Console.WriteLine("Data Channel closed.");
//        };

//        // Obsługa zdarzenia wymiany ICE
//        peerConnection.onicecandidate += (iceCandidate) =>
//        {
//            if (iceCandidate != null)
//            {
//                Console.WriteLine($"Generated ICE Candidate: {iceCandidate.ToString()}");
//                // Wysyłanie kandydatów ICE do serwera tutaj...
//            }
//            else
//            {
//                Console.WriteLine("All ICE candidates generated.");
//            }
//        };

//        // Obsługa negocjacji SDP
//        peerConnection.onconnectionstatechange += (state) =>
//        {
//            Console.WriteLine($"Connection state changed: {state}");
//        };

//        // Tworzenie lokalnej oferty SDP
//        var offer = peerConnection.createOffer(null);
//        await peerConnection.setLocalDescription(offer);

//        Console.WriteLine($"Local SDP Offer: {offer.sdp}");
//        // Wyślij ofertę SDP do serwera tutaj...

//        // Symulacja odbioru odpowiedzi SDP od serwera
//        Console.WriteLine("Waiting for SDP answer...");
//        string sdpAnswer = await ReceiveRemoteSDPAnswer();
//        var remoteSdp = SDP.ParseSDPDescription(sdpAnswer);
//        var sdp = new RTCSessionDescriptionInit { sdp = sdpAnswer, type = RTCSdpType.answer };
//        peerConnection.setRemoteDescription(sdp);

//        // Utrzymuj aplikację aktywną do celów testowych
//        Console.WriteLine("WebRTC Client is running. Press Ctrl+C to exit.");
//        var exitEvent = new ManualResetEvent(false);
//        Console.CancelKeyPress += (s, e) =>
//        {
//            e.Cancel = true;
//            exitEvent.Set();
//        };
//        exitEvent.WaitOne();
//    }

//    private static void Wss_OnMessage(object sender, MessageEventArgs e)
//    {
//        // Obsługa wiadomości otrzymanych z serwera sygnalizacyjnego
//        var message = Encoding.UTF8.GetString(e.RawData);
//        var json = Newtonsoft.Json.Linq.JObject.Parse(message);

//        if (json["type"]?.ToString() == "answer")
//        {
//            // Otrzymano odpowiedź SDP od serwera
//            var sdp = json["sdp"]?.ToString();

//            var remoteSdp = SDP.ParseSDPDescription(sdp);
//            var sdpInit = new RTCSessionDescriptionInit { sdp = sdp, type = RTCSdpType.answer };
//            _peerConnection.setRemoteDescription(sdpInit);
//        }
//        else if (json["type"]?.ToString() == "ice")
//        {
//            // Otrzymano kandydata ICE od serwera
//            var candidate = json["candidate"]?.ToString();
//            _peerConnection.addIceCandidate(new RTCIceCandidateInit { candidate = candidate });
//        }
//    }

//    private static void SendMessage(object message)
//    {
//        var json = Newtonsoft.Json.JsonConvert.SerializeObject(message);
//        wss.Send(json);
//      //  _webSocket.SendAsync(new byte[] { },WebSocketMessageType.Text,true, CancellationToken.None);
//    }


//    private static async Task<string> ReceiveRemoteSDPAnswer()
//    {
//        // Symulacja odpowiedzi SDP od serwera (to wymaga implementacji w twoim serwerze)
//        await Task.Delay(2000); // Czas oczekiwania
//        return @"v=0
//o=- 1234567890 2 IN IP4 127.0.0.1
//s=-
//t=0 0
//m=audio 5004 RTP/AVP 0
//c=IN IP4 127.0.0.1
//a=sendrecv";
//    }
//}