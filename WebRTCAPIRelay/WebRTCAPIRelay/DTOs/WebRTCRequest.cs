using System.Text.Json.Serialization;

namespace WebRTCAPIRelay.DTOs
{
    internal class WebRTCRequest
    {
        public required string Id { get; set; }

        public required byte[] Checksum { get; set; }

        [JsonPropertyName("request")]
        public required WebRTCRequestPayload Payload { get; set; }
    }
}
