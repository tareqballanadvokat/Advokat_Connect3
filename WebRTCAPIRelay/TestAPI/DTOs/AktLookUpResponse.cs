namespace TestAPI.DTOs
{
    public class AktLookUpResponse
    {
        public int AktId { get; set; }
        public string AKurz { get; set; } = string.Empty;
        public string? Causa { get; set; }
    }
}
