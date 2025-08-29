using WebRTCAPIRelay.DTOs;

namespace WebRTCAPIRelay.Cache
{
    internal interface IRequestCache
    {
        public int CacheLifetime { get; set; }

        public WebRTCResponse? GetCachedResponse(WebRTCRequest request);

        public void CacheResponse(WebRTCResponse response);

    }
}
