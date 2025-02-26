using System;
using System.Collections.Generic;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Newtonsoft.Json; // Dodaj tę bibliotekę (Newtonsoft.Json) do obsługi JSON
using SIPSorcery.Net;
using WebSocketSharp;

class Program
{
    private static WebSocket _webSocket;
    private static RTCPeerConnection _peerConnection;
    private static RTCDataChannel dataChannel;
    private const string STUN_URL = "stun1.l.google.com:19302"; // Zalecany serwer STUN
    private static bool IsSDPRemoteAdded = false;
    static async Task Main(string[] args)
    {
        string webSocketServerUrl = "ws://92.205.233.81:8081/";


        // Inicjalizacja WebSocket i obsługa wiadomości od serwera
        _webSocket = new WebSocket(webSocketServerUrl);
        _webSocket.OnMessage += async (sender, e) => await HandleServerMessage(e.Data);
        _webSocket.Connect();

        await CreatePeerConnection();

        Console.WriteLine("Press any key to close");
        Console.ReadKey();
        dataChannel.send("test message");
    }

    private static async Task CreatePeerConnection()
    {
        RTCConfiguration config = new RTCConfiguration
        {
            iceServers = new List<RTCIceServer> { new RTCIceServer { urls = STUN_URL } }
        };
        _peerConnection = new RTCPeerConnection(config);

        // Data Channel
        RTCDataChannel dataChannel;

        _peerConnection.ondatachannel += (dc) =>
        {
            dataChannel = dc;
            // Data Channel 
            dataChannel.onopen += () => Console.WriteLine("Data Channel opened.");
            dataChannel.onmessage += (dc, protocol, data) =>
                Console.WriteLine($"Message received: {Encoding.UTF8.GetString(data)}");
            dataChannel.onclose += () => Console.WriteLine("Data Channel closed.");
        };
        // ICE Candidates
        _peerConnection.onicecandidate += (RTCIceCandidate candidate) =>
        {
            if (candidate != null)
            {
                Console.WriteLine($"New ICE Candidate: {candidate.candidate}");
                var iceCandidateJson = JsonConvert.SerializeObject(new { candidate = candidate.candidate });
                _webSocket.Send(iceCandidateJson);
            }
            else
            {
                Console.WriteLine("All ICE Candidates generated");
            }
        };

        // Tworzenie oferty SDP i wysłanie jej do serwera
        await CreateAndSendOffer();
    }

    private static async Task CreateAndSendOffer()
    {
        var offer = _peerConnection.createOffer(null);
        await _peerConnection.setLocalDescription(offer);

        Console.WriteLine("SDP Offer Created:");
        Console.WriteLine(offer.sdp);

        var sdpOfferJson = JsonConvert.SerializeObject(new { sdp = offer.sdp, type = "offer" });
        _webSocket.Send(sdpOfferJson);
    }
    private static async Task HandleServerMessage(string message)
    {
        Console.WriteLine($"Received from server: {message}");
        try
        {
            var data = JsonConvert.DeserializeObject<Dictionary<string, object>>(message);

            if (data.ContainsKey("sdp") && data["type"].ToString() == "offer")
            {
                Console.WriteLine("Received SDP Offer from server.");

                RTCSessionDescriptionInit offer = new RTCSessionDescriptionInit
                {
                    sdp = data["sdp"].ToString(),
                    type = RTCSdpType.offer
                };

                _peerConnection.setRemoteDescription(offer);
                Console.WriteLine("Remote SDP set. Creating answer...");

                RTCSessionDescriptionInit answer = _peerConnection.createAnswer(null);
                await _peerConnection.setLocalDescription(answer);

                Console.WriteLine("Sending SDP Answer...");
                var sdpAnswerJson = JsonConvert.SerializeObject(new { sdp = answer.sdp, type = "answer" });
                _webSocket.Send(sdpAnswerJson);
            }
            else
            //if (data.ContainsKey("sdp") && data["type"].ToString() == "offer")
            //{
            //    RTCSessionDescriptionInit offer = new RTCSessionDescriptionInit
            //    {
            //        sdp = data["sdp"].ToString(),
            //        type = RTCSdpType.offer
            //    };
            //    _peerConnection.setLocalDescription(offer);
            //    //var answer = _peerConnection.createAnswer(null);
            //    IsSDPRemoteAdded = true;
            //    Console.WriteLine("SDP Offer Added");
            //}
            //else
            if (data.ContainsKey("sdp") && data["type"].ToString() == "answer")
            {
                Console.WriteLine("Received SDP Answer from server.");
                RTCSessionDescriptionInit answer = new RTCSessionDescriptionInit
                {
                    sdp = data["sdp"].ToString(),
                    type = RTCSdpType.answer
                };
                _peerConnection.setRemoteDescription(answer);

                Console.WriteLine("Remote description set. Connection established!");
            }
            else if (data.ContainsKey("candidate"))
            {
                string candidateString = data["candidate"].ToString();

                // Ręczne parsowanie ICE Candidate
                var candidateParts = candidateString.Split(' ');
                if (candidateParts.Length < 8)
                {
                    Console.WriteLine("Invalid ICE candidate format received.");
                    return;
                }

                RTCIceCandidateInit candidateData = new RTCIceCandidateInit
                {
                    candidate = candidateString,
                    sdpMid = "0", // Domyślnie ustawiamy sdpMid na "0", jeśli nie ma w danych
                    sdpMLineIndex = 0 // Domyślnie ustawiamy indeks na 0
                };

                _peerConnection.addIceCandidate(candidateData);
                Console.WriteLine($"ICE Candidate added: {candidateString}");


                new Thread(async () =>
                {
                    Task.Delay(5000).Wait();
                    if (IsSDPRemoteAdded)
                    {
                        var answer = _peerConnection.createAnswer(null);
                        var sdpOfferJson = JsonConvert.SerializeObject(new { sdp = answer.sdp, type = "answer" });
                        _webSocket.Send(sdpOfferJson);
                    }

                }).Start();
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error processing server message: {ex.Message}");
        }
    }
}
