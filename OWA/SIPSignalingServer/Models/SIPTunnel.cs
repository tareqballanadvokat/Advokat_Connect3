using SIPSignalingServer.Dialogs;

namespace SIPSignalingServer.Models
{
    internal class SIPTunnel
    {
        public RelayDialog Left { get; private set; }

        public RelayDialog Right { get; private set; }

        public bool Connected { get => this.Left.Relaying && this.Right.Relaying; }

        public SIPTunnel(RelayDialog left, RelayDialog right)
        {
            // TODO: Check params if they match?
            Left = left;
            Right = right;
        }

        public async Task Connect()
        {
            await this.Left.Start();
            await this.Right.Start();
        }

        public async Task Disconnect()
        {
            await this.Left.Stop();
            await this.Right.Stop();
        }
    }
}
