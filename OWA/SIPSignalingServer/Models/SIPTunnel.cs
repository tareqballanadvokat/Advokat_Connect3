using SIPSignalingServer.Transactions;
using SIPSignalingServer.Utils.CustomEventArgs;
using System.Diagnostics.CodeAnalysis;

namespace SIPSignalingServer.Models
{
    public class SIPTunnel(SIPMessageRelay left) : IAsyncDisposable
    {
        private readonly SemaphoreSlim runningLock = new SemaphoreSlim(1, 1);

        public SIPMessageRelay Left => left;

        public SIPMessageRelay? Right { get; private set; }

        [MemberNotNullWhen(true, nameof(this.Right))]
        public bool Connected { get => this.Left.Relaying && (this.Right?.Relaying ?? false); }

        public event EventHandler<SIPTunnelConnectionStateEventArgs>? ConnectionStateChanged;

        private bool Running { get; set; }

        [MemberNotNull(nameof(this.Right))]
        public void Connect(SIPMessageRelay right)
        {
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
            await this.runningLock.WaitAsync();
            try
            {
                if (!this.Running)
                {
                    return;
                }

                await this.Stop();
               
            }
            finally
            {
                this.runningLock.Release();
            }
        }

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

        private async Task Stop()
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
            await this.Disconnect();
            this.runningLock?.Dispose();
        }
    }
}
