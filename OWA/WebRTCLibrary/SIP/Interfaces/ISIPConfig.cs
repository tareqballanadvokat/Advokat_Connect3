namespace WebRTCLibrary.SIP.Interfaces
{
    public interface ISIPConfig : ICloneable
    {
        public int ReceiveTimeout { get; set; }
    }
}
