using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging.Abstractions;
using System.Net;
using WebRTCAPIRelay.Cache;
using WebRTCClient;

namespace WebRTCAPIRelay
{
    public static class DependencyInjectionExtensions
    {
        /// <summary></summary>
        /// <param name="serviceCollection"></param>
        /// <returns></returns>
        /// <version date="05.08.2025" sb="MARTIN ACHENRAINER"></version>
        public static IServiceCollection AddWebRTCRemote(this IServiceCollection serviceCollection)
        {
            serviceCollection.TryAddSingleton<IRequestCache>(new RequestCache());
            serviceCollection
                .AddWebRTCPeer()
                .TryAddSingleton<WebRtcApiService>((sp) => new WebRtcApiService(sp));

            return serviceCollection;
        }

        /// <summary>Starts the connection with the signaling server and waits for callers to connect over WebRTC.
        ///          Dependent on the Services WebRTCPeer, HttpClient, IRequestHandler.</summary>
        /// <param name="services">ServiceProvider for gathering required services.</param>
        /// <version date="30.07.2025" sb="MAC">AKP-441 Created.</version>
        public static async Task<IServiceProvider> StartWebRTC(this IServiceProvider serviceProvider)
        {
            WebRtcApiService webRtcApiService = serviceProvider.GetRequiredService<WebRtcApiService>();
            await webRtcApiService.StartWebRTC();
            return serviceProvider;
        }

        private static IServiceCollection AddWebRTCPeer(this IServiceCollection serviceCollection)
        {
            // TODO:
            // pass config for signaling server endpoint and ice servers (STUN and TURN server hosted on Advokat.com?)
            // after implementing multiple connections with the same registration, caller should be empty
            // remote should be a unique string - does every server have an id? Or request a unique id from signaling server?

            string callerName = "macc";
            string remoteName = "macs";

            IPEndPoint? remoteEndpoint = new IPEndPoint(Dns.GetHostAddresses(Dns.GetHostName()).LastOrDefault(), 7008);
            IPEndPoint signalingServerEndpoint = new IPEndPoint(IPAddress.Loopback, 8009);

            WebRTCPeer webRtcPeer = new WebRTCPeer(
                sourceUser: remoteName,
                remoteUser: callerName,
                sourceEndpoint: remoteEndpoint,
                signalingServer: signalingServerEndpoint,
                iceServers: [],
                NullLoggerFactory.Instance
                );

            webRtcPeer.WebRTCConfig.SIPClientConfig.PeerRegistrationTimeout = null;
            serviceCollection.TryAddSingleton<IWebRTCPeer>(webRtcPeer);

            return serviceCollection;
        }
    }
}
