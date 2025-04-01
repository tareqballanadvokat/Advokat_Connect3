namespace WebRTCLibrary.Utils
{
    public static class TaskHelpers
    {
        public static async Task WaitFor(Func<bool> predicate, int timeOut, Action? successCallback = null, Action? failureCallback = null, int interval = 100)
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

                    Task.Delay(interval);
                }

                // timout/failure
                failureCallback?.Invoke();
            });
        }

        //public static async Task WaitFor(Func<bool> predicate, int timeOut, Task? successCallback = null, Task? failureCallback = null, int interval = 100)
        //{
        //    CancellationTokenSource cts = new CancellationTokenSource(timeOut);
        //    CancellationToken ct = cts.Token;

        //    await Task.Factory.StartNew(async () =>
        //    {
        //        while (!ct.IsCancellationRequested)
        //        {
        //            if (predicate.Invoke())
        //            {
        //                // success
        //                if (successCallback != null)
        //                {
        //                    await successCallback;
        //                }
        //                return;
        //            }

        //            await Task.Delay(interval);
        //        }

        //        // timout/failure
        //        if (failureCallback != null)
        //        {
        //            await failureCallback;
        //        }
        //    });
        //}
    }
}
