using System.Net;
using System.Net.Sockets;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using System.Windows;
using System.Windows.Media;
using Newtonsoft.Json;
using SIPSorcery.Net;
using SIPSorcery.SIP;
using JsonSerializer = System.Text.Json.JsonSerializer;

namespace OWA.WebRTCWPFCaller
{
    public partial class MainWindow : Window
    {
        private ClientWebSocket ws;
        private RTCPeerConnection peerConnection;
        private const string serverUrl = "ws://92.205.233.81:8081";
        private string callerId = "caller";
        private string remoteId = "remote";
        private bool isRemoteDescriptionSet = false;
        private bool isConnected = false;
        private RTCDataChannel dataChannel;
        List<RTCIceCandidate> candicates = new List<RTCIceCandidate>();

        public MainWindow()
        {
            InitializeComponent();
            Log($"POSSIBLE DNSes");
            var dnses = Dns.GetHostAddresses(Dns.GetHostName());
            SipSignalingServerComboBox.Items.Clear();
            foreach (var dns in dnses)
            {
                SipSignalingServerComboBox.Items.Add(dns);
                Log($"DNS: {dns}");
            }
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
                }
            }
            else
            {
                Log("❌ Kanał danych nie jest otwarty! Sprawdzam ICE Connection...");
                Log($"🔍 ICE Connection State: {_peerConnection.iceConnectionState}");
            }
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
                            break;

                        default:
                            Log($"⚠️ Otrzymano nieznany typ wiadomości: {type}");
                            break;
                    }

                    _ = Task.Run(ReceiveWebSocketMessages);
                }
                LogBox.ScrollToEnd();
            }
        }

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
            peerConnection.oniceconnectionstatechange += (state) =>
            {
                Log($"✅ ICE Connection State: {peerConnection.iceConnectionState}");
            };

            dataChannel = await peerConnection.createDataChannel("dc1", new RTCDataChannelInit { negotiated = false, ordered = true });// new RTCDataChannelInit { id = 1, negotiated = true });
            dataChannel.onopen += () =>
            {
                Log("✅ DataChannel OTWARTY!");
                Log(dataChannel.id?.ToString());
                byte[] testMessage = Encoding.UTF8.GetBytes("Test wiadomości po otwarciu kanału [FROM CALLER]");
                dataChannel.send(testMessage);
                LogBox.ScrollToEnd();
            };

            dataChannel.onclose += () => { dataChannel.send("Bye"); };
            dataChannel.onmessage += (datachan, type, data) =>
            {
                switch (type)
                {
                    case DataChannelPayloadProtocols.WebRTC_Binary_Empty:
                    case DataChannelPayloadProtocols.WebRTC_String_Empty:
                        break;

                    case DataChannelPayloadProtocols.WebRTC_Binary:

                        break;

                    case DataChannelPayloadProtocols.WebRTC_String:
                        var msg = Encoding.UTF8.GetString(data);

                        break;
                }
            };
        }

        private async void OfferBtn_Click(object sender, RoutedEventArgs e)
        {
            await SetupWebRTC();
            var offer = peerConnection.createOffer();
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
                Log($"⏳ Oczekiwaie na ICE:");
            }


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

            _ = Task.Run(ReceiveWebSocketMessages);
            LogBox.ScrollToEnd();
        }

        private async void DisconnectBtn_Click(object sender, RoutedEventArgs e)
        {
            Log("❌ Rozłączanie...");
            isConnected = false;
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

        private ClientWebSocket _wsClient = new ClientWebSocket();

        private RTCPeerConnection _peerConnection;
        private readonly string _clientId = "Caller"; //auto

        private async void AutoConnectBtn_Click(object sender, RoutedEventArgs e)
        {
            RTCConfiguration config = new RTCConfiguration
            {
                iceServers = new List<RTCIceServer> {
                    new RTCIceServer { urls = "stun:freestun.net:3478" },
                    new RTCIceServer { urls = "stun:stun1.l.google.com:19302" },
                    new RTCIceServer { urls = "turn:freestun.net:3478", credential = "free", credentialType = RTCIceCredentialType.password, username = "free" }
                }
            };
            _peerConnection = new RTCPeerConnection(config);
            await _wsClient.ConnectAsync(new Uri("ws://92.205.233.81:8081/"), CancellationToken.None);
            Log("Caller połączony z serwerem sygnalizacyjnym.");

            // Data Channel
            dataChannel = await _peerConnection.createDataChannel("dc1");
            dataChannel.onopen += () => Log("Data Channel opened.");
            dataChannel.onmessage += (dc, protocol, data) =>
                Log($"Message received: {Encoding.UTF8.GetString(data)}");
            dataChannel.onclose += () => Log("Data Channel closed.");

            _peerConnection.onicecandidate += (candidate) =>
            {
                Console.WriteLine("onicecandidate invoked.");
                if (candidate != null)
                {
                    string jsonCandidate = JsonConvert.SerializeObject(new { ice = candidate.toJSON(), type = "candidate" });
                    //      SendSignal(jsonCandidate);
                    sendCandidates.Add(jsonCandidate);
                }
            };

            _peerConnection.onnegotiationneeded += async () =>
            {
                Log("Negotiation needed.");
            };

            await CreateAndSendOffer();

            new Thread(async () =>
            {
                ReceiveSignal();

            }).Start();
            new Thread(async () =>
            {
                Task.Delay(2000).Wait();
                AddIceCandidates();
                SendIceCandidates();
            }).Start();
            new Thread(async () =>
            {
                Task.Delay(20000).Wait();
                dataChannel.send("client sended");
            }).Start();
            Log("Naciśnij ENTER, aby rozpocząć połączenie...");

            isConnected = true;
            LogBox.ScrollToEnd();
        }




        private async Task CreateAndSendOffer()
        {
            var offer = _peerConnection.createOffer(null);
            await _peerConnection.setLocalDescription(offer);

            Log("SDP Offer Created:");
            Log(offer.sdp);

            var sdpOfferJson = JsonConvert.SerializeObject(new { sdp = offer.sdp, type = "offer" });
            SendSignal(sdpOfferJson);
        }
        async void SendSignal(string message)
        {
            Log($"[{_clientId}] Wysyłanie: {message}");
            var buffer = Encoding.UTF8.GetBytes(message);
            await _wsClient.SendAsync(new ArraySegment<byte>(buffer), WebSocketMessageType.Text, true, CancellationToken.None);
        }
        public List<RTCIceCandidateInit> candidatesInit = new List<RTCIceCandidateInit>();
        public List<string> sendCandidates = new List<string>();

        async Task ReceiveSignal()
        {
            var buffer = new byte[1024];

            while (_wsClient.State == System.Net.WebSockets.WebSocketState.Open)
            {
                var result = await _wsClient.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None);
                string message = Encoding.UTF8.GetString(buffer, 0, result.Count);
                Log($"[{_clientId}] Otrzymano: {message}");

                if (message.Contains("\"sdp\""))
                {
                    var sdp = RTCSessionDescriptionInit.TryParse(message, out var initialization);
                    _peerConnection.setRemoteDescription(initialization);
                }
                else if (message.Contains("\"ice\""))
                {
                    var messageObject = CandidatesIncomming.Create(message);

                    RTCIceCandidateInit.TryParse(messageObject.Ice, out var iceCandidate);
                    candidatesInit.Add(iceCandidate);
                    //_peerConnection.addIceCandidate(iceCandidate);
                }
            }
        }

        void AddIceCandidates()
        {
            Log("Dodawanie ICE Candidates...");
            foreach (var ice in candidatesInit)
                _peerConnection.addIceCandidate(ice);
        }
        void SendIceCandidates()
        {
            Log("Dodawanie ICE Candidates...");
            foreach (var ice in sendCandidates)
            {
                // string jsonCandidate = JsonConvert.SerializeObject(new { ice = candidate.toJSON(), type = "candidate" });
                SendSignal(ice);
            }
        }


        /// <summary>
        /// EVENTS HANDLERS
        /// </summary>
        /// <param name="sender"></param>
        /// <param name="e"></param>
        private async void SignalingServerConnectBtn_Click(object sender, RoutedEventArgs e)
        {
            if (isConnected)
            {
                //disconnect
                Log("Disconnecting...");
                await _wsClient.CloseAsync(WebSocketCloseStatus.NormalClosure, "Client initiated close", CancellationToken.None);
                isConnected = false;
                _wsClient?.Abort();
                _wsClient?.Dispose();
                StatusIndicator.Fill = new System.Windows.Media.SolidColorBrush(Colors.Red);
                Log("❌ SIGNALING server Disconected");
                _wsClient = new ClientWebSocket();
                ConnectionStatus.Content = "Disconnected";
                SignalingServerConnectBtn.Content = "🔗Connect";
            }
            else
            {
                //connect
                Log("Connecting to the SIGNALING Server...");
                StatusIndicator.Fill = new System.Windows.Media.SolidColorBrush(Colors.Yellow);
                await _wsClient.ConnectAsync(new Uri(SignalingServer.Text), CancellationToken.None);
                if (_wsClient.State == WebSocketState.Open)
                {
                    StatusIndicator.Fill = new System.Windows.Media.SolidColorBrush(Colors.Green);
                    Log("🔗 SIGNALING server connected");
                    isConnected = true;
                    ConnectionStatus.Content = "Connected";
                    SignalingServerConnectBtn.Content = "❌ Disconnect";
                }
                else
                {
                    SignalingServerConnectBtn.Content = "🔗Connect";
                    Log("❌ Connection to the SIGNALING server failed.");
                    ConnectionStatus.Content = "Disconnected";
                    StatusIndicator.Fill = new System.Windows.Media.SolidColorBrush(Colors.Red);
                }
            }
        }

        private void RegistrationName_TextChanged(object sender, System.Windows.Controls.TextChangedEventArgs e)
        {
            callerId = RegistrationName.Text;
        }

        private void Log(string message)
        {
            Dispatcher.Invoke(() => LogBox.AppendText(message + "\n"));
        }

        private void DestinationName_TextChanged(object sender, System.Windows.Controls.TextChangedEventArgs e)
        {
            remoteId = DestinationName.Text;
        }


        string serverIp = "92.205.233.81:8081";
        IPEndPoint ipEndpointForSip;
        SIPTransport sipTransport = new SIPTransport();
        bool waitForSipAcceptResponse = false;
        private async void SignalingServerRegistrationBtn_Click(object sender, RoutedEventArgs e)
        {
            //var ips = Dns.GetHostAddresses(Dns.GetHostName());
            if (SipSignalingServerComboBox.SelectedValue == null)
            {
                Log("❌ Select DNS IP Address missing");
                return;
            }
            ipEndpointForSip = new IPEndPoint(IPAddress.Parse(SipSignalingServerComboBox.SelectedValue.ToString()), Convert.ToInt32(DnsIPAndPort.Text));
            serverIp = SipSignalingServer.Text;
            if (isConnected)
            {
                //disconnect
                Log("SIP Server Disconnecting...");
                await SendSipMessage(SIPMethodsEnum.BYE, string.Empty);
                waitForSipAcceptResponse = true;
                await Task.Delay(2000);
                if (acceptResponse!= null)
                {
                    Log("✅ SIP BYE request accepted.");
                    acceptResponse = null;
                }
                else
                {
                    Log("❌ SIP BYE request not accepted.");
                    return;
                }
                isConnected = false;
                sipTransport.Shutdown();
                StatusIndicator.Fill = new System.Windows.Media.SolidColorBrush(Colors.Red);
                Log("❌ SIGNALING SIP Server Disconected");
                ConnectionStatus.Content = "Disconnected";
                SignalingServerRegistrationBtn.Content = "🔗Register";

            }
            else
            {
                //connect
                Log("Connecting to the SIGNALING SIP Server...");
                StatusIndicator.Fill = new System.Windows.Media.SolidColorBrush(Colors.Yellow);
                sipTransport = new SIPTransport();
                var clientChannel = new SIPUDPChannel(ipEndpointForSip);
                sipTransport.AddSIPChannel(clientChannel); 

                BindSipDelegates();

                waitForSipAcceptResponse = true;
 
                var result = await SendSipMessage(SIPMethodsEnum.REGISTER, string.Empty);
                await Task.Delay(2000);
                if (acceptResponse == null)
                {
                    Log("❌ SIP REGISTER request not accepted.");
                    StatusIndicator.Fill = new System.Windows.Media.SolidColorBrush(Colors.Red);
                    return;
                }
                Log("✅ SIP REGISTER request accepted.");
                acceptResponse = null;
                StatusIndicator.Fill = new System.Windows.Media.SolidColorBrush(Colors.Green);
                isConnected = true;
                SignalingServerRegistrationBtn.Content = "🔗 Unregister";
            }
        }

        private async Task<bool> SendSipMessage(SIPMethodsEnum type, string body)
        {
            var registerRequest = SIPRequest.GetRequest(type, new SIPURI(null, serverIp, null));

            registerRequest.Header.From = new SIPFromHeader(callerId, new SIPURI(callerId, ipEndpointForSip.ToString(), null), null);
            registerRequest.Header.To = new SIPToHeader(remoteId, new SIPURI(remoteId, serverIp, null), "TAG");
            registerRequest.Header.CSeq = 1;
            registerRequest.Header.CallId = CallProperties.CreateNewCallId();
            registerRequest.Header.MaxForwards = 70;
            registerRequest.Body = body;
            registerRequest.Header.Contact = new List<SIPContactHeader> { new SIPContactHeader(null, new SIPURI(callerId, ipEndpointForSip.ToString(), string.Empty)) };

            var response = await sipTransport.SendRequestAsync(registerRequest);
            if (response == SocketError.Success)
            {
                Log("✅ SIP request sent successfully. " + type);
                return true;
            }
            else
            {
                Log($"❌ Failed to send SIP request: {response}");
                return false;
            }
        }

        SIPResponse acceptResponse = null;
        private void BindSipDelegates()
        {
            sipTransport.SIPTransportResponseReceived += (localEndPoint, remoteEndPoint, sipResponse) =>
            {
                Log($"Received SIP response: {sipResponse.Status} ({sipResponse.ReasonPhrase})");
                if (sipResponse.Status == SIPResponseStatusCodesEnum.Accepted)
                {
                    acceptResponse = sipResponse;
                    waitForSipAcceptResponse = false;
                   
                }
                Log("✅ SIP response received ACCEPT.");
                return Task.CompletedTask;
            };

            // Handling incoming messages
            sipTransport.SIPTransportRequestReceived += async (localEndPoint, remoteEndPoint, sipRequest) =>
            {
                Log($"Received SIP request: {sipRequest.Method} from {remoteEndPoint}");

                if (sipRequest.Method == SIPMethodsEnum.MESSAGE)
                {
                    Console.WriteLine($"MESSAGE received from {sipRequest.Header.From.FromURI.User}: {sipRequest.Body}");
                    var okResponse = SIPResponse.GetResponse(sipRequest, SIPResponseStatusCodesEnum.Ok, null);
                    await sipTransport.SendResponseAsync(okResponse);
                }
            };
        }
        private void SendMessageViaSignalingServerBtn_Click(object sender, RoutedEventArgs e)
        {
            SendSipMessage(SIPMethodsEnum.MESSAGE, MessageBox.Text);
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
