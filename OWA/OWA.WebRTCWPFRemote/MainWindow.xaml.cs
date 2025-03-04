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
using Org.BouncyCastle.Crypto.Prng;
using OWA.WebRTCWPFCaller;
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
        private ClientWebSocket ws;
        private RTCPeerConnection peerConnection;
        private   string serverUrl = "ws://92.205.233.81:8081";
        private   string remoteId = "remote";
        private   string callerId = "caller";
        private bool isConnected = false;
        bool notificationReceived = false;
        string p2pIpSelected = string.Empty;
        string p2pPortSelected = string.Empty;
        private RTCDataChannel dataChannel;
        List<RTCOwnIceServer> rtcIceServers = new List<RTCOwnIceServer>();
        List<RTCIceCandidate> candidates = new List<RTCIceCandidate>();
        SIPResponse acceptResponse = null;
        SIPResponse ackResponse = null;

        public MainWindow()
        {
            InitializeComponent();
            var dnses = Dns.GetHostAddresses(Dns.GetHostName());
            SipSignalingServerComboBox.Items.Clear();
            P2PServerComboBox.Items.Clear();  
            foreach (var dns in dnses)
            {
                SipSignalingServerComboBox.Items.Add(dns);
                P2PServerComboBox.Items.Add(dns);
                Log($"DNS: {dns}");
            }
            RTCOwnIceServer stun1 = new RTCOwnIceServer() { credential = string.Empty, type = RTCMethodsEnum.STUN, url = "stun:freestun.net:3478", username = string.Empty };
            RTCOwnIceServer stun2 = new RTCOwnIceServer() { credential = string.Empty, type = RTCMethodsEnum.STUN, url = "stun:stun1.l.google.com:19302", username = string.Empty };
            RTCOwnIceServer turn = new RTCOwnIceServer() { credential = "free", type = RTCMethodsEnum.TURN, url = "turn:freestun.net:3478", username = "free" };
            rtcIceServers.Add( stun1  );
            rtcIceServers.Add(stun2);
            rtcIceServers.Add(turn);

            foreach (var dns in rtcIceServers)
                P2PServersComboBox.Items.Add(dns);

            SipSignalingServerComboBox.SelectedItem = dnses.LastOrDefault();
            P2PServerComboBox.SelectedItem = dnses.LastOrDefault();
            p2pIpSelected = dnses.LastOrDefault().ToString();
        }

        //private async Task ReceiveWebSocketMessages()
        //{
        //    byte[] buffer = new byte[4096];

        //    while (ws.State == WebSocketState.Open)
        //    {
        //        var result = await ws.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None);
        //        string message = Encoding.UTF8.GetString(buffer, 0, result.Count);
        //        Log($"📩 Otrzymano wiadomość z serwera: {message}");

        //        var data = JsonSerializer.Deserialize<JsonElement>(message);
        //        if (data.TryGetProperty("type", out JsonElement typeElement))
        //        {
        //            string type = typeElement.GetString();
        //            switch (type)
        //            {
        //                case "candidate":
        //                    var candidateJson = data.GetProperty("candidate").GetRawText();
        //                    var candidate = JsonSerializer.Deserialize<RTCIceCandidateInit>(candidateJson);
        //                    peerConnection.addIceCandidate(candidate);
        //                    Log($"✅ Dodano ICE Candidate: {candidate.candidate}");
        //                    //SendMessageBtn.IsEnabled = true;
        //                    break;

        //                default:
        //                    Log($"⚠️ Otrzymano nieznany typ wiadomości: {type}");
        //                    break;
        //            }
        //        }
        //    }
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
                    dataChannel.send(message);
                    Log($"📤 Message sent: {message}"); 
                }
            }
            else
            {
                Log("❌ Data channel is closed!");
                if (_peerConnection != null)
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
                    await SendWebSocketMessage(iceMsg);
                    Log($"❄️ Sent ICE Candidate: {candidate.candidate}");
                }
            }
            else
            {
                Log("⚠️ Missing local ice candidates");
            }
            LogBox.ScrollToEnd();

        }

        private async Task SendWebSocketMessage(string message)
        {
            if (ws.State == WebSocketState.Open)
            {
                byte[] messageBytes = Encoding.UTF8.GetBytes(message);
                await ws.SendAsync(new ArraySegment<byte>(messageBytes), WebSocketMessageType.Text, true, CancellationToken.None);
            }
        }

 
        /////
        ///AUTOMAT
        /// 

        private  Task<RTCPeerConnection> CreatePeerConnection()
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

            //RTCConfiguration config = new RTCConfiguration
            //{
            //    iceServers = new List<RTCIceServer> {
            //        new RTCIceServer { urls = "stun:freestun.net:3478" },
            //        new RTCIceServer { urls = "stun:stun1.l.google.com:19302" },
            //        new RTCIceServer { urls = "turn:freestun.net:3478", credential = "free", credentialType = RTCIceCredentialType.password, username = "free" }
            //    }
            //};

            var ps = new RTCPeerConnection(config);
            _peerConnection = ps;
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
                Log("📡 Received Data Channel");

                // Obsługa zdarzeń DataChannel
                dataChannel.onopen += () => Console.WriteLine("✅ Data Channel opened.");
                dataChannel.onmessage += (dc, protocol, data) =>
                    Log($"📩 Message received: {Encoding.UTF8.GetString(data)}");
                dataChannel.onclose += () => Log("❌ Data Channel closed.");
            }; 
            dataChannel = ps.createDataChannel("dc1").Result;
            return Task.FromResult(ps);
        }

        private   RTCPeerConnection _peerConnection;
        private   readonly string _clientId = "Remote"; // Identyfikator klienta
          WebSocketServer webSocketServer; 
        ClientWebSocket _wsClient = new ClientWebSocket();
        private async void SendSignal(string message)
        {

            Log($"[{_clientId}] Send: {message}");
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
               Log($"[{_clientId}] Received: {message}");

                if (message.Contains("\"sdp\""))
                {
                    var sdp = RTCSessionDescriptionInit.TryParse(message, out var initialization);
                    _peerConnection.setRemoteDescription(initialization);

                    var answer = _peerConnection.createAnswer(null);
                    await _peerConnection.setLocalDescription(answer);
                    var sdpOfferJson = Newtonsoft.Json.JsonConvert.SerializeObject(new { sdp = answer.sdp, type = "answer" });
                    SendSignal(sdpOfferJson);
                }
                else if (message.Contains("\"ice\""))
                {

                    var messageObject = CandidatesIncomming.Create(message);
                    RTCIceCandidateInit.TryParse(messageObject.Ice, out var iceCandidate);
                    candidatesInit.Add(iceCandidate);

                    _peerConnection.addIceCandidate(iceCandidate);
                }
            }
        }

        private bool isNodeJsSignalingServer = false;
        private async void AutoConnectBtn_Click(object sender, RoutedEventArgs e)
        { 
            var uri = new Uri("ws://"+ SipSignalingServer.Text+"/");
            await _wsClient.ConnectAsync(uri, CancellationToken.None);
            //await _wsClient.ConnectAsync(new Uri("ws://92.205.233.81:8081/"), CancellationToken.None);
            Console.WriteLine("Remote connected with signaling server");

            //var ips = Dns.GetHostAddresses(Dns.GetHostName());
            //var ip = ips.LastOrDefault();// P2PServersComboBox.SelectedValue;
            //                             //            var ipEndpointForSip =  IPAddress.Parse(SipSignalingServerComboBox.SelectedValue.ToString(),), Convert.ToInt32(DnsIPAndPort.Text) ;

            if (webSocketServer != null)
                webSocketServer.Stop();

            var ip = IPAddress.Parse(p2pIpSelected);
            Console.WriteLine($"IP: {ip.ToString()}");
            webSocketServer = new WebSocketServer(ip, Convert.ToInt32(p2pPortSelected)); // true for secure connection
                                                                                         //webSocketServer.SslConfiguration.ServerCertificate = new X509Certificate2("path_to_certificate.pfx", "certificate_password");

            Console.WriteLine($"NODEJS IP: {ip.ToString()}");

         //   webSocketServer = new WebSocketServer(ip, 9090); // true for secure connection
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
            isNodeJsSignalingServer = true;
            LogBox.ScrollToEnd();
        }

        List<RTCIceCandidateInit> candidatesInit = new List<RTCIceCandidateInit>();
        private void AddIceCandidates()
        {
            Log("Adding ICE Candidates...");
            foreach (var ice in candidatesInit)
                if (ice != null)
                {
                    _peerConnection.addIceCandidate(ice);
                }
        }

      

        ///////////
        /// <summary>
        /// 
        /// 
        /// 
        /// 
        /// 
        /// 
        /// 
        /// 
        /// 
        /// 
        /// 
        /// </summary>
        /// <param name="sender"></param>
        /// <param name="e"></param>        ///////


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

                waitForSipAcceptResponse = true;

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
            sipTransport.SIPTransportRequestReceived += async (localEndPoint, remoteEndPoint, sipRequestReceived) =>
            {
                Log($"Received SIP request: {sipRequestReceived.Method} from {remoteEndPoint}");
                //default for everything not connected with webRTC
                if (sipRequestReceived.Method == SIPMethodsEnum.MESSAGE) 
                {
                    Console.WriteLine($"MESSAGE received from {sipRequestReceived.Header.From.FromURI.User}: {sipRequestReceived.Body}");
                    var okResponse = SIPResponse.GetResponse(sipRequestReceived, SIPResponseStatusCodesEnum.Ok, null);
                    await sipTransport.SendResponseAsync(okResponse);
                }
                if (sipRequestReceived.Method == SIPMethodsEnum.SERVICE)
                {
                    Log($"[{_clientId}] Received: {sipRequestReceived.Body}");

                    if (sipRequestReceived.Body.Contains("\"sdp\""))
                    {
                        var sdp = RTCSessionDescriptionInit.TryParse(sipRequestReceived.Body, out var initialization);

                        _peerConnection.setRemoteDescription(initialization);
                        var answer = _peerConnection.createAnswer(null);
                        await _peerConnection.setLocalDescription(answer);
                        Log($"[{_clientId}] Response: {answer.sdp}");
                        var sdpOfferJson = Newtonsoft.Json.JsonConvert.SerializeObject(new { sdp = answer.sdp, type = "answer" });
                        await SendSipMessage(SIPMethodsEnum.SERVICE, sdpOfferJson);
                      
                    }
                }
                if (sipRequestReceived.Method == SIPMethodsEnum.INFO)
                {
                    var messageObject = CandidatesIncomming.Create(sipRequestReceived.Body);
                    RTCIceCandidateInit.TryParse(messageObject.Ice, out var iceCandidate);
                        _peerConnection.addIceCandidate(iceCandidate);
                    Log(sipRequestReceived.Body);
                }

                //start sending offers/answers
                if (sipRequestReceived.Method == SIPMethodsEnum.ACK)
                {
                    Log($"ACK received from {sipRequestReceived.Header.From.FromURI.User}");
                    var okResponse = SIPResponse.GetResponse(sipRequestReceived, SIPResponseStatusCodesEnum.Ok, null);
                    if (ackResponse == null)
                    {
                        await SendSipMessage(SIPMethodsEnum.ACK, string.Empty);
                        ackResponse = okResponse;
                    }
                }
                if (sipRequestReceived.Method == SIPMethodsEnum.NOTIFY)
                {
                    if (!notificationReceived)
                    {
                          _=  PeerToPEerConnection();

                    }
                    Log($"NOTIFY received from {sipRequestReceived.Header.From.FromURI.User}"); 
                    notificationReceived = true;
                }
            };
        }

        private async Task<bool> PeerToPEerConnection()
        {
             var ip =  IPAddress.Parse(p2pIpSelected);
            Console.WriteLine($"IP: {ip.ToString()}");
            webSocketServer = new WebSocketServer(ip, Convert.ToInt32(p2pPortSelected)); // true for secure connection
                                                             //webSocketServer.SslConfiguration.ServerCertificate = new X509Certificate2("path_to_certificate.pfx", "certificate_password");
            webSocketServer.AddWebSocketService<WebRTCWebSocketPeer>("/", (peer) =>
            {
                peer.CreatePeerConnection = CreatePeerConnectionViaSIP;
            });
            webSocketServer.Start();

            Log($"Waiting for web socket connections on {webSocketServer.Address}:{webSocketServer.Port}...");


            var localWS = new ClientWebSocket();
            await localWS.ConnectAsync(new Uri($"ws://{webSocketServer.Address}:{webSocketServer.Port}"), CancellationToken.None);
            return true;
        }

        List<string> generatedIces = new List<string>();
        int delay = 2000;
       
        private   Task<RTCPeerConnection> CreatePeerConnectionViaSIP()
        {
            var iceServers = new List<RTCIceServer>();
            foreach(RTCOwnIceServer server in rtcIceServers)
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
                   //  generatedIces.Add(jsonCandidate);
                    _=  SendSipMessage(SIPMethodsEnum.INFO, jsonCandidate);
                }
            };

            ps.ondatachannel += (dc) =>
            {
                dataChannel = dc;
                Log("📡 Added Data Channel");
                new Thread(() => {
                    Task.Delay(delay).Wait();
                    Log("📡 Opened Data Channel");
                    Dispatcher.Invoke(() => P2PStatusIndicator.Fill = new System.Windows.Media.SolidColorBrush(Colors.Green));
                    Dispatcher.Invoke(() => P2PConnectionStatus.Content = "Connected");
                }).Start();
                dataChannel.onopen += () => Console.WriteLine("✅ Data Channel opened.");
                dataChannel.onmessage += (dc, protocol, data) =>
                    Log($"📩 Message received: {Encoding.UTF8.GetString(data)}");
                dataChannel.onclose += () => Log("❌ Data Channel closed.");
            };
Task.Delay(delay).Wait();
            dataChannel =   ps.createDataChannel("dc1").Result;

            return   Task.FromResult(ps);
        }

        private async void SendMessageViaSignalingServerBtn_Click(object sender, RoutedEventArgs e)
        {
            await SendSipMessage(SIPMethodsEnum.MESSAGE, MessageBox.Text);
        }

        private async void Window_Closed(object sender, EventArgs e)
        {
            if (isConnected && !isNodeJsSignalingServer)
            await SendSipMessage(SIPMethodsEnum.BYE, string.Empty);
        }

        private async void P2PDisconnectBtn_Click(object sender, RoutedEventArgs e)
        {
            if (dataChannel != null) dataChannel.close();
            if (_peerConnection != null) { _peerConnection.close(); _peerConnection = null; }
            if (ws!=null) 
            { 
               await ws.CloseAsync(WebSocketCloseStatus.NormalClosure, "Closed", CancellationToken.None);
                ws = null;
            }

            if (webSocketServer != null)
            {
                webSocketServer.Stop();
                webSocketServer = null;
            }
            isConnected = false;
            candidatesInit.Clear();
            generatedIces.Clear();
            StatusIndicator.Fill = new System.Windows.Media.SolidColorBrush(Colors.Red);
            P2PStatusIndicator.Fill = new System.Windows.Media.SolidColorBrush(Colors.Red);
            ConnectionStatus.Content = "Disconnected";
            P2PConnectionStatus.Content = "Disconnected";
            isNodeJsSignalingServer = false;
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

        private void P2PRemoveStunBtn_Click(object sender, RoutedEventArgs e)
        {
            var index = P2PServersComboBox.SelectedIndex;
            P2PServersComboBox.Items.RemoveAt(index);

            rtcIceServers.RemoveAt(index); 
        }

        private void DelayMilisecondsTextBox_TextChanged(object sender, System.Windows.Controls.TextChangedEventArgs e)
        {
            delay = Convert.ToInt32(DelayMilisecondsTextBox.Text);
            //Log("Delay changed: "+delay);
        }

        private void P2PPort_TextChanged(object sender, System.Windows.Controls.TextChangedEventArgs e)
        {
            p2pPortSelected = P2PPort.Text;
            //Log("P2P Port: " + p2pPortSelected);
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
