namespace WebRTCLibrary.Utils
{
    public static class TaskHelpers
    {

        public static async Task WaitFor(
           Func<bool> predicate,
           int timeOut,
           CancellationToken ct,
           Action? successCallback = null,
           Action? failureCallback = null)
        {
            CancellationTokenSource timeoutCts = new CancellationTokenSource(timeOut);
            CancellationToken timeoutCt = timeoutCts.Token;

            await WaitFor(predicate, timeoutCt, ct, successCallback, failureCallback);
        }

        public static async Task WaitFor(
            Func<bool> predicate,
            CancellationToken timeoutCt,
            CancellationToken ct,
            Action? successCallback = null,
            Action? failureCallback = null)
        {
            await Task.Factory.StartNew(() =>
            {
                while (!timeoutCt.IsCancellationRequested)
                {
                    if (ct.IsCancellationRequested)
                    {
                        return;
                    }

                    if (predicate.Invoke())
                    {
                        // success
                        successCallback?.Invoke();
                        return;
                    }
                }

                // timout/failure
                failureCallback?.Invoke();
            });
        }

        public static async Task WaitFor(
            Func<bool> predicate,
            int timeOut,
            CancellationToken ct,
            int interval,
            Action? successCallback = null,
            Action? failureCallback = null)
        {
            CancellationTokenSource timeoutCts = new CancellationTokenSource(timeOut);
            CancellationToken timeoutCt = timeoutCts.Token;

            await WaitFor(predicate, timeoutCt, ct, interval, successCallback, failureCallback);
        }

        public static async Task WaitFor(
            Func<bool> predicate,
            CancellationToken timeoutCt,
            CancellationToken ct,
            int interval,
            Action? successCallback = null,
            Action? failureCallback = null)
        {
            await Task.Factory.StartNew(() =>
            {
                while (!timeoutCt.IsCancellationRequested)
                {
                    if (ct.IsCancellationRequested)
                    {
                        return;
                    }

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
        public static async Task WaitForAsync(
            Func<bool> predicate,
            int timeOut,
            CancellationToken ct,
            int interval,
            Func<Task>? successCallback = null,
            Func<Task>? failureCallback = null)
        {
            CancellationTokenSource timeoutCts = new CancellationTokenSource(timeOut);
            CancellationToken timeoutCt = timeoutCts.Token;

            await WaitForAsync(predicate, timeoutCt, ct, interval, successCallback, failureCallback);
        }

        public static async Task WaitForAsync(
            Func<bool> predicate,
            CancellationToken timeoutToken,
            CancellationToken ct,
            int interval,
            Func<Task>? successCallback = null,
            Func<Task>? failureCallback = null)
        {
            await Task.Factory.StartNew(async () =>
            {
                while (!timeoutToken.IsCancellationRequested)
                {
                    if (ct.IsCancellationRequested)
                    {
                        return;
                    }

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

        public static async Task WaitForAsync(
            Func<bool> predicate,
            int timeOut,
            CancellationToken ct,
            Func<Task>? successCallback = null,
            Func<Task>? failureCallback = null)
        {
            CancellationTokenSource timeoutCts = new CancellationTokenSource(timeOut);
            CancellationToken timeoutCt = timeoutCts.Token;

            await WaitForAsync(predicate, timeoutCt, ct, successCallback, failureCallback);
        }

        public static async Task WaitForAsync(
            Func<bool> predicate,
            CancellationToken timeoutToken,
            CancellationToken ct,
            Func<Task>? successCallback = null,
            Func<Task>? failureCallback = null)
        {
            await Task.Factory.StartNew(async () =>
            {
                while (!timeoutToken.IsCancellationRequested)
                {
                    if (ct.IsCancellationRequested)
                    {
                        return;
                    }

                    if (predicate.Invoke())
                    {
                        // success
                        if (successCallback != null)
                        {
                            await successCallback.Invoke();
                        }
                        return;
                    }
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
