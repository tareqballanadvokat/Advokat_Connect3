using Microsoft.Extensions.Logging;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using WebRTCLibrary.SIP.Utils;

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

            string certPath;

            try
            {
                // TODO: Get certpath from appsettings? Get Password from environment / registry?
                certPath = Path.Combine(Directory.GetCurrentDirectory(), "127.0.0.1.pfx");
                SIPChannelsEnum.SSLCertificate = new X509Certificate2(certPath, "test");
            }
            catch (CryptographicException ex)
            {
                Console.WriteLine($"Cannot Start Server. {ex.Message}");
                Environment.Exit(-1);
            }

            new SignalingServer(loggerFactory);
            
            while (true)
            {
            }
        }
    }
}
