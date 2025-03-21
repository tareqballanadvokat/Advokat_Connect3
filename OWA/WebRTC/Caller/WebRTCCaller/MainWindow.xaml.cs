using SIPSorcery.SIP;
using System.Net;
using System.Windows;
using WebRTCLibrary;
using WebRTCLibrary.SIP;
using WebRTCLibrary.SIP.Models;

namespace WebRTCCaller
{
    /// <summary>
    /// Interaction logic for MainWindow.xaml
    /// </summary>
    public partial class MainWindow : Window
    {
        private static readonly string testingSignalingServer = "92.205.233.81:8081";
        //private static readonly string testingSignalingServer = "192.168.1.58:8081";

        private static readonly string testingCallerName = "macc";
        private static readonly string testingRemoteName = "macs";
        private static readonly string testingSignalingServerSourcePort = "8098";
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

            SIPParticipant caller = new SIPParticipant(this.RegistrationName.Text, new SIPEndPoint(new IPEndPoint(IPAddress.Parse(SipSignalingServerComboBox.Text), int.Parse(DnsIPAndPort.Text))));
            
            this.UserAgent = new SIPClient(caller, new SIPEndPoint(IPEndPoint.Parse(this.SipSignalingServer.Text)), this.DestinationName.Text, SIPSchemesEnum.sip);
            await this.UserAgent.StartDialog();
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

        private void SendMessageViaSignalingServerBtn_Click(object sender, RoutedEventArgs e)
        {

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