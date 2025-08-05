using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
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
            serviceCollection.TryAddSingleton<WebRtcApiService>();
            return serviceCollection;
        }

        /// <summary>Starts the connection with the signaling server and waits for callers to connect over WebRTC.
        ///          Dependent on the Services WebRTCPeer, HttpClient, IRequestHandler.</summary>
        /// <param name="services">ServiceProvider for gathering required services.</param>
        /// <version date="30.07.2025" sb="MAC">AKP-441 Created.</version>
        public static async Task<IServiceProvider> StartWebRTC(this IServiceProvider serviceProvider)
        {
            WebRtcApiService webRtcApiService = serviceProvider.GetRequiredService<WebRtcApiService>();
            await webRtcApiService.StartWebRTC(serviceProvider);
            return serviceProvider;
        }
    }
}
