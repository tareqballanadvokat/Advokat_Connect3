using System.Net;
using System.Net.Sockets;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using System.Windows;
using System.Windows.Media;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Newtonsoft.Json;
using Serilog;
using Serilog.Extensions.Logging;
using SIPSorcery.Net;
using SIPSorcery.SIP;
using WebSocketSharp.Server;
using JsonSerializer = System.Text.Json.JsonSerializer;

namespace OWA.WebRTCWPFCaller
{
    public enum RTCMethodsEnum
    {
        STUN,
        TURN

    }
    public struct RTCOwnIceServer
    {
        public string url;
        public string username;
        public string credential;
        public RTCMethodsEnum type;
        public override string ToString()
        {
            return $"{type} {url} {username} {credential}";
        }
    }
    public partial class MainWindow : Window
    {
        private static Microsoft.Extensions.Logging.ILogger logger = NullLogger.Instance;
        private ClientWebSocket ws;
        private RTCPeerConnection peerConnection;
        private const string serverUrl = "ws://92.205.233.81:8081";
        private string callerId = "caller";
        private string remoteId = "remote";
        private bool isRemoteDescriptionSet = false;
        private bool isConnected = false;
        private int delay = 2000;
        private RTCDataChannel dataChannel;
        private List<RTCIceCandidate> candicates = new List<RTCIceCandidate>();
        private List<RTCOwnIceServer> rtcIceServers = new List<RTCOwnIceServer>();
        public MainWindow()
        {
            InitializeComponent();
        //    logger = AddConsoleLogger(); 
            var dnses = Dns.GetHostAddresses(Dns.GetHostName());
            SipSignalingServerComboBox.Items.Clear();
            foreach (var dns in dnses)
            {
                SipSignalingServerComboBox.Items.Add(dns);
                Log($"DNS: {dns}");
            }

            RTCOwnIceServer stun1 = new RTCOwnIceServer() { credential = string.Empty, type = RTCMethodsEnum.STUN, url = "stun:freestun.net:3478", username = string.Empty };
            RTCOwnIceServer stun2 = new RTCOwnIceServer() { credential = string.Empty, type = RTCMethodsEnum.STUN, url = "stun:stun1.l.google.com:19302", username = string.Empty };
            RTCOwnIceServer turn = new RTCOwnIceServer() { credential = "free", type = RTCMethodsEnum.TURN, url = "turn:freestun.net:3478", username = "free" };
            rtcIceServers.Add(stun1);
            rtcIceServers.Add(stun2);
            rtcIceServers.Add(turn);

            foreach (var dns in rtcIceServers)
                P2PServersComboBox.Items.Add(dns);

            SipSignalingServerComboBox.SelectedItem = dnses.LastOrDefault();

        }
        /// <summary>
        /// Adds a console logger. Can be omitted if internal SIPSorcery debug and warning messages are not required.
        /// </summary>
        //private static Microsoft.Extensions.Logging.ILogger AddConsoleLogger()
        //{
        //    var seriLogger = new LoggerConfiguration()
        //        .Enrich.FromLogContext()
        //        .MinimumLevel.Is(Serilog.Events.LogEventLevel.Debug)
        //        .WriteTo.Sink().
        //        .CreateLogger();
        //    var factory = new SerilogLoggerFactory(seriLogger);
        //    SIPSorcery.LogFactory.Set(factory);
        //    return factory.CreateLogger<MainWindow>();
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
                    Log($"📤 Message sent: {message}");
                }
            }
            else
            {
                Log("❌ Data channel is closed");
                if (_peerConnection != null)
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
                Log($"📩 Received message from server: {message}");

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
                            Log($"✅ Added ICE Candidate: {candidate.candidate}");
                            break;

                        default:
                            Log($"⚠️ Unrecognised message type received: {type}");
                            break;
                    }

                    _ = Task.Run(ReceiveWebSocketMessages);
                }
                LogBox.ScrollToEnd();
            }
        }



        //private async Task SendWebSocketMessage(string message)
        //{
        //    if (ws.State == WebSocketState.Open)
        //    {
        //        byte[] messageBytes = Encoding.UTF8.GetBytes(message);
        //        await ws.SendAsync(new ArraySegment<byte>(messageBytes), WebSocketMessageType.Text, true, CancellationToken.None);
        //    }
        //    LogBox.ScrollToEnd();
        //}

        private ClientWebSocket _wsClient = new ClientWebSocket();

        private RTCPeerConnection _peerConnection;
        private readonly string _clientId = "Caller"; //auto
        private bool isNodeJsSignalingServer = false;
        private async void AutoConnectBtn_Click(object sender, RoutedEventArgs e)
        {
            var iceServers = new List<RTCIceServer>();
            foreach (RTCOwnIceServer server in rtcIceServers)
            {
                if (server.type == RTCMethodsEnum.STUN)
                {
                    iceServers.Add(new RTCIceServer { urls = server.url });
                }
                else
                {
                    iceServers.Add(new RTCIceServer { urls = server.url, credential = server.credential, credentialType = RTCIceCredentialType.password, username = server.username });
                }
            }

            RTCConfiguration config = new RTCConfiguration
            {
                iceServers = iceServers
            };

            _peerConnection = new RTCPeerConnection(config);
            await _wsClient.ConnectAsync(new Uri($"ws://{SipSignalingServer.Text}/"), CancellationToken.None);
            //await _wsClient.ConnectAsync(new Uri($"ws://92.205.233.81:8081/"), CancellationToken.None);
            Log("Caller connected with signalling server.");
            
            // Data Channel
            dataChannel = await _peerConnection.createDataChannel("dc1");
            dataChannel.onopen += () =>
            {
                Log("📡 Opened Data Channel"); 
                new Thread(() => {
                    Task.Delay(2000).Wait();
                    Log("📡 Opened Data Channel");
                    Dispatcher.Invoke(() => P2PStatusIndicator.Fill = new System.Windows.Media.SolidColorBrush(Colors.Green));
                    Dispatcher.Invoke(() => P2PConnectionStatus.Content = "Connected");
                }).Start();
            };
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

            isConnected = true;
            isNodeJsSignalingServer = true;
            
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
            Log($"[{_clientId}] Sending: {message}");
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
                Log($"[{_clientId}] Received: {message}");

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
            Log("Adding ICE Candidates...");
            foreach (var ice in candidatesInit)
                _peerConnection.addIceCandidate(ice);
        }
        void SendIceCandidates()
        {
            Log("Sending ICE Candidates...");
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
            Dispatcher.Invoke(() => LogBox.AppendText($"{DateTime.Now} : " + message + "\n"));
            Dispatcher.Invoke(() => LogBox.ScrollToEnd());
        }

        private void DestinationName_TextChanged(object sender, System.Windows.Controls.TextChangedEventArgs e)
        {
            remoteId = DestinationName.Text;
        }


        string serverIp = "92.205.233.81:8081";
        IPEndPoint ipEndpointForSip;
        SIPTransport sipTransport = new SIPTransport();
        private async void SignalingServerRegistrationBtn_Click(object sender, RoutedEventArgs e)
        {
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
                await Task.Delay(2000);
                if (acceptResponse != null)
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


                var result = await SendSipMessage(SIPMethodsEnum.REGISTER, string.Empty);
                await Task.Delay(2000);
                if (acceptResponse == null)
                {
                    Log("❌ SIP REGISTER request not accepted.");
                    StatusIndicator.Fill = new System.Windows.Media.SolidColorBrush(Colors.Red);
                    sipTransport.Shutdown();
                    return;
                }
                Log("✅ SIP REGISTER request accepted.");
                acceptResponse = null;
                StatusIndicator.Fill = new System.Windows.Media.SolidColorBrush(Colors.Green);
                isConnected = true;
                SignalingServerRegistrationBtn.Content = "🔗 Unregister";

                Log("✅ ACK request accepted.");
                var ackResult = await SendSipMessage(SIPMethodsEnum.ACK, string.Empty);
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
        SIPResponse ackResponse = null;
        private void BindSipDelegates()
        {
            sipTransport.SIPTransportResponseReceived += (localEndPoint, remoteEndPoint, sipResponse) =>
            {
                Log($"Received SIP response: {sipResponse.Status} ({sipResponse.ReasonPhrase})");
                if (sipResponse.Status == SIPResponseStatusCodesEnum.Accepted)
                {
                    acceptResponse = sipResponse;

                }
                Log("✅ SIP response received ACCEPT.");
                return Task.CompletedTask;
            };

            // Handling incoming messages
            sipTransport.SIPTransportRequestReceived += async (localEndPoint, remoteEndPoint, sipRequestReceived) =>
            {
                Log($"Received SIP request: {sipRequestReceived.Method} from {remoteEndPoint}");

                if (sipRequestReceived.Method == SIPMethodsEnum.MESSAGE)
                {
                    Log($"MESSAGE received from {sipRequestReceived.Header.From.FromURI.User}: {sipRequestReceived.Body}");
                    var okResponse = SIPResponse.GetResponse(sipRequestReceived, SIPResponseStatusCodesEnum.Ok, null);
                    await sipTransport.SendResponseAsync(okResponse);
                }
                if (sipRequestReceived.Method == SIPMethodsEnum.ACK)
                {
                   // Log($"ACK received from {sipRequestReceived.Header.From.FromURI.User}");
                    var okResponse = SIPResponse.GetResponse(sipRequestReceived, SIPResponseStatusCodesEnum.Ok, null);
                    if (ackResponse == null)
                    {

                        //NOTIFY send zawsze po dla pierwszego połączonego callera daje kanał danych
                        await SendSipMessage(SIPMethodsEnum.NOTIFY, string.Empty);
                        ackResponse = okResponse;
                    }

                }
                if (sipRequestReceived.Method == SIPMethodsEnum.NOTIFY)
                {

                    Log($"NOTIFY received from {sipRequestReceived.Header.From.FromURI.User}");
                    //await sipTransport.SendResponseAsync(okResponse);
                    if (!notificationReceived) 
                    {
                        Task.Delay(delay).Wait();
                        //await SendSipMessage(SIPMethodsEnum.ACK, string.Empty);
                        await StartRTCInitialization();
        
                        await AddIceCandidatesVIaSIP();
                        await SendIceCandidatesViaSIP();
                    }
                    notificationReceived = true;
                }


                if (sipRequestReceived.Method == SIPMethodsEnum.SERVICE)
                {
                    var sdp = RTCSessionDescriptionInit.TryParse(sipRequestReceived.Body, out var initialization);
                    Log("SDP Offer Received:");
                    Log(sipRequestReceived.Body);
                    _peerConnection.setRemoteDescription(initialization);
                }


                if (sipRequestReceived.Method == SIPMethodsEnum.INFO)
                {
                    var messageObject = CandidatesIncomming.Create(sipRequestReceived.Body);

                    RTCIceCandidateInit.TryParse(messageObject.Ice, out var iceCandidate);
                    candidatesInit.Add(iceCandidate);
                    Log("ICE Candidate Received: " + sipRequestReceived.Body);
                    // _peerConnection.addIceCandidate(iceCandidate);
                    //      SendSipMessage(SIPMethodsEnum.INFO, iceCandidate);
                }

                LogBox.ScrollToEnd();
            };
        }
         
        bool notificationReceived = false;
        private async Task<bool> StartRTCInitialization()
        {
            var iceServers = new List<RTCIceServer>();
            foreach (RTCOwnIceServer server in rtcIceServers)
            {
                if (server.type == RTCMethodsEnum.STUN)
                {
                    iceServers.Add(new RTCIceServer { urls = server.url });
                }
                else
                {
                    iceServers.Add(new RTCIceServer { urls = server.url, credential = server.credential, credentialType = RTCIceCredentialType.password, username = server.username });
                }
            }

            RTCConfiguration config = new RTCConfiguration
            {
                iceServers = iceServers
            };

            _peerConnection = new RTCPeerConnection(config);
            // Data Channel
            dataChannel = await _peerConnection.createDataChannel("dc1");
            dataChannel.onopen += () =>
            {
                Log("Data Channel opened.");
                new Thread(() => {
                    Task.Delay(2000).Wait();
                    Log("📡 Opened Data Channel");
                    Dispatcher.Invoke(() => P2PStatusIndicator.Fill = new System.Windows.Media.SolidColorBrush(Colors.Green));
                    Dispatcher.Invoke(() => P2PConnectionStatus.Content = "Connected");
                }).Start();

                //P2PStatusIndicator.Fill = new System.Windows.Media.SolidColorBrush(Colors.Green);
                //P2PConnectionStatus.Content = "Connected";
            };
            dataChannel.onmessage += (dc, protocol, data) =>
                Log($"Message received: {Encoding.UTF8.GetString(data)}");
            dataChannel.onclose += () => Log("Data Channel closed.");

            _peerConnection.onicecandidate += async (candidate) =>
            {
                Console.WriteLine("onicecandidate invoked.");
                if (candidate != null)
                {
                    string jsonCandidate = JsonConvert.SerializeObject(new { ice = candidate.toJSON(), type = "candidate" });
                    sendCandidates.Add(jsonCandidate);
                }
            };

            _peerConnection.onnegotiationneeded += async () =>
            {
                Log("Negotiation needed.");
            };

            await CreateAndSendOfferViaSIP();

            return true;
        }
        private async Task CreateAndSendOfferViaSIP()
        {
            var offer = _peerConnection.createOffer(null);
            await _peerConnection.setLocalDescription(offer);

            Log("SDP Offer Created:");
            Log(offer.sdp);

            var sdpOfferJson = JsonConvert.SerializeObject(new { sdp = offer.sdp, type = "offer" });
            //SendSignalViaSIP(sdpOfferJson);
            await SendSipMessage(SIPMethodsEnum.SERVICE, sdpOfferJson);
        }


        async Task AddIceCandidatesVIaSIP()
        {
            Log("Adding ICE Candidates...");
            foreach (var ice in candidatesInit)
                _peerConnection.addIceCandidate(ice);
        }
        async Task SendIceCandidatesViaSIP()
        {
            Log("Sending ICE Candidates...");
            foreach (var ice in sendCandidates)
            {
                SendSipMessage(SIPMethodsEnum.INFO, ice);
            }
        }

        private void SendMessageViaSignalingServerBtn_Click(object sender, RoutedEventArgs e)
        {
            SendSipMessage(SIPMethodsEnum.MESSAGE, MessageBox.Text);
        }

        private void P2PDisconnectBtn_Click(object sender, RoutedEventArgs e)
        {
            if (dataChannel != null) dataChannel.close();
            if (_peerConnection != null) { _peerConnection.close(); _peerConnection = null; }
            if (ws != null)
            {
                ws.CloseAsync(WebSocketCloseStatus.NormalClosure, "Closed", CancellationToken.None);
                ws = null;
            }

           
            isConnected = false;
            candidatesInit.Clear();
            StatusIndicator.Fill = new System.Windows.Media.SolidColorBrush(Colors.Red);
            P2PStatusIndicator.Fill = new System.Windows.Media.SolidColorBrush(Colors.Red);
            ConnectionStatus.Content = "Disconnected";
            P2PConnectionStatus.Content = "Disconnected";
            Log("Disconnected");
        }

        private void P2PAddTurnBtn_Click(object sender, RoutedEventArgs e)
        {
            if (P2PTurnPasswdTextBox.Text == string.Empty || P2PTurnLoginTextBox.Text == string.Empty || P2PTurnUrlTextBox.Text == string.Empty)
            {
                Log("❌ TURN server data missing. Correct format Url 'turn:xxx.yyy.zzz:432' ");
                return;
            }

            RTCOwnIceServer RtcOwnIceServer = new RTCOwnIceServer
            {
                credential = P2PTurnPasswdTextBox.Text,
                type = RTCMethodsEnum.TURN,
                url = P2PTurnUrlTextBox.Text,
                username = P2PTurnLoginTextBox.Text
            };

            P2PServersComboBox.Items.Add(RtcOwnIceServer);
            rtcIceServers.Add(RtcOwnIceServer);
            Log("Added TURN server: " + RtcOwnIceServer);
        }

        private void P2PAddStunBtn_Click(object sender, RoutedEventArgs e)
        {
            RTCOwnIceServer RtcOwnIceServer = new RTCOwnIceServer
            {
                credential = string.Empty,
                type = RTCMethodsEnum.STUN,
                url = P2PTurnUrlTextBox.Text,
                username = string.Empty
            };

            P2PServersComboBox.Items.Add(RtcOwnIceServer);
            rtcIceServers.Add(RtcOwnIceServer);
            Log("Added STUN server: " + RtcOwnIceServer);
        }
        private void DelayMilisecondsTextBox_TextChanged(object sender, System.Windows.Controls.TextChangedEventArgs e)
        {
            delay = Convert.ToInt32(DelayMilisecondsTextBox.Text);
        }
        private void P2PRemoveStunBtn_Click(object sender, RoutedEventArgs e)
        {
            var index = P2PServersComboBox.SelectedIndex;
            P2PServersComboBox.Items.RemoveAt(index);

            rtcIceServers.RemoveAt(index);
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
