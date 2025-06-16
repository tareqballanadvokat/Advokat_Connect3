using SIPSignalingServer.Transactions;
using System.Diagnostics.CodeAnalysis;

namespace SIPSignalingServer.Models
{
    public class SIPTunnel
    {
        public SIPMessageRelay Left { get; private set; }

        public SIPMessageRelay? Right { get; private set; }

        [MemberNotNullWhen(true, nameof(this.Right))]
        public bool Connected { get => this.Left.Relaying && (this.Right?.Relaying ?? false); }

        public delegate Task ConnectionStateChangedDelegate(SIPTunnel sender);

        public event ConnectionStateChangedDelegate? ConnectionEstablished;

        public event ConnectionStateChangedDelegate? ConnectionStopped;

        //public CancellationToken Ct { get; private set; }

        public SIPTunnel(SIPMessageRelay left) //, SIPMessageRelay right)
        {
            // TODO: Check that relays are not relaying right now?

            // TODO: Check params if they match?
            Left = left;
            //Right = right;

            //this.Left.OnRequestReceived += this.Right.RelayRequest;
            //this.Left.OnResponseReceived += this.Right.RelayResponse;

            //this.Right.OnRequestReceived += this.Left.RelayRequest;
            //this.Right.OnResponseReceived += this.Left.RelayResponse;

            this.Left.RelayStarted += this.RelayStarted;
            //this.Right.RelayStarted += this.RelayStarted;

            this.Left.RelayStopped += this.RelayStopped;
            //this.Right.RelayStopped += this.RelayStopped;
        }

        [MemberNotNull(nameof(this.Right))]
        public void Connect(SIPMessageRelay right)
        {
            // TODO: Check params if they match
            // TODO: forbid changing while it is Connected

            if (this.Connected)
            {
                throw new InvalidOperationException("Cannot change relay while it is connected.");
            }

            this.Right = right;

            this.Left.OnRequestReceived += this.Right.RelayRequest;
            this.Left.OnResponseReceived += this.Right.RelayResponse;

            this.Right.OnRequestReceived += this.Left.RelayRequest;
            this.Right.OnResponseReceived += this.Left.RelayResponse;

            this.Right.RelayStarted += this.RelayStarted;
            this.Right.RelayStopped += this.RelayStopped;
        }

        /// <summary> Should be called right after the Connect method.
        ///     This should be at the end of the Connect method.
        ///     We cannot use the connect method in a lock statement if that is that case</summary>
        public async Task CheckForConnection()
        {
            if (this.Connected)
            {
                await (this.ConnectionEstablished?.Invoke(this) ?? Task.CompletedTask);
            }
        }

        public async Task Disconnect()
        {
            await this.Left.Stop();
            await (this.Right?.Stop() ?? Task.CompletedTask);
        }

        private async Task RelayStarted(SIPMessageRelay relay)
        {
            if ((relay == this.Left || relay == this.Right)
                && this.Connected)
            {
                await (this.ConnectionEstablished?.Invoke(this) ?? Task.CompletedTask);
            }
        }

        private async Task RelayStopped(SIPMessageRelay relay)
        {
            if (relay == this.Left || relay == this.Right)
                //&& this.Connected)  uncomment if connected is its own bool property. Otherwise it would always be false
            {
                await this.Disconnect();

                // TODO: maybe pass wich side stopped
                await (this.ConnectionStopped?.Invoke(this) ?? Task.CompletedTask);
            }
        }
    }
}
