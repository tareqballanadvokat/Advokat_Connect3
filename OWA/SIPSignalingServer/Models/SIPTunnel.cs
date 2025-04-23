using Microsoft.Extensions.Logging;
using SIPSignalingServer.Transactions;

namespace SIPSignalingServer.Models
{
    internal class SIPTunnel
    {
        private readonly ILogger<SIPTunnel> logger;

        public SIPMessageRelay Left { get; private set; }

        public SIPMessageRelay Right { get; private set; }

        public bool Connected { get => this.Left.Relaying && this.Right.Relaying; }

        public SIPTunnel(SIPMessageRelay left, SIPMessageRelay right, ILoggerFactory loggerFactory)
        {
            this.logger = loggerFactory.CreateLogger<SIPTunnel>();

            // TODO: Check params if they match?
            Left = left;
            Right = right;

            this.Left.OnRequestReceived += this.Right.RelayRequest;
            this.Left.OnResponseReceived += this.Right.RelayResponse;

            this.Right.OnRequestReceived += this.Left.RelayRequest;
            this.Right.OnResponseReceived += this.Left.RelayResponse;
        }

        //public async Task Connect()
        //{
        //    await this.Left.Start();
        //    await this.Right.Start();
        //}

        //public async Task Disconnect()
        //{
        //    await this.Left.Stop();
        //    await this.Right.Stop();
        //}
    }
}
