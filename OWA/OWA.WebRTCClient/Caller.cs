//using System;
//using System.Collections.Generic;
//using System.Text;
//using System.Threading;
//using System.Threading.Tasks;
//using Newtonsoft.Json;
//using SIPSorcery.Net;
//using WebSocketSharp;

//class WebRTCCaller
//{
//    private static WebSocket _webSocket;
//    private static RTCPeerConnection _peerConnection;
//    private static RTCDataChannel dataChannel;
//    private const string STUN_URL = "stun1.l.google.com:19302";

//    static async Task Main()
//    {
//        string webSocketServerUrl = "ws://92.205.233.81:8081/";

//        _webSocket = new WebSocket(webSocketServerUrl);
//        _webSocket.OnMessage += async (sender, e) => await HandleServerMessage(e.Data);
//        _webSocket.Connect();

//        await CreatePeerConnection();
//        await CreateAndSendOffer();

//        Console.WriteLine("Press any key to close");
//        Console.ReadKey();
//    }

//    private static async Task CreatePeerConnection()
//    {
//        RTCConfiguration config = new RTCConfiguration
//        {
//            iceServers = new List<RTCIceServer> { new RTCIceServer { urls = STUN_URL } }
//        };
//        _peerConnection = new RTCPeerConnection(config);

//        dataChannel = await _peerConnection.createDataChannel("dc1");
//        dataChannel.onopen += () => Console.WriteLine("Data Channel opened.");
//        dataChannel.onmessage += (dc, protocol, data) =>
//            Console.WriteLine($"Message received: {Encoding.UTF8.GetString(data)}");

//        _peerConnection.onicecandidate += (RTCIceCandidate candidate) =>
//        {
//            if (candidate != null)
//            {
//                var candidateJson = JsonConvert.SerializeObject(new { candidate = candidate.candidate });
//                _webSocket.Send(candidateJson);
//            }
//        };
//    }

//    private static async Task CreateAndSendOffer()
//    {
//        var offer =   _peerConnection.createOffer(null);
//        await _peerConnection.setLocalDescription(offer);

//        var sdpOfferJson = JsonConvert.SerializeObject(new { sdp = offer.sdp, type = "offer" });
//        _webSocket.Send(sdpOfferJson);
//    }

//    private static async Task HandleServerMessage(string message)
//    {
//        var data = JsonConvert.DeserializeObject<Dictionary<string, object>>(message);

//        if (data.ContainsKey("sdp") && data["type"].ToString() == "answer")
//        {
//            RTCSessionDescriptionInit answer = new RTCSessionDescriptionInit
//            {
//                sdp = data["sdp"].ToString(),
//                type = RTCSdpType.answer
//            };
//              _peerConnection.setRemoteDescription(answer);
//            Console.WriteLine("Remote description set. Connection established!");
//        }
//        else if (data.ContainsKey("candidate"))
//        {
//            RTCIceCandidateInit candidateData = new RTCIceCandidateInit { candidate = data["candidate"].ToString(), sdpMid = "0", sdpMLineIndex = 0 };
//              _peerConnection.addIceCandidate(candidateData);
//        }
//    }
//}
using System;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using SIPSorcery.Net;
using SIPSorceryMedia.Abstractions;

class Program
{
    private static ClientWebSocket ws = new ClientWebSocket();
    private static RTCPeerConnection peerConnection;
    private static string serverUrl = "ws://92.205.233.81:8081";
    private static string callerId = "caller2";
    private static bool isRemoteDescriptionSet = false;
    private static List<RTCIceCandidateInit> iceCandidateQueue = new List<RTCIceCandidateInit>(); // Kolejka ICE Candidates

    static async Task Main()
    {
        SetupWebRTC();
        await ConnectToWebSocket();
        _ = Task.Run(async () => await ReceiveWebSocketMessages());
        //while (true)
        //{
        //    await ReceiveWebSocketMessages();
        //}

        Console.WriteLine("🔄 [Caller] Czekam na wiadomości... Wciśnij Enter, aby zakończyć.");
        Console.ReadLine();
    }

    static async Task ConnectToWebSocket()
    {
        Console.WriteLine("📡 [Caller] Łączenie z serwerem sygnalizacyjnym...");
        await ws.ConnectAsync(new Uri(serverUrl), CancellationToken.None);

        var registerMsg = JsonSerializer.Serialize(new { type = "register", id = callerId });
        await SendWebSocketMessage(registerMsg);
        Console.WriteLine("✅ [Caller] Połączono z serwerem sygnalizacyjnym.");

        // Po połączeniu tworzymy Offer
        await CreateOffer();
    }

    static async void SetupWebRTC()
    {
        RTCConfiguration config = new RTCConfiguration
        {
            iceServers = new List<RTCIceServer> {
                new RTCIceServer { urls = "stun:freestun.net:3478" },
                new RTCIceServer { urls = "stun:stun2.l.google.com:19302" },
                new RTCIceServer { urls = "turn:freestun.net:3478", credential = "free", credentialType = RTCIceCredentialType.password, username = "free" }
            }
        };
        peerConnection = new RTCPeerConnection(config);

        var dataChannel = await peerConnection.createDataChannel("chatChannel");
        dataChannel.onopen += () => Console.WriteLine("✅ [Caller] Kanał danych otwarty!");
        dataChannel.onmessage += (RTCDataChannel dc, DataChannelPayloadProtocols protocol, byte[] data) => Console.WriteLine($"📩 [Caller] Otrzymano wiadomość: {Encoding.UTF8.GetString(data)}");

        peerConnection.onicecandidate += (candidate) =>
        {
            if (candidate != null)
            {
                if (isRemoteDescriptionSet)
                {
                    var iceMsg = JsonSerializer.Serialize(new { type = "candidate", target = "remote", candidate });
                    SendWebSocketMessage(iceMsg).Wait();
                    Console.WriteLine($"📡 [Caller] Wysłano ICE Candidate: {candidate}");
                }
                else
                {
                    RTCIceCandidateInit init = new RTCIceCandidateInit { candidate = candidate.candidate };
                    iceCandidateQueue.Add(init);
                    Console.WriteLine($"⏳ [Caller] Odkładam ICE Candidate do kolejki (RemoteDescription nie ustawione): {candidate}");
                }
            }
        };

        peerConnection.onconnectionstatechange += (ss) =>
        {
            Console.WriteLine($"🔄 [Caller] Stan połączenia: {peerConnection.connectionState}");
        };
    }

    static async Task CreateOffer()
    {
        var offer =   peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        // ✅ **Poprawna serializacja `offer`**
        var offerMsg = JsonSerializer.Serialize(new { type = "offer", target = "remote", offer = new { sdp = offer.sdp, type = "offer" } });
        await SendWebSocketMessage(offerMsg);
        Console.WriteLine($"📡 [Caller] Wysłano Offer: {offer.sdp}");
    }

    //static async Task ReceiveWebSocketMessages()
    //{
    //    byte[] buffer = new byte[4096];
    //    var result = await ws.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None);
    //    string message = Encoding.UTF8.GetString(buffer, 0, result.Count);
    //    Console.WriteLine($"📩 [Caller] Otrzymano wiadomość z serwera: {message}");
    //    if (message.Contains("\"answer\""))
    //    {
    //        Console.WriteLine("✅ [Caller] Odebrano Answer! Przetwarzanie...");
    //    }
    //    else
    //    {
    //        Console.WriteLine("❌ [Caller] Nie odebrano Answer, coś jest nie tak.");
    //    }

    //    var data = JsonSerializer.Deserialize<JsonElement>(message);

    //    if (data.TryGetProperty("type", out JsonElement typeElement))
    //    {
    //        string type = typeElement.GetString();
    //        switch (type)
    //        {
    //            case "answer":
    //                try
    //                {
    //                    var answerJson = data.GetProperty("answer").GetRawText();
    //                    Console.WriteLine($"📜 [Caller] Odebrany JSON answer: {answerJson}");

    //                    var answer = JsonSerializer.Deserialize<RTCSessionDescriptionInit>(answerJson);
    //                    if (answer == null || string.IsNullOrEmpty(answer.sdp))
    //                    {
    //                        Console.WriteLine("❌ [Caller] Otrzymano pusty lub niepoprawny SDP!");
    //                        return;
    //                    }

    //                    answer.type = RTCSdpType.answer;  // ✅ **Naprawa błędu enum**
    //                      peerConnection.setRemoteDescription(answer);
    //                    isRemoteDescriptionSet = true;
    //                    Console.WriteLine($"✅ [Caller] Ustawiono Remote Description (Answer)");

    //                    foreach (var candidate in iceCandidateQueue)
    //                    {
    //                          peerConnection.addIceCandidate(candidate);
    //                        Console.WriteLine($"➡️ [Caller] Dodano opóźniony ICE Candidate: {candidate.candidate}");
    //                    }
    //                    iceCandidateQueue.Clear();
    //                }
    //                catch (Exception ex)
    //                {
    //                    Console.WriteLine($"❌ [Caller] Błąd podczas ustawiania Answer: {ex.Message}");
    //                }
    //                break;

    //            case "candidate":
    //                var candidateData = JsonSerializer.Deserialize<RTCIceCandidateInit>(data.GetProperty("candidate").GetRawText());
    //                if (isRemoteDescriptionSet)
    //                {
    //                      peerConnection.addIceCandidate(candidateData);
    //                    Console.WriteLine($"➡️ [Caller] Dodano ICE Candidate: {candidateData.candidate}");
    //                }
    //                else
    //                {
    //                    iceCandidateQueue.Add(candidateData);
    //                    Console.WriteLine($"⏳ [Caller] Odkładam ICE Candidate do kolejki: {candidateData.candidate}");
    //                }
    //                break;
    //        }
    //    }
    //}



    //static async Task ReceiveWebSocketMessages()
    //{
    //    Console.WriteLine($"🌐 [Caller] WebSocket Status: {ws.State}");
    //    byte[] buffer = new byte[4096];
    //    while (true)
    //    {
    //        var result = await ws.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None);
    //        string message = Encoding.UTF8.GetString(buffer, 0, result.Count);
    //        Console.WriteLine($"📩 [Caller] Otrzymano wiadomość z serwera: {message}");

    //        var data = JsonSerializer.Deserialize<JsonElement>(message);

    //        if (data.TryGetProperty("type", out JsonElement typeElement))
    //        {
    //            string type = typeElement.GetString();
    //            Console.WriteLine($"🔍 [Caller] Odebrano typ wiadomości: {type}");

    //            switch (type)
    //            {
    //                case "answer":
    //                    Console.WriteLine("✅ [Caller] Odebrano Answer! Przetwarzanie...");
    //                    var answerJson = data.GetProperty("answer").GetRawText();
    //                    Console.WriteLine($"📜 [Caller] Otrzymany JSON answer: {answerJson}");

    //                    var answer = JsonSerializer.Deserialize<RTCSessionDescriptionInit>(answerJson);
    //                    if (answer == null || string.IsNullOrEmpty(answer.sdp))
    //                    {
    //                        Console.WriteLine("❌ [Caller] Otrzymano pusty lub niepoprawny SDP!");
    //                        return;
    //                    }

    //                    answer.type = RTCSdpType.answer;  // ✅ Naprawa błędu enum
    //                     peerConnection.setRemoteDescription(answer);
    //                    isRemoteDescriptionSet = true;
    //                    Console.WriteLine($"✅ [Caller] Ustawiono Remote Description (Answer)");

    //                    // Dodajemy wszystkie wcześniej zapisane ICE Candidates
    //                    foreach (var candidate in iceCandidateQueue)
    //                    {
    //                         peerConnection.addIceCandidate(candidate);
    //                        Console.WriteLine($"➡️ [Caller] Dodano opóźniony ICE Candidate: {candidate.candidate}");
    //                    }
    //                    iceCandidateQueue.Clear();
    //                    break;

    //                case "candidate":
    //                    var candidateData = JsonSerializer.Deserialize<RTCIceCandidateInit>(data.GetProperty("candidate").GetRawText());
    //                    if (isRemoteDescriptionSet)
    //                    {
    //                         peerConnection.addIceCandidate(candidateData);
    //                        Console.WriteLine($"➡️ [Caller] Dodano ICE Candidate: {candidateData.candidate}");
    //                    }
    //                    else
    //                    {
    //                        iceCandidateQueue.Add(candidateData);
    //                        Console.WriteLine($"⏳ [Caller] Odkładam ICE Candidate do kolejki: {candidateData.candidate}");
    //                    }
    //                    break;

    //                default:
    //                    Console.WriteLine($"⚠️ [Caller] Otrzymano nieznany typ wiadomości: {type}");
    //                    break;
    //            }
    //        }
    //        else
    //        {
    //            Console.WriteLine("❌ [Caller] Otrzymano wiadomość, ale brak `type` w JSON!");
    //        }
    //    }
    //}

    static async Task ReceiveWebSocketMessages()
    {
        byte[] buffer = new byte[4096];

        while (ws.State == WebSocketState.Open) // **Nowe!** Działa cały czas, dopóki WebSocket jest aktywny
        {
            var result = await ws.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None);
            string message = Encoding.UTF8.GetString(buffer, 0, result.Count);
            Console.WriteLine($"📩 [Caller] Otrzymano wiadomość z serwera: {message}");

            if (message.Contains("\"answer\""))
            {
                Console.WriteLine("✅ [Caller] Otrzymano Answer!");
            }
            else
            {
                Console.WriteLine("❌ [Caller] Brak Answer w wiadomości.");
            }
        }
    }



    static async Task SendWebSocketMessage(string message)
    {
        if (ws.State == WebSocketState.Open)
        {
            byte[] messageBytes = Encoding.UTF8.GetBytes(message);
            await ws.SendAsync(new ArraySegment<byte>(messageBytes), WebSocketMessageType.Text, true, CancellationToken.None);
        }
        else
        {
            Console.WriteLine("❌ [Caller] WebSocket nie jest połączony.");
        }
    }
}
