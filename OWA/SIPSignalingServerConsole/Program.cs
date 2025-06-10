using Microsoft.Extensions.Logging;

namespace SIPSignalingServer
{
    internal class Program
    {
        static void Main(string[] args)
        {
            
            ILoggerFactory loggerFactory = LoggerFactory.Create(
                (builder) => {
                    builder.SetMinimumLevel(LogLevel.Debug);
                    builder.AddConsole();
                    //builder.AddDebug();
                });

            new SignalingServer(loggerFactory);
            
            while (true)
            {
            }
        }
    }
}
