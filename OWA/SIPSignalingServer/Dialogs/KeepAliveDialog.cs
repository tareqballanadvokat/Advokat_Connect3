using SIPSignalingServer.Models;
using WebRTCLibrary.SIP;

namespace SIPSignalingServer.Dialogs
{
    /// <summary>Dialog to keep the connection between the registered peer and the signaling server alive. While we wait for the other peer to connect.
    ///          Most firewalls / NATs have a timeout for open UDP /TCP connections.
    ///          
    ///          We need to keep the connection open for the server to notify the peer once the other peer has connected.</summary>
    /// <version date="01.04.2025" sb="MAC"></version>
    internal class KeepAliveDialog : ServerSideSIPDialog
    {
        private static readonly int defaultInterval = 14000; // 14 seconds. We assume a default timeout of 15 seconds for UDP connections.
                                                             // TODO: A future implementation could find this timeout dynamically.

        public KeepAliveDialog(ServerSideDialogParams dialogParams, SIPConnection connection)
            : base(dialogParams, connection)
        {
        }

        public int Interval { get; set; } = defaultInterval;

        private bool Running { get; set; }

        public async override Task Start()
        {
            if (this.Running)
            {
                // already running
                return;
            }

            this.Running = true;

            // TODO: should there be a timeout on this?
            CancellationTokenSource cts = new CancellationTokenSource();
            CancellationToken ct = cts.Token;

            await Task.Run(() => this.PingClient(cts), ct).ConfigureAwait(false);
        }

        public async override Task Stop()
        {
            this.Running = false;
        }

        private async Task PingClient(CancellationTokenSource cts)
        {
            while (this.Running)
            {
                // Ping client
                await Task.Delay(this.Interval);
            }

            cts.Cancel();
        }
    }
}
