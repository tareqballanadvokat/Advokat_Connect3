namespace WebRTCAPIRelay.DTOs
{
    internal class WebRTCRequestPayload
    {
        public required long Timestamp { get; set; }

        public required string Method { get; set; }

        public required string Uri { get; set; }

        public Dictionary<string, string> Headers { get; set; } = new Dictionary<string, string>();

        public byte[]? Body { get; set; }
    }
}
