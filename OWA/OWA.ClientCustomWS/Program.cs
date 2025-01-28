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
    private const string STUN_URL = "stun:stun1.l.google.com";// "stun:stun.sipsorcery.com";
    static async Task Main(string[] args)
    {
        Console.WriteLine("WebRTC Client using SIPSorcery with WebSocket signaling");

        // Inicjalizacja połączenia WebSocket
        _webSocket = new WebSocket("ws://92.205.233.81:8081/");
        _webSocket.OnMessage += WebSocket_OnMessage;
        _webSocket.Connect();

        // Utwórz instancję WebRTC PeerConnection
        RTCConfiguration config = new RTCConfiguration
        {
            iceServers = new List<RTCIceServer> { new RTCIceServer { urls = STUN_URL } }
        };

        _peerConnection = new RTCPeerConnection(config);



        // Dodaj Data Channel
        var dataChannel = _peerConnection.createDataChannel("dc1");

        //// Obsługa zdarzeń Data Channel
        //dataChannel.onopen += () =>
        //{
        //    Console.WriteLine("Data Channel is open!");

        //    // Przykład wysyłania danych
        //    string message = "Hello, WebRTC Server!";
        //    dataChannel.send(Encoding.UTF8.GetBytes(message));
        //    Console.WriteLine($"Sent: {message}");
        //};

        //dataChannel.onmessage += (byte[] msg) =>
        //{
        //    Console.WriteLine($"Received message on Data Channel: {Encoding.UTF8.GetString(msg)}");
        //};

        //dataChannel.onclose += () =>
        //{
        //    Console.WriteLine("Data Channel closed.");
        //};

        // Obsługa zdarzenia wymiany ICE
        _peerConnection.onicecandidate += (iceCandidate) =>
        {
            if (iceCandidate != null)
            {
                Console.WriteLine($"Generated ICE Candidate: {iceCandidate.ToString()}");
                // Wysyłanie kandydatów ICE do serwera
                SendMessage(new { type = "ice", candidate = iceCandidate.ToString() });
            }
            else
            {
                Console.WriteLine("All ICE candidates generated.");
            }
        };

        // Obsługa zmian stanu połączenia
        _peerConnection.onconnectionstatechange += (state) =>
        {
            Console.WriteLine($"Connection state changed: {state}");
        };

        // Tworzenie lokalnej oferty SDP
        RTCOfferOptions offferOption = new RTCOfferOptions() { };
        var offer = _peerConnection.createOffer(null);
        var offer1 = new RTCSessionDescriptionInit
        {
            type = RTCSdpType.offer,
            sdp = "v=0" +
            " o=- 79543 0 IN IP4 127.0.0.1 s=sipsorcery t=0 0 a=group:BUNDLE 0 m=application 9 UDP/DTLS/SCTP webrtc-datachannel c=IN IP4 0.0.0.0 a=ice-ufrag:MXYL a=ice-pwd:XPNINVNKSROMSFJOCRCGGRNH a=fingerprint:sha-256 5D:7C:C5:0E:CC:70:56:17:B0:73:80:E8:A0:E8:00:71:F3:16:81:9E:1F:D3:20:4C:AD:ED:1B:34:DD:B1:35:4C a=setup:actpass a=candidate:2494319634 1 udp 2113937663 92.205.233.81 62098 typ host generation 0 a=candidate:4248397485 1 udp 2113940223 2a00:1169:11d:31a0:: 62098 typ host generation 0 a=ice-options:ice2,trickle a=mid:0 a=sctp-port:5000 a=max-message-size:262144"
        };


        await _peerConnection.setLocalDescription(offer1);

        Console.WriteLine($"Local SDP Offer: {offer1.sdp}");
        // Wyślij ofertę SDP do serwera
        //SendMessage(new { type = "offer", sdp = offer.sdp });
        SendMessage(new
        {
            type = "offer",
            sdp = " v=0" + Environment.NewLine +
           "o=- 79543 0 IN IP4 127.0.0.1" + Environment.NewLine +
           "s=sipsorcery" + Environment.NewLine +
           "t=0 0" + Environment.NewLine +
           "a=group:BUNDLE 0" + Environment.NewLine +
           "m=application 9 UDP/DTLS/SCTP webrtc-datachannel" + Environment.NewLine +
           "c=IN IP4 0.0.0.0" + Environment.NewLine +
           "a=ice-ufrag:MXYL" + Environment.NewLine +
           "a=ice-pwd:XPNINVNKSROMSFJOCRCGGRNH" + Environment.NewLine +
           "a=fingerprint:sha-256 5D:7C:C5:0E:CC:70:56:17:B0:73:80:E8:A0:E8:00:71:F3:16:81:9E:1F:D3:20:4C:AD:ED:1B:34:DD:B1:35:4C" + Environment.NewLine +
           "a=setup:actpass" + Environment.NewLine +
           "a=candidate:2494319634 1 udp 2113937663 92.205.233.81 62098 typ host generation 0" + Environment.NewLine +
           "a=candidate:4248397485 1 udp 2113940223 2a00:1169:11d:31a0:: 62098 typ host generation 0" + Environment.NewLine +
           "a=ice-options:ice2,trickle" + Environment.NewLine +
           "a=mid:0" + Environment.NewLine +
           "a=sctp-port:5000" + Environment.NewLine +
           "a=max-message-size:262144" + Environment.NewLine
        });


        //SendMessage(offer1.toJSON());

        // Utrzymuj aplikację aktywną do celów testowych
        Console.WriteLine("WebRTC Client is running. Press Ctrl+C to exit.");
        var exitEvent = new ManualResetEvent(false);
        Console.CancelKeyPress += (s, e) =>
        {
            e.Cancel = true;
            exitEvent.Set();
        };
        exitEvent.WaitOne();
    }

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