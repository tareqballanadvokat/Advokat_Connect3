namespace WebRTCLibrary.Utils
{
    public static class TaskHelpers
    {
        public static async Task WaitFor(Func<bool> predicate, int timeOut, Action? successCallback = null, Action? failureCallback = null, int delay = 100)
        {
            CancellationTokenSource cts = new CancellationTokenSource(timeOut);
            CancellationToken ct = cts.Token;

            await Task.Factory.StartNew(() =>
            {
                while (!ct.IsCancellationRequested)
                {
                    if (predicate.Invoke())
                    {
                        // success
                        successCallback?.Invoke();
                        return;
                    }

                    Task.Delay(delay);
                }

                // timout/failure
                failureCallback?.Invoke();
            });
        }
    }
}
