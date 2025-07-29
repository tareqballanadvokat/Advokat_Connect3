using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using System.Net;
using WebRTCClient;

namespace WebRTCAPIRelay
{
    public static class WebRtcApiService
    {
        public static IServiceCollection AddWebRTCRemote(this IServiceCollection services)
        {
            services.AddSingleton<WebRTCPeer>((IServiceProvider) => {
                string callerName = "caller";
                string remoteName = "remote";

                IPEndPoint? remoteEndpoint = new IPEndPoint(Dns.GetHostAddresses(Dns.GetHostName()).LastOrDefault(), 7008);
                IPEndPoint signalingServerEndpoint = new IPEndPoint(IPAddress.Loopback, 8009);

                WebRTCPeer userAgent = new WebRTCPeer(
                   sourceUser: remoteName,
                   remoteUser: callerName,
                   sourceEndpoint: remoteEndpoint,
                   signalingServer: signalingServerEndpoint,
                   iceServers: [],
                   NullLoggerFactory.Instance
                   );

                //await userAgent.Connect();

                return userAgent;
            });
            return services;
        }
    }
}
