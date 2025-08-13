namespace WebRTCClient
{
    public interface IWebRTCPeer : IAsyncDisposable 
    {
        //public delegate Task SIPMessageReceivedDelegate(IWebRTCPeer sender, byte[] data); // TODO: Is this needed?
        
        //public event SIPMessageReceivedDelegate? OnSIPMessageReceived;

        public delegate Task MessageReceivedDelegate(IWebRTCPeer sender, byte[] data);

        public delegate Task ConnectedDelegate(IWebRTCPeer sender);


        public event MessageReceivedDelegate? OnMessageReceived;

        public event ConnectedDelegate? OnConnected;

        // TODO: Events for - connected? disconnected? error?


        // TODO: Is this needed aswell?
        //       If yes should we include payload as bytes aswell?
        //public Task<SocketError> SendSIPRequest(SIPMethodsEnum method, string message, string contentType, int cSeq);

        //public Task<SocketError> SendSIPResponse(SIPResponseStatusCodesEnum statusCode, string message, string contentType, int cSeq);

        public Task SendMessageToPeer(string message);

        public Task SendMessageToPeer(byte[] message);
    }
}
