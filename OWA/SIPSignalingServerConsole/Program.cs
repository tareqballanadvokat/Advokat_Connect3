using Microsoft.Extensions.Logging.Abstractions;

namespace SIPSignalingServer
{
    internal class Program
    {
        static void Main(string[] args)
        {
            new SignalingServer(NullLoggerFactory.Instance);
            
            while (true)
            {
            }
        }
    }
}
