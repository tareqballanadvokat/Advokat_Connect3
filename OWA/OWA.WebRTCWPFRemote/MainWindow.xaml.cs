using System;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using OWA.WebRTCWPFCaller;
using SIPSorcery.Net;
using SIPSorceryMedia.Abstractions;

namespace OWA.WebRTCWPFRemote
{
    public partial class MainWindow : Window
    {
        private ClientWebSocket ws;
        private RTCPeerConnection peerConnection;
        private const string serverUrl = "ws://92.205.233.81:8081";
        private const string remoteId = "remote";
        private const string callerId = "caller2";
        private bool isConnected = false;
        private bool offerReceived = false;

        private RTCDataChannel dataChannel;
        public MainWindow()
        {
            InitializeComponent();
        }

        private async void ConnectBtn_Click(object sender, RoutedEventArgs e)
        {
            SetupWebRTC();
            ws = new ClientWebSocket();
            Log("📡 Łączenie z serwerem...");
            await ws.ConnectAsync(new Uri(serverUrl), CancellationToken.None);

            var registerMsg = JsonSerializer.Serialize(new { type = "register", id = remoteId });
            await SendWebSocketMessage(registerMsg);
            Log("✅ Połączono!");

            isConnected = true;
            WaitOfferBtn.IsEnabled = true;
            DisconnectBtn.IsEnabled = true;
            ConnectBtn.IsEnabled = false;
            LogBox.ScrollToEnd();
        }


        //private async void ConnectBtn_Click(object sender, RoutedEventArgs e)
        //{
        //    SetupWebRTC();
        //    ws = new ClientWebSocket();
        //    Log("📡 Łączenie z serwerem...");
        //    await ws.ConnectAsync(new Uri(serverUrl), CancellationToken.None);

        //    var registerMsg = JsonSerializer.Serialize(new { type = "register", id = remoteId });
        //    await SendWebSocketMessage(registerMsg);
        //    Log("✅ Połączono!");

        //    isConnected = true;
        //    WaitOfferBtn.IsEnabled = true;
        //    DisconnectBtn.IsEnabled = true;
        //    ConnectBtn.IsEnabled = false;

        //    // **Nowe!** Uruchamiamy w tle odbieranie wiadomości WebSocket
        //    _ = Task.Run(ReceiveWebSocketMessages);
        //}


        private async void WaitOfferBtn_Click(object sender, RoutedEventArgs e)
        {
            if (!isConnected) return;

            Log("⏳ Oczekiwanie na Offer...");
            var buffer = new byte[4096];
            var result = await ws.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None);
            string message = Encoding.UTF8.GetString(buffer, 0, result.Count);

            Log($"📩 Otrzymano: {message}");
            var data = JsonSerializer.Deserialize<JsonElement>(message);
            if (data.TryGetProperty("type", out JsonElement typeElement) && typeElement.GetString() == "offer")
            {
                var offerJson = data.GetProperty("offer").GetRawText();
                var offer = JsonSerializer.Deserialize<RTCSessionDescriptionInit>(offerJson);
                offer.type = RTCSdpType.offer;
                  peerConnection.setRemoteDescription(offer);
                Log("✅ Ustawiono Remote Description!");

                offerReceived = true;
                GenerateAnswerBtn.IsEnabled = true;
                WaitOfferBtn.IsEnabled = false;
            }
        }

        private async void GenerateAnswerBtn_Click(object sender, RoutedEventArgs e)
        {
            if (!offerReceived) return;
             
            var answer =   peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);

            var answerMsg = JsonSerializer.Serialize(new { type = "answer", target = callerId, answer });
            await SendWebSocketMessage(answerMsg);
            Log($"📡 Wysłano Answer: {answer.sdp}");

            SendICEBtn.IsEnabled = true;
            GenerateAnswerBtn.IsEnabled = false;

            Log($"📡 Oczekiwaie na ICE:");
            _ = Task.Run(ReceiveWebSocketMessages);
            LogBox.ScrollToEnd();

        }


        private async Task ReceiveWebSocketMessages()
        {
            byte[] buffer = new byte[4096];

            while (ws.State == WebSocketState.Open)
            {
                var result = await ws.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None);
                string message = Encoding.UTF8.GetString(buffer, 0, result.Count);
                Log($"📩 Otrzymano wiadomość z serwera: {message}");

                var data = JsonSerializer.Deserialize<JsonElement>(message);
                if (data.TryGetProperty("type", out JsonElement typeElement))
                {
                    string type = typeElement.GetString();
                    switch (type)
                    {
                        case "candidate":
                            var candidateJson = data.GetProperty("candidate").GetRawText();
                            var candidate = JsonSerializer.Deserialize<RTCIceCandidateInit>(candidateJson);
                            peerConnection.addIceCandidate(candidate);
                            Log($"✅ Dodano ICE Candidate: {candidate.candidate}");
                            //SendMessageBtn.IsEnabled = true;
                            break;

                        default:
                            Log($"⚠️ Otrzymano nieznany typ wiadomości: {type}");
                            break;
                    }
                }
            }
        }


        List<RTCIceCandidate> candidates = new List<RTCIceCandidate>();

        private void SetupWebRTC()
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

            peerConnection.onicecandidate += async (candidate) =>
            {
                if (candidate != null && isConnected)
                { 
                    var options = new JsonSerializerOptions();
                    options.Converters.Add(new IPAddressConverter());

                    var iceMsg = JsonSerializer.Serialize(new { type = "candidate", target = callerId, candidate }, options);
                    candidates.Add(candidate); 
                }
            };

            // **Nowe**: Tworzenie DataChannel
            dataChannel =   peerConnection.createDataChannel("dataChannel").Result;
            dataChannel.onopen += () =>
            {
                Log("✅ DataChannel OTWARTY!");
                byte[] testMessage = Encoding.UTF8.GetBytes("Test wiadomości po otwarciu kanału");
                dataChannel.send(testMessage);
            };
            dataChannel.onmessage += (RTCDataChannel channel, DataChannelPayloadProtocols protocol, byte[] data) =>
            {
                string receivedMessage = Encoding.UTF8.GetString(data);
                Log($"📩 Otrzymano wiadomość: {receivedMessage}");
            };

            //peerConnection.ondatachannel += (dc) =>
            //{
            //    dc.onmessage += (RTCDataChannel channel, DataChannelPayloadProtocols protocol, byte[] data) =>
            //    {
            //        string receivedMessage = Encoding.UTF8.GetString(data);
            //        Log($"📩 Otrzymano wiadomość: {receivedMessage}");
            //    };
            //    dc.onopen += () =>
            //    {
            //        Log("✅ Kanał danych otwarty!");
            //        //Dispatcher.Invoke(() => SendMessageBtn.IsEnabled = true);
            //    }; 
            //};
            LogBox.ScrollToEnd();
        }
        private async void SendMessageBtn_Click(object sender, RoutedEventArgs e)
        {
            if (dataChannel != null && dataChannel.readyState == RTCDataChannelState.open)
            {
                string message = MessageBox.Text;
                if (!string.IsNullOrWhiteSpace(message))
                {
                    byte[] messageBytes = Encoding.UTF8.GetBytes(message);
                    dataChannel.send(messageBytes);
                    Log($"📤 Wysłano wiadomość: {message}");
                    MessageBox.Clear();
                }
            }
            else
            {
                Log("❌ Kanał danych nie jest otwarty!");
            }
            LogBox.ScrollToEnd();
        }

        private async void SendICEBtn_Click(object sender, RoutedEventArgs e)
        {
            if (!isConnected) return;
             
            if (candidates.Any())
            {
                foreach (var candidate in candidates)
                {

                    var options = new JsonSerializerOptions();
                    options.Converters.Add(new IPAddressConverter());

                    var iceMsg = JsonSerializer.Serialize(new { type = "candidate", target = callerId, candidate }, options);

                    //var iceMsg = JsonSerializer.Serialize(new { type = "candidate", target = callerId, candidate });
                    await SendWebSocketMessage(iceMsg);
                    Log($"❄️ Wysłano ICE Candidate: {candidate.candidate}");
                }
            }
            else
            {
                Log("⚠️ Brak lokalnych ICE Candidate do wysłania.");
            }
            LogBox.ScrollToEnd();

        }

        private async void DisconnectBtn_Click(object sender, RoutedEventArgs e)
        {
            Log("❌ Rozłączanie...");
            isConnected = false;
            peerConnection?.close();
            ws?.Abort();
            ws?.Dispose();

            ConnectBtn.IsEnabled = true;
            WaitOfferBtn.IsEnabled = false;
            GenerateAnswerBtn.IsEnabled = false;
            SendICEBtn.IsEnabled = false;
            DisconnectBtn.IsEnabled = false;
        }

        private async Task SendWebSocketMessage(string message)
        {
            if (ws.State == WebSocketState.Open)
            {
                byte[] messageBytes = Encoding.UTF8.GetBytes(message);
                await ws.SendAsync(new ArraySegment<byte>(messageBytes), WebSocketMessageType.Text, true, CancellationToken.None);
            }
        }

        private void Log(string message)
        {
            Dispatcher.Invoke(() => LogBox.AppendText(message + "\n"));
        }
    }
}
