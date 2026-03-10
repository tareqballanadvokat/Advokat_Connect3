namespace SIPSignalingServer.Models
{
    using System.Diagnostics.CodeAnalysis;
    using SIPSignalingServer.Transactions;
    using SIPSignalingServer.Utils.CustomEventArgs;

    public class SIPTunnel(SIPMessageRelay left) : IAsyncDisposable
    {
        private readonly SemaphoreSlim runningLock = new SemaphoreSlim(1, 1);

        private bool disposed;

        public event EventHandler<SIPTunnelConnectionStateEventArgs>? ConnectionStateChanged;

        public SIPMessageRelay Left => left;

        public SIPMessageRelay? Right { get; private set; }

        [MemberNotNullWhen(true, nameof(this.Right))]
        public bool Connected { get => this.Left.Relaying && (this.Right?.Relaying ?? false); }

        private bool Running { get; set; }

        [MemberNotNull(nameof(this.Right))]
        public void Connect(SIPMessageRelay right)
        {
            ObjectDisposedException.ThrowIf(this.disposed, this);

            // TODO: Check params if they match
            this.runningLock.Wait();
            try
            {
                if (this.Running && this.Right != right)
                {
                    throw new InvalidOperationException("Cannot change relay. Already running with different relay.");
                }

                this.Start(right);
            }
            finally
            {
                this.runningLock.Release();
            }
        }

        public async Task Disconnect()
        {
            // TODO: Check if try catch for ObjectDisposd should encapsulate whole method. Only applies to runningLock.
            //       Currently includes StopAsync aswell.
            try
            {
                await this.runningLock.WaitAsync();
                try
                {
                    if (!this.Running)
                    {
                        return;
                    }

                    await this.StopAsync();
                }
                finally
                {
                        this.runningLock.Release();
                }
            }
            catch (ObjectDisposedException)
            {
                // Disconnect was triggered by dispose first -> closes tunnel. A listener was still active.
                // Listener tries to close tunnel and triggeres an ObjectDisposedException.
                // can be safely ignored. Tunnel is already closed and disposed.
            }
        }

        [MemberNotNull(nameof(this.Right))]
        private void Start(SIPMessageRelay right)
        {
            this.Running = true;
            this.Right = right;
            this.AddListeners();

            if (this.Connected)
            {
                this.ConnectionStateChanged?.Invoke(this, new SIPTunnelConnectionStateEventArgs(true));
            }
        }

        private async Task StopAsync()
        {
            await this.Left.Stop();

            if (this.Right != null)
            {
                await this.Right.Stop();
                this.RemoveListeners();
                this.Right = null;
            }

            this.Running = false;
        }

        private void RelayStarted(object? sender, EventArgs e)
        {
            if (sender is SIPMessageRelay 
                && (sender == this.Left || sender == this.Right)
                && this.Connected)
            {
                this.ConnectionStateChanged?.Invoke(this, new SIPTunnelConnectionStateEventArgs(true));
            }
        }

        private async void RelayStopped(object? sender, EventArgs e)
        {
            if (sender is SIPMessageRelay
                && (sender == this.Left || sender == this.Right))
            {
                await this.Disconnect();

                // TODO: maybe pass wich side stopped
                this.ConnectionStateChanged?.Invoke(this, new SIPTunnelConnectionStateEventArgs(false));
            }
        }

        private void AddListeners()
        {
            this.Left.OnRequestReceived += this.Right!.RelayRequest;
            this.Left.OnResponseReceived += this.Right.RelayResponse;

            this.Left.RelayStarted += this.RelayStarted;
            this.Left.RelayStopped += this.RelayStopped;

            this.Right.OnRequestReceived += this.Left.RelayRequest;
            this.Right.OnResponseReceived += this.Left.RelayResponse;

            this.Right.RelayStarted += this.RelayStarted;
            this.Right.RelayStopped += this.RelayStopped;
        }

        private void RemoveListeners()
        {
            this.Left.OnRequestReceived -= this.Right!.RelayRequest;
            this.Left.OnResponseReceived -= this.Right.RelayResponse;

            this.Left.RelayStarted -= this.RelayStarted;
            this.Left.RelayStopped -= this.RelayStopped;

            this.Right.OnRequestReceived -= this.Left.RelayRequest;
            this.Right.OnResponseReceived -= this.Left.RelayResponse;

            this.Right.RelayStarted -= this.RelayStarted;
            this.Right.RelayStopped -= this.RelayStopped;
        }

        public async ValueTask DisposeAsync()
        {
            await this.DisposeAsync(true);
        }

        protected virtual async ValueTask DisposeAsync(bool disposing)
        {
            if (this.disposed)
            {
                return;
            }

            if (disposing)
            {
                await this.Disconnect().ConfigureAwait(false);
                this.runningLock.Dispose();
            }

            this.disposed = true;
        }
    }
}
