using SIPSorcery.Net;
using SIPSorcery.SIP;
using System.Net;
using System.Net.Sockets;
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

        //private RegistrationManager SignalingServer = new RegistrationManager("callerIdIsIrrelevantIHope");

        private SIPClient? UserAgent;

        public MainWindow()
        {
            InitializeComponent();
            LoadTestingValues();
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

            SIPParticipant caller = new SIPParticipant(this.RegistrationName.Text, new SIPEndPoint(new IPEndPoint(IPAddress.Parse(SipSignalingServerComboBox.Text), int.Parse(DnsIPAndPort.Text))));

            // remote name + signaling server IPEndpoint
            SIPParticipant remote = new SIPParticipant(this.DestinationName.Text, new SIPEndPoint(IPEndPoint.Parse(this.SipSignalingServer.Text)));

            SIPTransport transport = this.GetTransport(caller);
            this.UserAgent = new SIPClient(caller, remote, transport, SIPSchemesEnum.sip);

            this.UserAgent.OnRequestReceived += this.OnRequestRecived;
            this.UserAgent.OnResponseReceived += this.OnResponseRecived;

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


            await this.UserAgent.StartDialog(iceServers);
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

        private SIPTransport GetTransport(SIPParticipant caller)
        {
            SIPTransport transport = new SIPTransport();

            // set listening channel
            SIPUDPChannel channel = new SIPUDPChannel(caller.Endpoint.GetIPEndPoint());
            //SIPUDPChannel channel = new SIPUDPChannel(sourceEndpoint);

            transport.AddSIPChannel(channel);

            return transport;
        }

        private void P2PAddStunBtn_Click(object sender, RoutedEventArgs e)
        {

        }

        private void P2PRemoveStunBtn_Click(object sender, RoutedEventArgs e)
        {

        }

        private void P2PAddTurnBtn_Click(object sender, RoutedEventArgs e)
        {

        }

        private async void P2PDisconnectBtn_Click(object sender, RoutedEventArgs e)
        {
            Task? task = this.UserAgent?.StopDialog();
            if (task != null)
            {
                await task;
            }
        }

        private void SendMessageBtn_Click(object sender, RoutedEventArgs e)
        {

        }

        private async void SendMessageViaSignalingServerBtn_Click(object sender, RoutedEventArgs e)
        {
            if (this.UserAgent != null)
            {
                SocketError sendStatus = await this.UserAgent.SendRequest(SIPMethodsEnum.INFO, this.MessageBox.Text, 1);
                if (sendStatus != SocketError.NotConnected)
                {
                    this.AddLineToTextBox($"{SIPMethodsEnum.INFO} - {this.MessageBox.Text}", sentMessage: true);
                }
                
                this.MessageBox.Text = string.Empty;
            }
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