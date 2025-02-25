using System;
using System.Net;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using System.Windows; 
using OWA.WebRTCWPFCaller;
using SIPSorcery.Net;
using SIPSorceryMedia.Abstractions;
using WebSocketSharp.Server;

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
        private bool IsAutomation = false;

        private RTCDataChannel dataChannel;
        public MainWindow()
        {
            InitializeComponent();
        }

        private async void ConnectBtn_Click(object sender, RoutedEventArgs e)
        {
            //var webSocketClient = new WebRTCWebSocketClient(serverUrl, SetupWebRTCAuto);
            //await webSocketClient.Start(default);

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

        private async void SetupWebRTC()
        {
            RTCConfiguration config = new RTCConfiguration
            {
                iceServers = new List<RTCIceServer> {
                new RTCIceServer { urls = "stun:freestun.net:3478" },
                new RTCIceServer { urls = "stun:stun1.l.google.com:19302" },
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
 
            peerConnection.oniceconnectionstatechange += (state) =>
            {
                Log($"✅ ICE Connection State: {peerConnection.iceConnectionState}");
            };

            //peerConnection.ondatachannel += (dc) =>
            //{
            //    Log("✅ Remote – Otrzymano DataChannel z Callera!");
            //    dataChannel = dc;

            //    dataChannel.onopen += () =>
            //    {
            //        Log("✅ DataChannel OTWARTY w Remote!");
            //    };
            //};

            peerConnection.ondatachannel += (dc) =>
            {
                Log("✅ Remote – Otrzymano DataChannel z Callera!");
                dataChannel = dc;
                dc.onerror += (error) =>
                {
                    Log($"❌ Błąd kanału danych: {error}");
                };  
                dc.onmessage += (channel,  protocol, data) =>
                {
                    string receivedMessage = Encoding.UTF8.GetString(data);
                    Log($"📩 Otrzymano wiadomość: {receivedMessage}");
                };
                dc.onopen += () =>
                {

                    Log("✅ Kanał danych OTWARTY w Remote!");

                    // **Testowa wiadomość – sprawdzamy, czy dochodzi do Callera**
                    if (dc != null && dc.readyState == RTCDataChannelState.open)
                    {
                        Log("✅ DataChannel OTWARTY!");
                        Log(dc.id?.ToString());
                        byte[] testMessage = Encoding.UTF8.GetBytes("Test wiadomości po otwarciu kanału [FROM REMOTE]");
                        dc.send(testMessage); 
                    }
                    else
                    {
                        Log("❌ DataChannel jest NULL lub nie jest otwarty!");
                    }
 
                };
            };


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
                    dataChannel.send(message);
                    Log($"📤 Wysłano wiadomość: {message}"); 
                }
            }
            else
            {
                Log("❌ Kanał danych nie jest otwarty! Sprawdzam ICE Connection...");
                Log($"🔍 ICE Connection State: {peerConnection.iceConnectionState}");
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
            //peerConnection?.close();
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


        /////
        ///AUTOMAT
        ///


        private async Task<RTCPeerConnection> SetupWebRTCAuto()
        {
            RTCConfiguration config = new RTCConfiguration
            {
                iceServers = new List<RTCIceServer> {
                new RTCIceServer { urls = "stun:freestun.net:3478" },
                new RTCIceServer { urls = "stun:stun1.l.google.com:19302" },
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

                    var iceMsg = System.Text.Json.JsonSerializer.Serialize(new { type = "candidate", target = callerId, candidate }, options);
                    candidates.Add(candidate);
                }
            };

            peerConnection.oniceconnectionstatechange += (state) =>
            {
                Log($"✅ ICE Connection State: {peerConnection.iceConnectionState}");
            };

            //peerConnection.ondatachannel += (dc) =>
            //{
            //    Log("✅ Remote – Otrzymano DataChannel z Callera!");
            //    dataChannel = dc;

            //    dataChannel.onopen += () =>
            //    {
            //        Log("✅ DataChannel OTWARTY w Remote!");
            //    };
            //};

            peerConnection.ondatachannel += (dc) =>
            {
                Log("✅ Remote – Otrzymano DataChannel z Callera!");
                dataChannel = dc;
                dc.onerror += (error) =>
                {
                    Log($"❌ Błąd kanału danych: {error}");
                };
                dc.onmessage += (channel, protocol, data) =>
                {
                    string receivedMessage = Encoding.UTF8.GetString(data);
                    Log($"📩 Otrzymano wiadomość: {receivedMessage}");
                };
                dc.onopen += () =>
                {

                    Log("✅ Kanał danych OTWARTY w Remote!");

                    // **Testowa wiadomość – sprawdzamy, czy dochodzi do Callera**
                    if (dc != null && dc.readyState == RTCDataChannelState.open)
                    {
                        Log("✅ DataChannel OTWARTY!");
                        Log(dc.id?.ToString());
                        byte[] testMessage = Encoding.UTF8.GetBytes("Test wiadomości po otwarciu kanału [FROM REMOTE]");
                        dc.send(testMessage);
                    }
                    else
                    {
                        Log("❌ DataChannel jest NULL lub nie jest otwarty!");
                    }

                };
            };

             return peerConnection;
        }


        private  Task<RTCPeerConnection> CreatePeerConnection()
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
                    string jsonCandidate = Newtonsoft.Json.JsonConvert.SerializeObject(new { ice = candidate.toJSON(), type = "candidate" });
                    SendSignal(jsonCandidate);
                }
            };

            ps.ondatachannel += (dc) =>
            {
                dataChannel = dc;
                Log("📡 Otrzymano Data Channel");

                // Obsługa zdarzeń DataChannel
                dataChannel.onopen += () => Console.WriteLine("✅ Data Channel opened.");
                dataChannel.onmessage += (dc, protocol, data) =>
                    Log($"📩 Message received: {Encoding.UTF8.GetString(data)}");
                dataChannel.onclose += () => Log("❌ Data Channel closed.");
            };
            dataChannel = ps.createDataChannel("dc1").Result;
            _peerConnection = ps;
            return Task.FromResult(ps);
        }

        private   RTCPeerConnection _peerConnection;
        private   readonly string _clientId = "Remote"; // Identyfikator klienta
          WebSocketServer webSocketServer; 
        ClientWebSocket _wsClient = new ClientWebSocket();
        private async void SendSignal(string message)
        {

            Log($"[{_clientId}] Wysyłanie: {message}");
            var buffer = Encoding.UTF8.GetBytes(message);
            await _wsClient.SendAsync(new ArraySegment<byte>(buffer), WebSocketMessageType.Text, true, CancellationToken.None);
        }

        private async Task ReceiveSignal()
        {
            var buffer = new byte[1024];

            while (_wsClient.State == WebSocketState.Open)
            {
                var result = await _wsClient.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None);
                string message = Encoding.UTF8.GetString(buffer, 0, result.Count);
               Log($"[{_clientId}] Otrzymano: {message}");

                if (message.Contains("\"sdp\""))
                {
                    var sdp = RTCSessionDescriptionInit.TryParse(message, out var initialization);
                    _peerConnection.setRemoteDescription(initialization);

                    var answer = _peerConnection.createAnswer(null);
                    await _peerConnection.setLocalDescription(answer);
                    //SendSignal($"{{\"id\": \"{_clientId}\", \"sdp\": \"{answer.toJSON()}\"}}");

                    var sdpOfferJson = Newtonsoft.Json.JsonConvert.SerializeObject(new { sdp = answer.sdp, type = "answer" });
                    SendSignal(sdpOfferJson);
                }
                else if (message.Contains("\"ice\""))
                {

                    var messageObject = CandidatesIncomming.Create(message);
                    RTCIceCandidateInit.TryParse(messageObject.Ice, out var iceCandidate);
                    candidatesInit.Add(iceCandidate);

                    //{"ice":"{\"candidate\":\"candidate:1068029474 1 udp 2113937663 192.168.0.117 58456 typ host generation 0\",\"sdpMid\":\"0\",\"sdpMLineIndex\":0,\"usernameFragment\":\"OAPF\"}","type":"candidate"}
                    _peerConnection.addIceCandidate(iceCandidate);
                }
            }
        }

        //public   List<RTCIceCandidateInit> candidates = new List<RTCIceCandidateInit>();




        private async void AutoConnectBtn_Click(object sender, RoutedEventArgs e)
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


            Log($"Waiting for web socket connections on {webSocketServer.Address}:{webSocketServer.Port}...");


            var localWS = new ClientWebSocket();
            await localWS.ConnectAsync(new Uri($"ws://{webSocketServer.Address}:{webSocketServer.Port}"), CancellationToken.None);

           
            new Thread(async () =>
            {
                ReceiveSignal();

            }).Start();
            Task.Delay(2000).Wait();

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

            isConnected = true;
            LogBox.ScrollToEnd();
        }

        List<RTCIceCandidateInit> candidatesInit = new List<RTCIceCandidateInit>();
        private void AddIceCandidates()
        {
            Log("Dodawanie ICE Candidates...");
            foreach (var ice in candidatesInit)
                _peerConnection.addIceCandidate(ice);
        }
        private async void AutoWaitOfferBtn_Click(object sender, RoutedEventArgs e)
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
            }
        }

        private async void AutoGenerateAnswerBtn_Click(object sender, RoutedEventArgs e)
        {
            if (!offerReceived) return;

            var answer = peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);

            var answerMsg = JsonSerializer.Serialize(new { type = "answer", target = callerId, answer });
            await SendWebSocketMessage(answerMsg);
            Log($"📡 Wysłano Answer: {answer.sdp}");


            Log($"📡 Oczekiwaie na ICE:");
            _ = Task.Run(ReceiveWebSocketMessages);
            LogBox.ScrollToEnd();

        }

        private async void AutoSendICEBtn_Click(object sender, RoutedEventArgs e)
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

        private void SignalingServerConnectBtn_Click(object sender, RoutedEventArgs e)
        {

        }
    }
}
public class CandidatesIncomming
{
    public string Type { get; set; }

    public string Ice { get; set; }
    public static CandidatesIncomming Create(string input)
    {
        return Newtonsoft.Json.JsonConvert.DeserializeObject<CandidatesIncomming>(input);
    }
}
