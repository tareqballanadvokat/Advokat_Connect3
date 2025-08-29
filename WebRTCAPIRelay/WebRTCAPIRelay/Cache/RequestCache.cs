using System.Collections.Concurrent;
using WebRTCAPIRelay.DTOs;

namespace WebRTCAPIRelay.Cache
{
    internal class RequestCache : IRequestCache
    {
        public int CacheLifetime { get; set; } = 60000; // 1 min lifetime

        private ConcurrentDictionary<string, CachedResponse> cache = new();

        public WebRTCResponse? GetCachedResponse(WebRTCRequest request)
        {
            cache.TryGetValue(request.Id, out CachedResponse? cachedResponse);
            return cachedResponse?.Response;
        }

        public void CacheResponse(WebRTCResponse response)
        {
            CachedResponse cachedResponse = new CachedResponse(response, this.CacheLifetime, this);

            bool success = cache.TryAdd(response.Id, cachedResponse);
            if (!success)
            {
                // caching didn't work
                // TODO: Figure out what to do here
                return;
            }
        }

        public void RemoveFromCache(string id)
        {
            this.cache.TryRemove(id, out var _);
        }
    }
}
