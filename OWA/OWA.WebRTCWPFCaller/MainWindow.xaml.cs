using System;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls.Primitives;
using SIPSorcery.Net;
using SIPSorceryMedia.Abstractions;

namespace OWA.WebRTCWPFCaller
{
    public partial class MainWindow : Window
    {
        private ClientWebSocket ws;
        private RTCPeerConnection peerConnection;
        private const string serverUrl = "ws://92.205.233.81:8081";
        private const string callerId = "caller2";
        private const string remoteId = "remote";
        private bool isRemoteDescriptionSet = false;
        private bool isConnected = false;

        public MainWindow()
        {
            InitializeComponent();
        }

        //private async void ConnectBtn_Click(object sender, RoutedEventArgs e)
        //{
        //    ws = new ClientWebSocket();
        //    Log("📡 Łączenie z serwerem...");
        //    await ws.ConnectAsync(new Uri(serverUrl), CancellationToken.None);

        //    var registerMsg = JsonSerializer.Serialize(new { type = "register", id = callerId });
        //    await SendWebSocketMessage(registerMsg);
        //    Log("✅ Połączono!");

        //    isConnected = true;
        //    OfferBtn.IsEnabled = true;
        //    DisconnectBtn.IsEnabled = true;
        //    ConnectBtn.IsEnabled = false;
        //}
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
                            break;

                        default:
                            Log($"⚠️ Otrzymano nieznany typ wiadomości: {type}");
                            break;
                    }
                }
                LogBox.ScrollToEnd();
            }
        }

        private RTCDataChannel dataChannel;
        List<RTCIceCandidate> candicates = new List<RTCIceCandidate>();
        private async void ConnectBtn_Click(object sender, RoutedEventArgs e)
        {
            if (ws != null && ws.State == WebSocketState.Open)
            {
                Log("⚠️ Już połączono z serwerem.");
                return;
            }

            ws = new ClientWebSocket();
            Log("📡 Łączenie z serwerem...");

            try
            {
                await ws.ConnectAsync(new Uri(serverUrl), CancellationToken.None);
                Log("✅ Połączono!");

                var registerMsg = JsonSerializer.Serialize(new { type = "register", id = callerId });
                await SendWebSocketMessage(registerMsg);
            }
            catch (Exception ex)
            {
                Log($"❌ Błąd połączenia: {ex.Message}");
                return;
            }

            isConnected = true;
            OfferBtn.IsEnabled = true;
            DisconnectBtn.IsEnabled = true;
            ConnectBtn.IsEnabled = false;
        }
        private async Task SetupWebRTC()
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

                    var iceMsg = JsonSerializer.Serialize(new { type = "candidate", target = remoteId, candidate }, options);
                    candicates.Add(candidate); 
                }
            };

            //dataChannel = peerConnection.createDataChannel("dataChannel").Result;
            //peerConnection.ondatachannel += (dc) =>
            //{
            //    dc.onopen += () =>
            //    {
            //        Log("✅ Kanał danych otwarty w Caller!");
            //        //Dispatcher.Invoke(() => SendMessageBtn.IsEnabled = true);
            //    };
            //    dc.onmessage += (RTCDataChannel channel, DataChannelPayloadProtocols protocol, byte[] data) =>
            //    {
            //        string receivedMessage = Encoding.UTF8.GetString(data);
            //        Log($"📩 Otrzymano wiadomość: {receivedMessage}");
            //    }; 
            //};

            dataChannel = peerConnection.createDataChannel("dataChannel").Result;
            dataChannel.onopen += () =>
            {
                Log("✅ DataChannel OTWARTY!");
                byte[] testMessage = Encoding.UTF8.GetBytes("Test wiadomości po otwarciu kanału");
                dataChannel.send(testMessage);
                LogBox.ScrollToEnd();
            };
            dataChannel.onmessage += (RTCDataChannel channel, DataChannelPayloadProtocols protocol, byte[] data) =>
            {
                string receivedMessage = Encoding.UTF8.GetString(data);
                Log($"📩 Otrzymano wiadomość: {receivedMessage}");
                LogBox.ScrollToEnd();
            };



        }

        private async void OfferBtn_Click(object sender, RoutedEventArgs e)
        {
            await SetupWebRTC();
            var offer =   peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);

            var offerMsg = JsonSerializer.Serialize(new { type = "offer", target = remoteId, offer });
            await SendWebSocketMessage(offerMsg);
            Log($"📡 Wysłano Offer: {offer.sdp}");

            WaitAnswerBtn.IsEnabled = true;
            OfferBtn.IsEnabled = false;
            LogBox.ScrollToEnd();
        }

        private async void WaitAnswerBtn_Click(object sender, RoutedEventArgs e)
        {
            if (!isConnected) return;

            Log("⏳ Oczekiwanie na Answer...");
            var buffer = new byte[4096];
            var result = await ws.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None);
            string message = Encoding.UTF8.GetString(buffer, 0, result.Count);

            Log($"📩 Otrzymano: {message}");
            var data = JsonSerializer.Deserialize<JsonElement>(message);
            if (data.TryGetProperty("type", out JsonElement typeElement) && typeElement.GetString() == "answer")
            {
                var answerJson = data.GetProperty("answer").GetRawText();
                var answer = JsonSerializer.Deserialize<RTCSessionDescriptionInit>(answerJson);
                answer.type = RTCSdpType.answer;
                peerConnection.setRemoteDescription(answer);
                Log("✅ Ustawiono Remote Description!");
                SendICEBtn.IsEnabled = true;
            }


            Log($"⏳ Oczekiwaie na ICE:");
            _ = Task.Run(ReceiveWebSocketMessages);
            LogBox.ScrollToEnd();
        }

        private async void SendICEBtn_Click(object sender, RoutedEventArgs e)
        {
            if (!isConnected) return;
            if (candicates.Any())
            {
                foreach (var candidate in candicates)
                {
                    var options = new JsonSerializerOptions();
                    options.Converters.Add(new IPAddressConverter());

                    var iceMsg = JsonSerializer.Serialize(new { type = "candidate", target = remoteId, candidate }, options);


                    //var iceMsg = JsonSerializer.Serialize(new { type = "candidate", target = remoteId, candidate });
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
            OfferBtn.IsEnabled = false;
            WaitAnswerBtn.IsEnabled = false;
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
            LogBox.ScrollToEnd();
        }

        private void Log(string message)
        {
            Dispatcher.Invoke(() => LogBox.AppendText(message + "\n"));
        }
    }
}