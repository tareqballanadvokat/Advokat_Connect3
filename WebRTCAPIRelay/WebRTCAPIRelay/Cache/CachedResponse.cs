using System.Timers;
using WebRTCAPIRelay.DTOs;
using Timer = System.Timers.Timer;

namespace WebRTCAPIRelay.Cache
{
    internal class CachedResponse : IDisposable
    {
        public RequestCache RequestCache { get; private set; }

        public WebRTCResponse Response { get; private set; }

        public int Lifetime { get; private set; }

        private Timer LifetimeTimer { get; set; }

        public CachedResponse(WebRTCResponse response, int lifetime, RequestCache requestCache)
        {
            this.RequestCache = requestCache;
            this.Response = response;
            this.Lifetime = lifetime;

            this.LifetimeTimer = new Timer();
            this.LifetimeTimer.Elapsed += LifetimeExpired;
            this.LifetimeTimer.AutoReset = false;
            this.LifetimeTimer.Interval = this.Lifetime;
            this.LifetimeTimer.Start();
        }

        private void LifetimeExpired(object? sender, ElapsedEventArgs e)
        {
            this.Dispose();
        }

        public void Dispose()
        {
            this.LifetimeTimer.Stop();
            this.LifetimeTimer.Dispose();
            this.RequestCache.RemoveFromCache(this.Response.Id);
        }
    }
}
