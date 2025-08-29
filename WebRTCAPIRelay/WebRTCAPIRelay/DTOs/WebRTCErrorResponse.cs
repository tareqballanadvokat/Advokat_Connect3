using System.Text.Json.Serialization;

namespace WebRTCAPIRelay.DTOs
{
    // DEBUG public
    public class WebRTCErrorResponse
    {
        public string? Id { get; set; } = null;

        public required byte[] Checksum { get; set; }

        [JsonPropertyName("response")]
        public required WebRTCErrorResponsePayload Payload { get; set; }
    }
}
