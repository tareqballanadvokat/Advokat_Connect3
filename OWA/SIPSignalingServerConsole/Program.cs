using Microsoft.Extensions.Logging;
using System.Net;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;

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

            SignalingServer signalingServer;

            try
            {
                // TODO: Get certpath from appsettings? Get Password from environment / registry?

                // IPEndPoint ServerEndpoint = new IPEndPoint(Dns.GetHostAddresses(Dns.GetHostName()).Last(), 80);
                // IPEndPoint ServerEndpoint = IPEndPoint.Parse("192.168.1.58:443");
                IPEndPoint serverEndpoint = new IPEndPoint(IPAddress.Loopback, 443);
                signalingServer = new SignalingServer(serverEndpoint, loggerFactory);

                string certPath = Path.Combine(Directory.GetCurrentDirectory(), "127.0.0.1.pfx");
                signalingServer.SSLCertificate = new X509Certificate2(certPath, "test");
            }
            catch (CryptographicException ex)
            {
                Console.WriteLine($"Cannot Start Server. {ex.Message}");
                Environment.Exit(-1);
                return;
            }

            signalingServer.StartServer();
            
            while (true)
            {
            }
        }
    }
}
