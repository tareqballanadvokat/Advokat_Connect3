using System;
using System.Net;
using System.Net.Sockets;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Media;
using System.Windows.Threading;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Org.BouncyCastle.Crypto.Prng;
using OWA.WebRTCWPFCaller;
using Serilog;
using Serilog.Extensions.Logging;
using SIPSorcery.Net;
using SIPSorcery.SIP;
using SIPSorceryMedia.Abstractions;
using WebSocketSharp.Server;

namespace OWA.WebRTCWPFRemote
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
        private static Microsoft.Extensions.Logging.ILogger _logger = NullLogger.Instance;
        private string _remoteId = "remote";
        private string _callerId = "caller"; 
        private int _delay = 2000;

        private bool _isConnected = false;
        private bool _notificationReceived = false;
        private bool _isNodeJsSignalingServer = false;
        private string p2pIpSelected = string.Empty;
        private string p2pPortSelected = string.Empty;
        private string _serverIp = "92.205.233.81:8081";

        private RTCDataChannel _dataChannel;
        private RTCPeerConnection _peerConnection;

        private SIPResponse _acceptResponse;
        private SIPResponse _ackResponse;

        private WebSocketServer _webSocketServer;
        private IPEndPoint _sipProtocolIPEndpoint;
        private ClientWebSocket _wsClient = new ClientWebSocket();
        private SIPTransport _sipTransport = new SIPTransport();

        private List<RTCIceCandidateInit> _iceCandidateList = new List<RTCIceCandidateInit>();
        private List<RTCOwnIceServer> _rtcStunServerList = new List<RTCOwnIceServer>();


        public MainWindow()
        {
            InitializeComponent(); 
            _logger = AddConsoleLogger();

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
            p2pIpSelected = dnses.LastOrDefault().ToString();
        }
 
        /////
        ///AUTOMAT
        /// 

        private  Task<RTCPeerConnection> CreatePeerConnection()
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

            var ps = new RTCPeerConnection(config);
            _peerConnection = ps;
            ps.onicecandidate += (candidate) =>
            {
                if (candidate != null)
                {
                    string jsonCandidate = Newtonsoft.Json.JsonConvert.SerializeObject(new { ice = candidate.toJSON(), type = "candidate" });
                    NodeJsReceiveSignal(jsonCandidate);
                }
            };
            ps.onicecandidateerror += (candidate, error) =>
            {
                Log($"❌ ICE candidate error: {error}");
            };
            ps.onconnectionstatechange += (state) =>
            {
                Log($"🔗 Connection state change: {state}");
            };
            ps.oniceconnectionstatechange += (state) =>
            {
                Log($"🔗 ICE connection state change: {state}");
            };
            ps.OnClosed += () =>
            {
                Log("❌ Peer Connection closed.");
            };
            ps.OnTimeout += (data) =>
            {
                Log("❌ Peer Connection timeout." +data);
            };
            ps.OnRtpClosed += (data) =>
            {
                Log("❌ Peer Connection RTP closed." + data);
            };
            ps.ondatachannel += (dc) =>
            {
                _dataChannel = dc;
                Log("📡 Received Data Channel");
                _dataChannel.onopen += () => Console.WriteLine("✅ Data Channel opened.");
                _dataChannel.onmessage += (dc, protocol, data) =>
                    Log($"📩 Message received: {Encoding.UTF8.GetString(data)}");
                _dataChannel.onclose += () => Log("❌ Data Channel closed.");
            }; 
            _dataChannel = ps.createDataChannel("dc1").Result;
            return Task.FromResult(ps);
        }

        private async void NodeJsReceiveSignal(string message)
        {
            Log($"[{_remoteId}] Send: {message}");
            var buffer = Encoding.UTF8.GetBytes(message);
            await _wsClient.SendAsync(new ArraySegment<byte>(buffer), WebSocketMessageType.Text, true, CancellationToken.None);
        }

        private async Task NodeJSReceiveSignal()
        {
            var buffer = new byte[1024];

            while (_wsClient.State == WebSocketState.Open)
            {
                var result = await _wsClient.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None);
                string message = Encoding.UTF8.GetString(buffer, 0, result.Count);
               Log($"[{_remoteId}] Received: {message}");

                if (message.Contains("\"sdp\""))
                {
                    var sdp = RTCSessionDescriptionInit.TryParse(message, out var initialization);
                    _peerConnection.setRemoteDescription(initialization);

                    var answer = _peerConnection.createAnswer(null);
                    await _peerConnection.setLocalDescription(answer);
                    var sdpOfferJson = Newtonsoft.Json.JsonConvert.SerializeObject(new { sdp = answer.sdp, type = "answer" });
                    NodeJsReceiveSignal(sdpOfferJson);
                }
                else if (message.Contains("\"ice\""))
                {

                    var messageObject = CandidatesIncomming.Create(message);
                    RTCIceCandidateInit.TryParse(messageObject.Ice, out var iceCandidate);
                    _iceCandidateList.Add(iceCandidate);

                    _peerConnection.addIceCandidate(iceCandidate);
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
                    _acceptResponse = sipResponse;
                }
                Log("✅ SIP response received ACCEPT.");
                return Task.CompletedTask;
            };

            // Handling incoming messages
            _sipTransport.SIPTransportRequestReceived += async (localEndPoint, remoteEndPoint, sipRequestReceived) =>
            {
                Log($"Received SIP request: {sipRequestReceived.Method} from {remoteEndPoint}");
                //default for everything not connected with webRTC
                if (sipRequestReceived.Method == SIPMethodsEnum.MESSAGE) 
                {
                    Console.WriteLine($"MESSAGE received from {sipRequestReceived.Header.From.FromURI.User}: {sipRequestReceived.Body}");
                    var okResponse = SIPResponse.GetResponse(sipRequestReceived, SIPResponseStatusCodesEnum.Ok, null);
                    await _sipTransport.SendResponseAsync(okResponse);
                }
                if (sipRequestReceived.Method == SIPMethodsEnum.SERVICE)
                {
                    Log($"[{_remoteId}] Received: {sipRequestReceived.Body}");

                    if (sipRequestReceived.Body.Contains("\"sdp\""))
                    {
                        var sdp = RTCSessionDescriptionInit.TryParse(sipRequestReceived.Body, out var initialization);

                        _peerConnection.setRemoteDescription(initialization);
                        var answer = _peerConnection.createAnswer(null);
                        await _peerConnection.setLocalDescription(answer);
                        Log($"[{_remoteId}] Response: {answer.sdp}");
                        var sdpOfferJson = Newtonsoft.Json.JsonConvert.SerializeObject(new { sdp = answer.sdp, type = "answer" });
                        await SendSipMessage(SIPMethodsEnum.SERVICE, sdpOfferJson);
                    }
                }
                if (sipRequestReceived.Method == SIPMethodsEnum.INFO)
                {
                    var messageObject = CandidatesIncomming.Create(sipRequestReceived.Body);
                    RTCIceCandidateInit.TryParse(messageObject.Ice, out var iceCandidate);
                    //OPTIONAL  for sending IceCandidates
                    //_peerConnection.addIceCandidate(iceCandidate);
                    Log(sipRequestReceived.Body);
                }

                //start sending offers/answers
                if (sipRequestReceived.Method == SIPMethodsEnum.ACK)
                {
                    Log($"ACK received from {sipRequestReceived.Header.From.FromURI.User}");
                    var okResponse = SIPResponse.GetResponse(sipRequestReceived, SIPResponseStatusCodesEnum.Ok, null);
                    if (_ackResponse == null)
                    {
                        await SendSipMessage(SIPMethodsEnum.ACK, string.Empty);
                        _ackResponse = okResponse;
                    }
                }
                if (sipRequestReceived.Method == SIPMethodsEnum.NOTIFY)
                {
                    if (!_notificationReceived)
                    {
                          _ = await CreatePeerConnectionViaSIP();
                    }
                    Log($"NOTIFY received from {sipRequestReceived.Header.From.FromURI.User}"); 
                    _notificationReceived = true;
                }
            };
        }

        private async Task<RTCPeerConnection> CreatePeerConnectionViaSIP()
        {
            var iceServers = new List<RTCIceServer>();
            foreach(RTCOwnIceServer server in _rtcStunServerList)
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

            var ps = new RTCPeerConnection(config); 
            _dataChannel = await ps.createDataChannel("dc1", null);
            _peerConnection = ps;
            ps.onicecandidate += async (candidate) =>
            {
                if (candidate != null)
                {
                    string jsonCandidate = Newtonsoft.Json.JsonConvert.SerializeObject(new { ice = candidate.toJSON(), type = "candidate" });
                    //OPTIONAL fore sending ice candidates
                    // _=  await SendSipMessage(SIPMethodsEnum.INFO, jsonCandidate);
                }
            };

            ps.ondatachannel += (dc) =>
            {
                _dataChannel = dc;
                Log("📡 Added Data Channel");
                new Thread(() => {
                    Task.Delay(_delay).Wait();
                    Log("📡 Opened Data Channel");
                    Dispatcher.Invoke(() => P2PStatusIndicator.Fill = new System.Windows.Media.SolidColorBrush(Colors.Green));
                    Dispatcher.Invoke(() => P2PConnectionStatus.Content = "Connected");
                }).Start();
                _dataChannel.onopen += () => Console.WriteLine("✅ Data Channel opened.");
                _dataChannel.onmessage += (dc, protocol, data) =>
                    Log($"📩 Message received: {Encoding.UTF8.GetString(data)}");
                _dataChannel.onclose += () => Log("❌ Data Channel closed.");
            };

            return ps;
        }

        private void Log(string message)
        {
            Dispatcher.Invoke(() => LogBox.AppendText($"{DateTime.Now} : " + message + "\n"));
            Dispatcher.Invoke(() => LogBox.ScrollToEnd());
            _logger.LogInformation($"----->: " + message);
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




        private async void SendMessageViaSignalingServerBtn_Click(object sender, RoutedEventArgs e)
        {
            await SendSipMessage(SIPMethodsEnum.MESSAGE, MessageBox.Text);
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
                if (_acceptResponse != null)
                {
                    Log("✅ SIP BYE request accepted.");
                    _acceptResponse = null;
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
                if (_acceptResponse == null)
                {
                    Log("❌ SIP REGISTER request not accepted.");
                    StatusIndicator.Fill = new System.Windows.Media.SolidColorBrush(Colors.Red);
                    _sipTransport.Shutdown();
                    return;
                }
                Log("✅ SIP REGISTER request accepted.");
                _acceptResponse = null;
                StatusIndicator.Fill = new System.Windows.Media.SolidColorBrush(Colors.Green);
                _isConnected = true;
                SignalingServerRegistrationBtn.Content = "🔗 Unregister";
                Log("✅ ACK request accepted.");
                var ackResult = await SendSipMessage(SIPMethodsEnum.ACK, string.Empty);
            }
        }

        private void DestinationName_TextChanged(object sender, System.Windows.Controls.TextChangedEventArgs e)
        {
            _remoteId = DestinationName.Text;
        }
        private void RegistrationName_TextChanged(object sender, System.Windows.Controls.TextChangedEventArgs e)
        {
            _callerId = RegistrationName.Text;
        }

        private async void Window_Closed(object sender, EventArgs e)
        {
            if (_isConnected && !_isNodeJsSignalingServer)
            await SendSipMessage(SIPMethodsEnum.BYE, string.Empty);
        }

        private async void P2PDisconnectBtn_Click(object sender, RoutedEventArgs e)
        {
            if (_dataChannel != null) _dataChannel.close();
            if (_peerConnection != null) { _peerConnection.close(); _peerConnection = null; }
            if (_webSocketServer != null)
            {
                _webSocketServer.Stop();
                _webSocketServer = null;
            }
            _isConnected = false;
            _iceCandidateList.Clear();
            StatusIndicator.Fill = new System.Windows.Media.SolidColorBrush(Colors.Red);
            P2PStatusIndicator.Fill = new System.Windows.Media.SolidColorBrush(Colors.Red);
            ConnectionStatus.Content = "Disconnected";
            P2PConnectionStatus.Content = "Disconnected";
            _isNodeJsSignalingServer = false;
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

        private void P2PRemoveStunBtn_Click(object sender, RoutedEventArgs e)
        {
            var index = P2PServersComboBox.SelectedIndex;
            P2PServersComboBox.Items.RemoveAt(index);

            _rtcStunServerList.RemoveAt(index); 
        }

        private void DelayMilisecondsTextBox_TextChanged(object sender, System.Windows.Controls.TextChangedEventArgs e)
        {
            _delay = Convert.ToInt32(DelayMilisecondsTextBox.Text);
        }

        private void P2PPort_TextChanged(object sender, System.Windows.Controls.TextChangedEventArgs e)
        {
            p2pPortSelected = P2PPort.Text;
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
                    _dataChannel.send(message);
                    Log($"📤 Message sent: {message}");
                }
            }
            else
            {
                Log("❌ Data channel is closed!");
                if (_peerConnection != null)
                    Log($"🔍 ICE Connection State: {_peerConnection.iceConnectionState}");
            }
            LogBox.ScrollToEnd();
        }

        private async void AutoConnectBtn_Click(object sender, RoutedEventArgs e)
        {
            var uri = new Uri("ws://" + SipSignalingServer.Text + "/");
            await _wsClient.ConnectAsync(uri, CancellationToken.None);
            //await _wsClient.ConnectAsync(new Uri("ws://92.205.233.81:8081/"), CancellationToken.None);
            Console.WriteLine("Remote connected with signaling server");

            if (_webSocketServer != null)
                _webSocketServer.Stop();

            var ip = IPAddress.Parse(p2pIpSelected);
            Console.WriteLine($"IP: {ip.ToString()}");
            _webSocketServer = new WebSocketServer(ip, Convert.ToInt32(p2pPortSelected)); // true for secure connection
                                                                                         //webSocketServer.SslConfiguration.ServerCertificate = new X509Certificate2("path_to_certificate.pfx", "certificate_password");

            Console.WriteLine($"NODEJS IP: {ip.ToString()}");

            //   webSocketServer = new WebSocketServer(ip, 9090); // true for secure connection
            //webSocketServer.SslConfiguration.ServerCertificate = new X509Certificate2("path_to_certificate.pfx", "certificate_password");
            _webSocketServer.AddWebSocketService<WebRTCWebSocketPeer>("/", (peer) =>
            {
                peer.CreatePeerConnection = CreatePeerConnection;
            });
            _webSocketServer.Start();


            Log($"Waiting for web socket connections on {_webSocketServer.Address}:{_webSocketServer.Port}...");


            var localWS = new ClientWebSocket();
            await localWS.ConnectAsync(new Uri($"ws://{_webSocketServer.Address}:{_webSocketServer.Port}"), CancellationToken.None);

            new Thread(async () =>
            {
               await NodeJSReceiveSignal();

            }).Start();
            Task.Delay(2000).Wait();

            new Thread(async () =>
            {
                Task.Delay(2000).Wait();
                Log("Adding ICE Candidates...");
                foreach (var ice in _iceCandidateList)
                    if (ice != null)
                    {
                        _peerConnection.addIceCandidate(ice);
                    }
            }).Start();
            new Thread(async () =>
            {

                Task.Delay(20000).Wait();
                _dataChannel.send("server sended");
            }).Start();

            _isConnected = true;
            _isNodeJsSignalingServer = true;
            LogBox.ScrollToEnd();
        }

        private static Microsoft.Extensions.Logging.ILogger AddConsoleLogger()
        {
            var logFilePath = $"logs/remote_{DateTime.Now:yyyyMMdd_HHmmss}.txt";
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
