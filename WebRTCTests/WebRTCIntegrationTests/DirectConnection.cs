using Microsoft.Extensions.Logging.Abstractions;
using SIPSignalingServer;
using System.Net;
using System.Text;
using WebRTCClient;

namespace WebRTCIntegrationTests
{
    public class DirectConnection
    {
        private List<string> ReceivedMessagesByCaller = [];
        private List<string> ReceivedMessagesByRemote = [];

        [Fact]
        public async Task Can_Connect()
        {
            SignalingServer signalingServer = new SignalingServer(NullLoggerFactory.Instance);
            
            // TODO: replace with loopback when singaling server endpoint can be set
            IPEndPoint signalingServerEndpoint = IPEndPoint.Parse("192.168.1.58:8081");
            
            IPEndPoint callerEndpoint = IPEndPoint.Parse("192.168.1.58:8098");
            IPEndPoint remoteEndpoint = IPEndPoint.Parse("192.168.1.58:7080");

            string callerName = "caller12345";
            string remoteName = "remote12345";

            WebRTCPeer caller = new(
                sourceUser: callerName,
                remoteUser: remoteName,
                sourceEndpoint: callerEndpoint,
                signalingServer: signalingServerEndpoint,
                iceServers: [],
                NullLoggerFactory.Instance);

            WebRTCPeer remote = new(
                sourceUser: remoteName,
                remoteUser: callerName,
                sourceEndpoint: remoteEndpoint,
                signalingServer: signalingServerEndpoint,
                iceServers:[],
                NullLoggerFactory.Instance);

            caller.OnMessageReceived += this.CallerReceivedMessage;
            remote.OnMessageReceived += this.RemoteReceivedMessage;

            _ = Task.Run(caller.Connect);
            _ = Task.Run(remote.Connect);

            // Some time for the clients to connect
            await Task.Delay(500); // cutoff point is 250. It always fails below that. 300 is fine most of the time

            Assert.True(caller.IsConnected);
            Assert.True(remote.IsConnected);

            string messageToRemote = "hellooooo";
            await caller.SendMessageToPeer(messageToRemote);

            await Task.Delay(10);
            Assert.Single(this.ReceivedMessagesByRemote);
            Assert.Empty(this.ReceivedMessagesByCaller);
            Assert.Equal(this.ReceivedMessagesByRemote.Single(), messageToRemote);


            string messageToCaller = "i am also here hello";
            await remote.SendMessageToPeer(messageToCaller);

            await Task.Delay(10);
            Assert.Single(this.ReceivedMessagesByCaller);
            Assert.Single(this.ReceivedMessagesByRemote);  // contains message from before
            Assert.Equal(this.ReceivedMessagesByCaller.Single(), messageToCaller);
        }

        private async Task CallerReceivedMessage(IWebRTCPeer sender, byte[] message)
        {
            this.ReceivedMessagesByCaller.Add(Encoding.UTF8.GetString(message));
        }

        private async Task RemoteReceivedMessage(IWebRTCPeer sender, byte[] message)
        {
            this.ReceivedMessagesByRemote.Add(Encoding.UTF8.GetString(message));
        }
    }
}