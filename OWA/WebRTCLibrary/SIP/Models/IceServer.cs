namespace WebRTCLibrary.SIP.Models
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
        public string credential; // TODO: credential? password?
        public RTCMethodsEnum type;
        public override string ToString()
        {
            return $"{type} {url} {username} {credential}";
        }
    }
}
