////using System;
////using System.Collections.Generic;
////using System.Text;
////using System.Threading;
////using System.Threading.Tasks;
////using Newtonsoft.Json;
////using SIPSorcery.Net;
////using WebSocketSharp;

////class WebRTCReceiver
////{
////    private static WebSocket _webSocket;
////    private static RTCPeerConnection _peerConnection;
////    private static RTCDataChannel dataChannel;
////    private const string STUN_URL = "stun1.l.google.com:19302";

////    static async Task Main()
////    {
////        string webSocketServerUrl = "ws://92.205.233.81:8081/";

////        _webSocket = new WebSocket(webSocketServerUrl);
////        _webSocket.OnMessage += async (sender, e) => await HandleServerMessage(e.Data);
////        _webSocket.Connect();

////        await CreatePeerConnection();

////        Console.WriteLine("Press any key to close");
////        Console.ReadKey();
////    }

////    private static async Task CreatePeerConnection()
////    {
////        RTCConfiguration config = new RTCConfiguration
////        {
////            iceServers = new List<RTCIceServer> { new RTCIceServer { urls = STUN_URL } }
////        };
////        _peerConnection = new RTCPeerConnection(config);

////        dataChannel = await _peerConnection.createDataChannel("dc1");
////        dataChannel.onopen += () => Console.WriteLine("Data Channel opened.");
////        dataChannel.onmessage += (dc, protocol, data) =>
////            Console.WriteLine($"Message received: {Encoding.UTF8.GetString(data)}");

////        _peerConnection.onicecandidate += (RTCIceCandidate candidate) =>
////        {
////            if (candidate != null)
////            {
////                var candidateJson = JsonConvert.SerializeObject(new { candidate = candidate.candidate });
////                _webSocket.Send(candidateJson);
////            }
////        };
////    }

////    private static async Task HandleServerMessage(string message)
////    {
////        var data = JsonConvert.DeserializeObject<Dictionary<string, object>>(message);

////        if (data.ContainsKey("sdp") && data["type"].ToString() == "offer")
////        {
////            RTCSessionDescriptionInit offer = new RTCSessionDescriptionInit
////            {
////                sdp = data["sdp"].ToString(),
////                type = RTCSdpType.offer
////            };
////              _peerConnection.setRemoteDescription(offer);
////            Console.WriteLine("Remote SDP set. Creating answer...");

////            RTCSessionDescriptionInit answer =   _peerConnection.createAnswer(null);
////            await _peerConnection.setLocalDescription(answer);

////            var sdpAnswerJson = JsonConvert.SerializeObject(new { sdp = answer.sdp, type = "answer" });
////            _webSocket.Send(sdpAnswerJson);
////        }
////        else if (data.ContainsKey("candidate"))
////        {
////            RTCIceCandidateInit candidateData = new RTCIceCandidateInit { candidate = data["candidate"].ToString(), sdpMid = "0", sdpMLineIndex = 0 };
////              _peerConnection.addIceCandidate(candidateData);
////        }
////    }
////}


////using System;
////using System.Collections.Generic;
////using System.Text;
////using System.Threading.Tasks;
////using SIPSorcery.Net;

////class WebRTCReceiver
////{
////    private static RTCPeerConnection _peerConnection;
////    private const string STUN_URL = "stun1.l.google.com:19302";

////    static async Task Main()
////    {
////        Console.WriteLine("RECEIVER: Tworzenie połączenia WebRTC...");

////        _peerConnection = CreatePeerConnection();

////        Console.WriteLine("\nWklej tutaj OFFER od Callera:");
////        string offerSdp = Console.ReadLine();

////        var offer = new RTCSessionDescriptionInit { sdp = offerSdp, type = RTCSdpType.offer };
////         _peerConnection.setRemoteDescription(offer);
////        Console.WriteLine("✅ Remote SDP ustawione!");

////        // Generowanie SDP ANSWER
////        var answer = _peerConnection.createAnswer(null);
////        await _peerConnection.setLocalDescription(answer);

////        Console.WriteLine("\n🟢 Skopiuj i przekaż ANSWER do Callera:");
////        Console.WriteLine(answer.sdp);

////        while (true)
////        {
////            Console.WriteLine("\nWklej ICE Candidate od Callera (lub ENTER, jeśli nie ma):");
////            string iceCandidate = Console.ReadLine();
////            if (string.IsNullOrWhiteSpace(iceCandidate)) break;

////            var candidate = new RTCIceCandidateInit { candidate = iceCandidate, sdpMid = "0", sdpMLineIndex = 0 };
////            _peerConnection.addIceCandidate(candidate);
////            Console.WriteLine("✅ ICE Candidate dodane!");
////        }

////        Console.WriteLine("\nPołączenie WebRTC powinno być ustanowione! 🎉");
////        Console.ReadKey();
////    }

////    private static RTCPeerConnection CreatePeerConnection()
////    {
////        RTCConfiguration config = new RTCConfiguration
////        {
////            iceServers = new List<RTCIceServer> { new RTCIceServer { urls = STUN_URL } }
////        };
////        var peerConnection = new RTCPeerConnection(config);

////        peerConnection.onicecandidate += (RTCIceCandidate candidate) =>
////        {
////            if (candidate != null)
////            {
////                Console.WriteLine("\n🟢 Skopiuj i przekaż ten ICE Candidate do Callera:");
////                Console.WriteLine(candidate.candidate);
////            }
////        };

////        return peerConnection;
////    }
////}
//using System;
//using System.Collections.Generic;
//using System.Text;
//using System.Text.RegularExpressions;
//using System.Threading.Tasks;
//using SIPSorcery.Net;

//class WebRTCReceiver
//{
//    private static RTCPeerConnection _peerConnection;
//    private const string STUN_URL = "stun1.l.google.com:19302";

//    static async Task Main()
//    {
//        Console.WriteLine("🟢 RECEIVER: Oczekiwanie na połączenie WebRTC...");
//        _peerConnection = CreatePeerConnection();

//        // Oczekiwanie na SDP OFFER
//        Console.WriteLine("\n⏳ Oczekuję na SDP OFFER od Callera... Wklej je tutaj i naciśnij ENTER:");
//        //string offerSdp =   ReadMultilineInput();
//        string offerSdp =  Encoding.UTF8.GetString(Convert.FromBase64String(Console.ReadLine()));
//        if (string.IsNullOrWhiteSpace(offerSdp) || !offerSdp.Contains("v=0"))
//        {
//            Console.WriteLine("❌ Błąd: Nieprawidłowy SDP OFFER! Spróbuj ponownie.");
//            return;
//        }

//        var offer = new RTCSessionDescriptionInit { sdp = offerSdp, type = RTCSdpType.offer };
//          _peerConnection.setRemoteDescription(offer);
//        Console.WriteLine("✅ Remote SDP ustawione!");

//        // Tworzenie i wysyłanie SDP ANSWER
//        Console.WriteLine("\n✅ Tworzenie SDP ANSWER...");
//        var answer =   _peerConnection.createAnswer(null);
//        await _peerConnection.setLocalDescription(answer);

//        Console.WriteLine("\n📋 SKOPIUJ TEN ANSWER i wyślij do Callera, a następnie naciśnij ENTER:");
//        var dd = Convert.ToBase64String(StringToByteArray(answer.sdp));
//        //Console.WriteLine(answer.sdp);
//        Console.WriteLine(dd);
//        Console.ReadLine();

//        // Oczekiwanie na ICE Candidate od Callera
//        Console.WriteLine("\n🟢 Oczekiwanie na ICE Candidate od Callera...");
//        while (true)
//        {
//            Console.Write("\nWklej ICE Candidate od Callera (lub ENTER, jeśli nie ma więcej): ");
//            string iceCandidate = Console.ReadLine();
//            if (string.IsNullOrWhiteSpace(iceCandidate)) break;

//            if (!IsValidIceCandidate(iceCandidate))
//            {
//                Console.WriteLine("❌ Błąd: Wklejony tekst NIE JEST prawidłowym ICE Candidate! Spróbuj ponownie.");
//                continue;
//            }

//            var candidate = new RTCIceCandidateInit { candidate = iceCandidate, sdpMid = "0", sdpMLineIndex = 0 };
//              _peerConnection.addIceCandidate(candidate);
//            Console.WriteLine("✅ ICE Candidate dodane!");
//        }

//        Console.WriteLine("\n🎉 Połączenie WebRTC powinno być ustanowione!");
//        Console.WriteLine("🔄 Naciśnij dowolny klawisz, aby zakończyć.");
//        Console.ReadKey(); // Zatrzymanie programu po zakończeniu
//    }

//    private static RTCPeerConnection CreatePeerConnection()
//    {
//        RTCConfiguration config = new RTCConfiguration
//        {
//            iceServers = new List<RTCIceServer> { new RTCIceServer { urls = STUN_URL } }
//        };
//        var peerConnection = new RTCPeerConnection(config);

//        peerConnection.onicecandidate += (RTCIceCandidate candidate) =>
//        {
//            if (candidate != null)
//            {
//                Console.WriteLine("\n📋 SKOPIUJ TEN ICE Candidate i wyślij do Callera, a następnie naciśnij ENTER:");
//                Console.WriteLine(candidate.candidate);
//                Console.ReadLine();
//            }
//        };

//        return peerConnection;
//    }

//    private static string ReadMultilineInput()
//    {
//        Console.WriteLine("(Aby zakończyć wpisywanie, wpisz 'END' i naciśnij ENTER)");
//        string input = "";
//        string line;
//        while ((line = Console.ReadLine()) != "END")
//        {
//            input += line + "\r\n";
//        }
//        return input.Trim();
//    }

//    private static bool IsValidIceCandidate(string candidate)
//    {
//        return Regex.IsMatch(candidate, @"\d+ \d+ \w+ \d+ [\d.]+ \d+ typ \w+");
//    }

//    private static byte[] StringToByteArray(string str)
//    {
//        return Encoding.UTF8.GetBytes(str);
//    }
//}
