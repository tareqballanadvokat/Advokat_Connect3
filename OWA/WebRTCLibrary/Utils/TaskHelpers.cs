namespace WebRTCLibrary.Utils
{
    public static class TaskHelpers
    {
        public static async Task WaitFor(Func<bool> predicate, int timeOut, Action? successCallback = null, Action? failureCallback = null, int interval = 100)
        {
            CancellationTokenSource cts = new CancellationTokenSource(timeOut);
            CancellationToken ct = cts.Token;

            await WaitFor(predicate, ct, successCallback, failureCallback, interval);
        }

        /// <summary>Same as WaitFor but with async callback methods.</summary>
        /// <version date="02.04.2025" sb="MAC"></version>
        public static async Task WaitFor(Func<bool> predicate, CancellationToken ct, Action? successCallback = null, Action? failureCallback = null, int interval = 100)
        {
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

                    // This might be blocking. TODO: Check if this is right
                    Task.Delay(interval).Wait();
                }

                // timout/failure
                failureCallback?.Invoke();
            });
        }

        /// <summary>Same as WaitFor but with async callback methods.</summary>
        /// <version date="02.04.2025" sb="MAC"></version>
        public static async Task WaitForAsync(Func<bool> predicate, int timeOut, Func<Task>? successCallback = null, Func<Task>? failureCallback = null, int interval = 100)
        {
            CancellationTokenSource cts = new CancellationTokenSource(timeOut);
            CancellationToken ct = cts.Token;

            await WaitForAsync(predicate, ct, successCallback, failureCallback, interval);
        }

        public static async Task WaitForAsync(Func<bool> predicate, CancellationToken ct, Func<Task>? successCallback = null, Func<Task>? failureCallback = null, int interval = 100)
        {
            await Task.Factory.StartNew(async () =>
            {
                while (!ct.IsCancellationRequested)
                {
                    if (predicate.Invoke())
                    {
                        // success
                        if (successCallback != null)
                        {
                            await successCallback.Invoke();
                        }
                        return;
                    }

                    // This might be blocking. TODO: Check if this is right
                    Task.Delay(interval).Wait();
                }

                // timout/failure
                if (failureCallback != null)
                {
                    await failureCallback.Invoke();
                }
            });
        }
    }
}
