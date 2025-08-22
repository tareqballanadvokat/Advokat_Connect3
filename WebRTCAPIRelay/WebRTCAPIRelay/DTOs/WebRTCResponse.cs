using System.Text.Json.Serialization;

namespace WebRTCAPIRelay.DTOs
{
    // DEBUG public
    public class WebRTCResponse
    {
        public required byte[] Checksum { get; set; }

        [JsonPropertyName("response")]
        public required WebRTCResponsePayload Payload { get; set; }
    }
}
