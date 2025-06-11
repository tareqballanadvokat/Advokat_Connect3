using Microsoft.Extensions.Logging.Abstractions;
using SIPSignalingServer;
using SIPSignalingServer.Utils;
using SIPSorcery.SIP;
using System.Net;
using System.Text;
using WebRTCClient;
using WebRTCClient.Models;
using WebRTCClient.Utils;
using WebRTCLibrary.SIP.Models;

namespace WebRTCIntegrationTests
{
    public class DirectConnection
    {
        private List<string> ReceivedMessagesByCaller = [];
        private List<string> ReceivedMessagesByRemote = [];

        [Fact]
        public async Task Can_Connect()
        {
            IPEndPoint signalingServerEndpoint = new IPEndPoint(IPAddress.Loopback, 8081);

            SignalingServer signalingServer = new SignalingServer(signalingServerEndpoint, NullLoggerFactory.Instance);
            signalingServer.SIPChannels = [SIPServerChannelsEnum.WebSocket];
            signalingServer.StartServer();

            IPEndPoint callerEndpoint = new IPEndPoint(IPAddress.Any, 8098);
            IPEndPoint remoteEndpoint = new IPEndPoint(IPAddress.Any, 7080);

            string callerName = "caller12345";
            string remoteName = "remote12345";

            SIPClientChannelsEnum sipChannel = SIPClientChannelsEnum.WebSocket;

            SignalingServerParams callerParams = new SignalingServerParams(
                sourceParticipant: new SIPParticipant(callerName, new SIPEndPoint(sipChannel.Protocol, callerEndpoint)),
                remoteParticipant: new SIPParticipant(remoteName, new SIPEndPoint(sipChannel.Protocol, signalingServerEndpoint)),
                sipScheme: SIPSchemesEnum.sip,
                sipChannels: [sipChannel]);

            SignalingServerParams remoteParams = new SignalingServerParams(
                sourceParticipant: new SIPParticipant(remoteName, new SIPEndPoint(sipChannel.Protocol, remoteEndpoint)),
                remoteParticipant: new SIPParticipant(callerName, new SIPEndPoint(sipChannel.Protocol, signalingServerEndpoint)),
                sipScheme: SIPSchemesEnum.sip,
                sipChannels: [sipChannel]);

            WebRTCPeer caller = new(
                callerParams,
                iceServers: [], // we use the host ice candidate here
                NullLoggerFactory.Instance);

            WebRTCPeer remote = new(
                remoteParams,
                iceServers:[], // we use the host ice candidate here
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