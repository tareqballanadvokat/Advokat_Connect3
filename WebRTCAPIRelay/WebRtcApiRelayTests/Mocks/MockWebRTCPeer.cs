using WebRTCClient;

namespace WebRtcApiRelayTests.Mocks
{
    internal class MockWebRTCPeer : IWebRTCPeer
    {
        public List<string> SentResponses { get; set; } = [];

        public event IWebRTCPeer.MessageReceivedDelegate? OnMessageReceived;
        public event IWebRTCPeer.ConnectedDelegate? OnConnected;

        public ValueTask DisposeAsync()
        {
            throw new NotImplementedException();
        }

        public async Task SendMessageToPeer(string message)
        {
            SentResponses.Add(message);
        }

        public Task SendMessageToPeer(byte[] message)
        {
            throw new NotImplementedException();
        }

        public async Task ReceiveMessage(byte[] message)
        {
            await (this.OnMessageReceived?.Invoke(this, message) ?? Task.CompletedTask);
        }

        public async Task Connect()
        {
            // TODO: should raise OnConnected event?
        }
    }
}
