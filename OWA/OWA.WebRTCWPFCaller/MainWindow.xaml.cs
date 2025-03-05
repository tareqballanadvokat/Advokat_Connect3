using System.Net;
using System.Net.Sockets;
using System.Net.WebSockets;
using System.Text;
using System.Windows;
using System.Windows.Media;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Newtonsoft.Json;
using Serilog;
using Serilog.Extensions.Logging;
using SIPSorcery.Net;
using SIPSorcery.SIP;

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
        private string _callerId = "caller";
        private string _remoteId = "remote";
        private string _serverIp = "92.205.233.81:8081";
        private bool _isConnected = false;
        private bool _notificationReceived = false;
        private int _delay = 2000;
        private IPEndPoint _sipProtocolIPEndpoint;
        private SIPTransport _sipTransport = new SIPTransport();
        private ClientWebSocket _wsClient = new ClientWebSocket();
        private List<RTCIceCandidateInit> _iceCandidateList = new List<RTCIceCandidateInit>();
        private List<string> _nodeJSSendCandidateList = new List<string>();
        private RTCPeerConnection _peerConnection;
        private RTCDataChannel _dataChannel;
        private List<RTCOwnIceServer> _rtcStunServerList = new List<RTCOwnIceServer>();


        SIPResponse acceptResponse;
        SIPResponse ackResponse;
        public MainWindow()
        {
            InitializeComponent();
            logger = AddConsoleLogger();
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
            _rtcStunServerList.Add(stun1);
            _rtcStunServerList.Add(stun2);
            _rtcStunServerList.Add(turn);

            foreach (var dns in _rtcStunServerList)
            {
                P2PServersComboBox.Items.Add(dns);
            }

            SipSignalingServerComboBox.SelectedItem = dnses.LastOrDefault();

        }
        // Existing code...



        private async Task NodeJSCreateAndSendOffer()
        {
            var offer = _peerConnection.createOffer(null);
            await _peerConnection.setLocalDescription(offer);

            Log("SDP Offer Created:");
            Log(offer.sdp);

            var sdpOfferJson = JsonConvert.SerializeObject(new { sdp = offer.sdp, type = "offer" });
            NodeJsSendSignal(sdpOfferJson);
        }

        private async Task NodeJSReceiveSignals()
        {
            var buffer = new byte[1024];

            while (_wsClient.State == System.Net.WebSockets.WebSocketState.Open)
            {
                var result = await _wsClient.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None);
                string message = Encoding.UTF8.GetString(buffer, 0, result.Count);
                Log($"[{_callerId}] Received: {message}");

                if (message.Contains("\"sdp\""))
                {
                    var sdp = RTCSessionDescriptionInit.TryParse(message, out var initialization);
                    _peerConnection.setRemoteDescription(initialization);
                }
                else if (message.Contains("\"ice\""))
                {
                    var messageObject = CandidatesIncomming.Create(message);

                    RTCIceCandidateInit.TryParse(messageObject.Ice, out var iceCandidate);
                    _iceCandidateList.Add(iceCandidate);
                    //_peerConnection.addIceCandidate(iceCandidate);
                }
            }
        }



        private void BindSipDelegates()
        {
            _sipTransport.SIPTransportResponseReceived += (localEndPoint, remoteEndPoint, sipResponse) =>
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
            _sipTransport.SIPTransportRequestReceived += async (localEndPoint, remoteEndPoint, sipRequestReceived) =>
            {
                Log($"Received SIP request: {sipRequestReceived.Method} from {remoteEndPoint}");

                if (sipRequestReceived.Method == SIPMethodsEnum.MESSAGE)
                {
                    Log($"MESSAGE received from {sipRequestReceived.Header.From.FromURI.User}: {sipRequestReceived.Body}");
                    var okResponse = SIPResponse.GetResponse(sipRequestReceived, SIPResponseStatusCodesEnum.Ok, null);
                    await _sipTransport.SendResponseAsync(okResponse);
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
                    if (!_notificationReceived)
                    {
                        Task.Delay(_delay).Wait();
                        await StartRTCInitialization();
                        //not used if lists are empty
                        //await AddIceCandidatesVIaSIP();
                        //await SendIceCandidatesViaSIP();
                    }
                    _notificationReceived = true;
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
                    Log("ICE Candidate Received: " + sipRequestReceived.Body);
                     _peerConnection.addIceCandidate(iceCandidate);
                }

                LogBox.ScrollToEnd();
            };
        }
        private void NodeJSAddIceCandidates()
        {
            Log("Adding ICE Candidates...");
            foreach (var ice in _iceCandidateList)
                _peerConnection.addIceCandidate(ice);
        }
        private void NodeJSSendIceCandidates()
        {
            Log("Sending ICE Candidates...");
            foreach (var ice in _nodeJSSendCandidateList)
            {
                // string jsonCandidate = JsonConvert.SerializeObject(new { ice = candidate.toJSON(), type = "candidate" });
                NodeJsSendSignal(ice);
            }
        }

        private async Task<bool> StartRTCInitialization()
        {
            var iceServers = new List<RTCIceServer>();
            foreach (RTCOwnIceServer server in _rtcStunServerList)
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
            _dataChannel = await _peerConnection.createDataChannel("dc1", null);
            _dataChannel.onopen += () =>
            {
                Log("Data Channel opened.");
                new Thread(() =>
                {
                    Task.Delay(2000).Wait();
                    Log("📡 Opened Data Channel");
                    Dispatcher.Invoke(() => P2PStatusIndicator.Fill = new System.Windows.Media.SolidColorBrush(Colors.Green));
                    Dispatcher.Invoke(() => P2PConnectionStatus.Content = "Connected");
                }).Start();
            };
            _dataChannel.onmessage += (dc, protocol, data) =>
                Log($"Message received: {Encoding.UTF8.GetString(data)}");
            _dataChannel.onclose += () => Log("Data Channel closed.");

            _peerConnection.onicecandidate += async (candidate) =>
            {
                Console.WriteLine("onicecandidate invoked.");
                if (candidate != null)
                {
                    string jsonCandidate = JsonConvert.SerializeObject(new { ice = candidate.toJSON(), type = "candidate" });
                    await SendSipMessage(SIPMethodsEnum.INFO, jsonCandidate);
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
            await SendSipMessage(SIPMethodsEnum.SERVICE, sdpOfferJson);
        }
        private async Task AddIceCandidatesVIaSIP()
        {
            Log("Adding ICE Candidates...");
            foreach (var ice in _iceCandidateList)
            {
                _peerConnection.addIceCandidate(ice);
            }
        }
        private async Task SendIceCandidatesViaSIP()
        {
            Log("Sending ICE Candidates...");
            foreach (var ice in _nodeJSSendCandidateList)
            {
                await SendSipMessage(SIPMethodsEnum.INFO, ice);
            }
        }

        private async void NodeJsSendSignal(string message)
        {
            Log($"[{_callerId}] Sending: {message}");
            var buffer = Encoding.UTF8.GetBytes(message);
            await _wsClient.SendAsync(new ArraySegment<byte>(buffer), WebSocketMessageType.Text, true, CancellationToken.None);
        }

        private async Task<bool> SendSipMessage(SIPMethodsEnum type, string body)
        {
            var registerRequest = SIPRequest.GetRequest(type, new SIPURI(null, _serverIp, null));

            registerRequest.Header.From = new SIPFromHeader(_callerId, new SIPURI(_callerId, _sipProtocolIPEndpoint.ToString(), null), null);
            registerRequest.Header.To = new SIPToHeader(_remoteId, new SIPURI(_remoteId, _serverIp, null), "TAG");
            registerRequest.Header.CSeq = 1;
            registerRequest.Header.CallId = CallProperties.CreateNewCallId();
            registerRequest.Header.MaxForwards = 70;
            registerRequest.Body = body;
            registerRequest.Header.Contact = new List<SIPContactHeader> { new SIPContactHeader(null, new SIPURI(_callerId, _sipProtocolIPEndpoint.ToString(), string.Empty)) };

            var response = await _sipTransport.SendRequestAsync(registerRequest);
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

        private void Log(string message)
        {
            Dispatcher.Invoke(() => LogBox.AppendText($"{DateTime.Now} : " + message + "\n"));
            Dispatcher.Invoke(() => LogBox.ScrollToEnd());
            logger.LogInformation($"----->: " + message);
        }

        /// <summary>
        /// EVENTS HANDLERS
        /// </summary>
        /// <param name="sender"></param>
        /// <param name="e"></param>
        /// 

        private async void AutoConnectBtn_Click(object sender, RoutedEventArgs e)
        {
            var iceServers = new List<RTCIceServer>();
            foreach (RTCOwnIceServer server in _rtcStunServerList)
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
            _dataChannel = await _peerConnection.createDataChannel("dc1");
            _dataChannel.onopen += () =>
            {
                Log("📡 Opened Data Channel");
                new Thread(() =>
                {
                    Task.Delay(2000).Wait();
                    Log("📡 Opened Data Channel");
                    Dispatcher.Invoke(() => P2PStatusIndicator.Fill = new System.Windows.Media.SolidColorBrush(Colors.Green));
                    Dispatcher.Invoke(() => P2PConnectionStatus.Content = "Connected");
                }).Start();
            };
            _dataChannel.onmessage += (dc, protocol, data) =>
            Log($"Message received: {Encoding.UTF8.GetString(data)}");
            _dataChannel.onclose += () => Log("Data Channel closed.");

            _peerConnection.onicecandidate += (candidate) =>
            {
                Console.WriteLine("onicecandidate invoked.");
                if (candidate != null)
                {
                    string jsonCandidate = JsonConvert.SerializeObject(new { ice = candidate.toJSON(), type = "candidate" });
                    //      SendSignal(jsonCandidate);
                    _nodeJSSendCandidateList.Add(jsonCandidate);
                }
            };

            _peerConnection.onnegotiationneeded += async () =>
            {
                Log("Negotiation needed.");
            };

            await NodeJSCreateAndSendOffer();

            new Thread(async () =>
            {
                await NodeJSReceiveSignals();

            }).Start();
            new Thread(async () =>
            {
                Task.Delay(2000).Wait();
                NodeJSAddIceCandidates();
                NodeJSSendIceCandidates();
            }).Start();
            new Thread(async () =>
            {
                Task.Delay(20000).Wait();
                _dataChannel.send("client sended");
            }).Start();

            _isConnected = true;

        }


        private async void SignalingServerConnectBtn_Click(object sender, RoutedEventArgs e)
        {
            if (_isConnected)
            {
                //disconnect
                Log("Disconnecting...");
                await _wsClient.CloseAsync(WebSocketCloseStatus.NormalClosure, "Client initiated close", CancellationToken.None);
                _isConnected = false;
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
                    _isConnected = true;
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
            _callerId = RegistrationName.Text;
        }



        private void DestinationName_TextChanged(object sender, System.Windows.Controls.TextChangedEventArgs e)
        {
            _remoteId = DestinationName.Text;
        }

        private async void SignalingServerRegistrationBtn_Click(object sender, RoutedEventArgs e)
        {
            if (SipSignalingServerComboBox.SelectedValue == null)
            {
                Log("❌ Select DNS IP Address missing");
                return;
            }
            _sipProtocolIPEndpoint = new IPEndPoint(IPAddress.Parse(SipSignalingServerComboBox.SelectedValue.ToString()), Convert.ToInt32(DnsIPAndPort.Text));
            _serverIp = SipSignalingServer.Text;
            if (_isConnected)
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
                _isConnected = false;
                _sipTransport.Shutdown();
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
                _sipTransport = new SIPTransport();
                var clientChannel = new SIPUDPChannel(_sipProtocolIPEndpoint);
                _sipTransport.AddSIPChannel(clientChannel);

                BindSipDelegates();


                var result = await SendSipMessage(SIPMethodsEnum.REGISTER, string.Empty);
                await Task.Delay(2000);
                if (acceptResponse == null)
                {
                    Log("❌ SIP REGISTER request not accepted.");
                    StatusIndicator.Fill = new System.Windows.Media.SolidColorBrush(Colors.Red);
                    _sipTransport.Shutdown();
                    return;
                }
                Log("✅ SIP REGISTER request accepted.");
                acceptResponse = null;
                StatusIndicator.Fill = new System.Windows.Media.SolidColorBrush(Colors.Green);
                _isConnected = true;
                SignalingServerRegistrationBtn.Content = "🔗 Unregister";

                Log("✅ ACK request accepted.");
                var ackResult = await SendSipMessage(SIPMethodsEnum.ACK, string.Empty);
            }
        }

        private void SendMessageViaSignalingServerBtn_Click(object sender, RoutedEventArgs e)
        {
            SendSipMessage(SIPMethodsEnum.MESSAGE, MessageBox.Text);
        }

        private void P2PDisconnectBtn_Click(object sender, RoutedEventArgs e)
        {
            if (_dataChannel != null) _dataChannel.close();
            if (_peerConnection != null) { _peerConnection.close(); _peerConnection = null; }


            _isConnected = false;
            _iceCandidateList.Clear();
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
            _rtcStunServerList.Add(RtcOwnIceServer);
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
            _rtcStunServerList.Add(RtcOwnIceServer);
            Log("Added STUN server: " + RtcOwnIceServer);
        }
        private void DelayMilisecondsTextBox_TextChanged(object sender, System.Windows.Controls.TextChangedEventArgs e)
        {
            _delay = Convert.ToInt32(DelayMilisecondsTextBox.Text);
        }
        private async void SendMessageBtn_Click(object sender, RoutedEventArgs e)
        {
            if (_dataChannel != null && _dataChannel.readyState == RTCDataChannelState.open)
            {
                string message = MessageBox.Text;
                if (!string.IsNullOrWhiteSpace(message))
                {
                    byte[] messageBytes = Encoding.UTF8.GetBytes(message);
                    _dataChannel.send(messageBytes);
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

        private void P2PRemoveStunBtn_Click(object sender, RoutedEventArgs e)
        {
            var index = P2PServersComboBox.SelectedIndex;
            P2PServersComboBox.Items.RemoveAt(index);

            _rtcStunServerList.RemoveAt(index);
        }

        private static Microsoft.Extensions.Logging.ILogger AddConsoleLogger()
        {
            var logFilePath = $"logs/caller_{DateTime.Now:yyyyMMdd_HHmmss}.txt";
            var seriLogger = new LoggerConfiguration()
                .Enrich.FromLogContext()
                .MinimumLevel.Is(Serilog.Events.LogEventLevel.Debug)
                .WriteTo.File(logFilePath) // This line replaces the incorrect Console method
                .CreateLogger();
            var factory = new SerilogLoggerFactory(seriLogger);
            SIPSorcery.LogFactory.Set(factory);
            return factory.CreateLogger<MainWindow>();
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
