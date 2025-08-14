namespace WebRTCAPIRelay.DTOs
{
    public class WebRTCResponsePayload
    {
        public int StatusCode { get; set; }
        public string? StatusText { get; set; }
        public IDictionary<string, string> Headers { get; set; }
        public string? Content { get; set; }
    }
}
