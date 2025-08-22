namespace WebRTCAPIRelay.DTOs
{
    // DEBUG public

    public class WebRTCResponsePayload
    {
        public required string Id { get; set; }

        public required long Timestamp { get; set; }

        public required int StatusCode { get; set; }

        public IDictionary<string, string> Headers { get; set; }

        public byte[]? Body { get; set; }
    }
}
