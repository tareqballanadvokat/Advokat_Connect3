using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Org.BouncyCastle.Security.Certificates;
using System.Net;
using System.Security.Cryptography.X509Certificates;

namespace SIPSignalingServer
{
    internal class Program
    {
        static X509Certificate2 Certificate;

        static IPEndPoint ServerEndpoint;

        static void Main(string[] args)
        {
            ReadConfig();

            ILoggerFactory loggerFactory = LoggerFactory.Create(
                (builder) => {
                    builder.SetMinimumLevel(LogLevel.Debug);
                    builder.AddConsole();
                    //builder.AddDebug();
                });

            SignalingServerOptions signalingServerOptions = new SignalingServerOptions()
            {
                SSLCertificate = Certificate,
            };

            SignalingServer signalingServer = new SignalingServer(ServerEndpoint, signalingServerOptions, loggerFactory);
            signalingServer.StartServer();
            
            while (true)
            {
            }
        }

        static void ReadConfig()
        {
            IConfigurationBuilder configuration = new ConfigurationBuilder()
                .SetBasePath(Directory.GetCurrentDirectory())
                .AddJsonFile($"appsettings.json");

            IConfiguration config = configuration.Build();
            try
            {
                ReadCert(config);
                ReadServerEndpoint(config);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Cannot Start Server. {ex.Message}");
                Environment.Exit(-1);
                return;
            }
        }

        static void ReadCert(IConfiguration config)
        {
            string cert = config.GetValue<string>("cert")
                ?? throw new CertificateException("No valid ssl certificate provided");

            string? certPassword = config.GetValue<string>("certPassword")
                ?? throw new CertificateException("No password for cert provided");
            
            // TODO: Get Password from environment / registry?
            string certPathString = Path.Combine(Directory.GetCurrentDirectory(), cert);
            Certificate = new X509Certificate2(certPathString, certPassword);
        }

        static void ReadServerEndpoint(IConfiguration config)
        {
            string serverEndpointString = config.GetValue<string>("serverEndpoint")
                ?? throw new CertificateException("No valid ssl certificate provided");

            ServerEndpoint = IPEndPoint.Parse(serverEndpointString);
        }
    }
}
