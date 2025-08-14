namespace TestAPI.DTOs
{
    public class AktenQuery
    {
        public int AktId { get; set; }
        public string? AKurzLike { get; set; }
        public int? Count { get; set; }
        public bool? NurFavoriten { get; set; }
        public bool WithCausa { get; set; }
    }
}
