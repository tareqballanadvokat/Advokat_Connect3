namespace WebRTCLibrary.Utils
{
    public static class TaskHelpers
    {

        public static async Task WaitFor(
           Func<bool> predicate,
           int timeOut,
           CancellationToken ct,
           Action? successCallback = null,
           Action? timeoutCallback = null,
           Action? cancellationCallback = null)
        {
            CancellationTokenSource timeoutCts = new CancellationTokenSource(timeOut);
            CancellationToken timeoutCt = timeoutCts.Token;

            await WaitFor(predicate, timeoutCt, ct, successCallback, timeoutCallback, cancellationCallback);
        }

        public static async Task WaitFor(
            Func<bool> predicate,
            CancellationToken timeoutCt,
            CancellationToken ct,
            Action? successCallback = null,
            Action? timeoutCallback = null,
            Action? cancellationCallback = null)
        {
            await Task.Factory.StartNew(() =>
            {
                while (!timeoutCt.IsCancellationRequested)
                {
                    if (ct.IsCancellationRequested)
                    {
                        cancellationCallback?.Invoke();
                        return;
                    }

                    if (predicate())
                    {
                        // success
                        successCallback?.Invoke();
                        return;
                    }
                }

                // timout/failure
                timeoutCallback?.Invoke();
            });
        }

        public static async Task WaitFor(
            Func<bool> predicate,
            int timeOut,
            CancellationToken ct,
            int interval,
            Action? successCallback = null,
            Action? timeoutCallback = null,
            Action? cancellationCallback = null)
        {
            CancellationTokenSource timeoutCts = new CancellationTokenSource(timeOut);
            CancellationToken timeoutCt = timeoutCts.Token;

            await WaitFor(predicate, timeoutCt, ct, interval, successCallback, timeoutCallback, cancellationCallback);
        }

        public static async Task WaitFor(
            Func<bool> predicate,
            CancellationToken timeoutCt,
            CancellationToken ct,
            int interval,
            Action? successCallback = null,
            Action? timeoutCallback = null,
            Action? cancellationCallback = null)
        {
            await Task.Factory.StartNew(() =>
            {
                while (!timeoutCt.IsCancellationRequested)
                {
                    if (ct.IsCancellationRequested)
                    {
                        cancellationCallback?.Invoke();
                        return;
                    }

                    if (predicate())
                    {
                        // success
                        successCallback?.Invoke();
                        return;
                    }

                    // This might be blocking. TODO: Check if this is right
                    Task.Delay(interval).Wait();
                }

                // timout/failure
                timeoutCallback?.Invoke();
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
            Func<Task>? timeoutCallback = null,
            Func<Task>? cancellationCallback = null)
        {
            CancellationTokenSource timeoutCts = new CancellationTokenSource(timeOut);
            CancellationToken timeoutCt = timeoutCts.Token;

            await WaitForAsync(predicate, timeoutCt, ct, interval, successCallback, timeoutCallback, cancellationCallback);
        }

        public static async Task WaitForAsync(
            Func<bool> predicate,
            CancellationToken timeoutToken,
            CancellationToken ct,
            int interval,
            Func<Task>? successCallback = null,
            Func<Task>? timeoutCallback = null,
            Func<Task>? cancellationCallback = null)
        {
            await Task.Factory.StartNew(async () =>
            {
                while (!timeoutToken.IsCancellationRequested)
                {
                    if (ct.IsCancellationRequested)
                    {
                        if (cancellationCallback != null)
                        {
                            await cancellationCallback();
                        }

                        return;
                    }

                    if (predicate())
                    {
                        // success
                        if (successCallback != null)
                        {
                            await successCallback();
                        }
                        return;
                    }

                    // This might be blocking. TODO: Check if this is right
                    Task.Delay(interval).Wait();
                }

                // timout/failure
                if (timeoutCallback != null)
                {
                    await timeoutCallback();
                }
            });
        }

        public static async Task WaitForAsync(
            Func<bool> predicate,
            int timeOut,
            CancellationToken ct,
            Func<Task>? successCallback = null,
            Func<Task>? timeoutCallback = null,
            Func<Task>? cancellationCallback = null)
        {
            CancellationTokenSource timeoutCts = new CancellationTokenSource(timeOut);
            CancellationToken timeoutCt = timeoutCts.Token;

            await WaitForAsync(predicate, timeoutCt, ct, successCallback, timeoutCallback, cancellationCallback);
        }

        public static async Task WaitForAsync(
            Func<bool> predicate,
            CancellationToken timeoutToken,
            CancellationToken ct,
            Func<Task>? successCallback = null,
            Func<Task>? timeoutCallback = null,
            Func<Task>? cancellationCallback = null)
        {
            await Task.Factory.StartNew(async () =>
            {
                while (!timeoutToken.IsCancellationRequested)
                {
                    if (ct.IsCancellationRequested)
                    {
                        if (cancellationCallback != null)
                        {
                            await cancellationCallback();
                        }
                        return;
                    }

                    if (predicate())
                    {
                        // success
                        if (successCallback != null)
                        {
                            await successCallback();
                        }
                        return;
                    }
                }

                // timout/failure
                if (timeoutCallback != null)
                {
                    await timeoutCallback();
                }
            });
        }
    }
}
