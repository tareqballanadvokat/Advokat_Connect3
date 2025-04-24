using Microsoft.Extensions.Logging;
using SIPSorcery.Net;
using SIPSorcery.SIP;
using System.Net;
using System.Text;
using System.Windows;
using WebRTCClient;
using WebRTCLibrary.SIP;
using WebRTCLibrary.SIP.Models;

namespace WebRTCRemoteWPF
{
    /// <summary>
    /// Interaction logic for MainWindow.xaml
    /// </summary>
    public partial class MainWindow : Window
    {
        //private static readonly string testingSignalingServer = "92.205.233.81:8081";
        private static readonly string testingSignalingServer = "192.168.1.58:8081";

        private static readonly string testingCallerName = "macs";
        private static readonly string testingRemoteName = "macc";
        private static readonly string testingSignalingServerSourcePort = "7080";
        private static readonly string testingTimeout = "2000";

        private ILoggerFactory loggerFactory;

        private WebRTCPeer? UserAgent;

        public MainWindow()
        {
            InitializeComponent();
            LoadTestingValues();

            this.loggerFactory = LoggerFactory.Create(
                (builder) => {
                    builder.SetMinimumLevel(LogLevel.Debug);
                    builder.AddDebug();
                });
        }

        private void LoadLocalIps()
        {
            var dnses = Dns.GetHostAddresses(Dns.GetHostName());
            SipSignalingServerComboBox.Items.Clear();
            foreach (var dns in dnses)
            {
                SipSignalingServerComboBox.Items.Add(dns);
            }

            SipSignalingServerComboBox.SelectedItem = dnses.LastOrDefault();
        }

        private void LoadICEServers()
        {
            List<RTCOwnIceServer> IceServers = [
                new RTCOwnIceServer() { credential = string.Empty, type = RTCMethodsEnum.STUN, url = "stun:freestun.net:3478", username = string.Empty },
                new RTCOwnIceServer() { credential = string.Empty, type = RTCMethodsEnum.STUN, url = "stun:stun1.l.google.com:19302", username = string.Empty },
                new RTCOwnIceServer() { credential = "free", type = RTCMethodsEnum.TURN, url = "turn:freestun.net:3478", username = "free" },
            ];

            foreach (var server in IceServers)
            {
                P2PServersComboBox.Items.Add(server);
            }
        }

        private void LoadTestingValues()
        {
            SipSignalingServer.Text = testingSignalingServer;
            RegistrationName.Text = testingCallerName;
            DestinationName.Text = testingRemoteName;
            DnsIPAndPort.Text = testingSignalingServerSourcePort;
            DelayMilisecondsTextBox.Text = testingTimeout;
            this.LoadLocalIps();
            this.LoadICEServers();
        }

        private async void SignalingServerRegistrationBtn_Click(object sender, RoutedEventArgs e)
        {
            if (SipSignalingServerComboBox.SelectedValue == null)
            {
                // Log("❌ Select DNS IP Address missing");
                return;
            }

            if (this.UserAgent != null)
            {
                return;
            }

            List<RTCIceServer> iceServers = this.P2PServersComboBox.Items
                .Cast<RTCOwnIceServer>()
                .Select(o =>
                {

                    if (o.type == RTCMethodsEnum.STUN)
                    {
                        return new RTCIceServer { urls = o.url };
                    }
                    else
                    {
                        return new RTCIceServer { urls = o.url, credential = o.credential, credentialType = RTCIceCredentialType.password, username = o.username };
                    }

                })
                .ToList();


            this.UserAgent = new WebRTCPeer(
                sourceUser: this.RegistrationName.Text,
                remoteUser: this.DestinationName.Text,
                sourceEndpoint: new IPEndPoint(IPAddress.Parse(SipSignalingServerComboBox.Text), int.Parse(DnsIPAndPort.Text)),
                signalingServer: IPEndPoint.Parse(this.SipSignalingServer.Text),
                iceServers: iceServers,
                this.loggerFactory
                );
            
            this.UserAgent.OnMessageReceived += this.OnMessage;

            this.UserAgent.OnConnected += this.OnConnected;

            await this.UserAgent.Connect();
        }
        private async Task OnMessage(IWebRTCPeer sender, byte[] message)
        {
            this.AddLineToTextBox(message);
        }

        private async Task OnConnected(IWebRTCPeer sender)
        {
            Dispatcher.Invoke(() => this.LogBox.AppendText($"[{DateTime.Now}] Connected\r\n"));
        }

        private void AddLineToTextBox(byte[] message)
        {
            this.AddLineToTextBox(Encoding.UTF8.GetString(message));
        }

        private async Task OnRequestRecived(ISIPMessager sender, SIPRequest request)
        {
            this.AddLineToTextBox($"{request.Method} - {request.Body}");
        }

        private async Task OnResponseRecived(ISIPMessager sender, SIPResponse response)
        {
            this.AddLineToTextBox($"{response.StatusCode} - {response.Body}");
        }

        private void AddLineToTextBox(string message, bool sentMessage = false)
        {
            string messageType = sentMessage ? $"SENT" : $"RECEIVED";

            Dispatcher.Invoke(() => this.LogBox.AppendText($"[{DateTime.Now} {messageType}] {message}\r\n"));
            Dispatcher.Invoke(() => LogBox.ScrollToEnd());
        }

        private void P2PAddStunBtn_Click(object sender, RoutedEventArgs e)
        {

        }

        private void P2PRemoveStunBtn_Click(object sender, RoutedEventArgs e)
        {
            var index = P2PServersComboBox.SelectedIndex;
            P2PServersComboBox.Items.RemoveAt(index);
        }

        private void P2PAddTurnBtn_Click(object sender, RoutedEventArgs e)
        {

        }

        private async void P2PDisconnectBtn_Click(object sender, RoutedEventArgs e)
        {
            //Task? task = this.UserAgent?.StopDialog();
            //if (task != null)
            //{
            //    await task;
            //}
        }

        private async void SendMessageBtn_Click(object sender, RoutedEventArgs e)
        {
            if (this.UserAgent != null)
            {
                await this.UserAgent.SendMessageToPeer(this.MessageBox.Text);
                this.AddLineToTextBox($"{SIPMethodsEnum.INFO} - {this.MessageBox.Text}", sentMessage: true);
                this.MessageBox.Text = string.Empty;
            }
        }

        private async void SendMessageViaSignalingServerBtn_Click(object sender, RoutedEventArgs e)
        {
            //if (this.UserAgent != null)
            //{
            //    SocketError sendStatus = await this.UserAgent.SendSIPRequest(SIPMethodsEnum.INFO, this.MessageBox.Text, "message/sip", 1);
            //    if (sendStatus != SocketError.NotConnected)
            //    {
            //        this.AddLineToTextBox($"{SIPMethodsEnum.INFO} - {this.MessageBox.Text}", sentMessage: true);
            //    }
                
            //    this.MessageBox.Text = string.Empty;
            //}
        }

        private void DelayMilisecondsTextBox_TextChanged(object sender, System.Windows.Controls.TextChangedEventArgs e)
        {

        }

        private void RegistrationName_TextChanged(object sender, System.Windows.Controls.TextChangedEventArgs e)
        {

        }

        private void DestinationName_TextChanged(object sender, System.Windows.Controls.TextChangedEventArgs e)
        {

        }
    }
}