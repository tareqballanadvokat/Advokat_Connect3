using Microsoft.Extensions.Logging;
using SIPSignalingServer.Models;
using SIPSorcery.SIP;
using System.Text.Json;
using WebRTCClient.Models;

namespace SIPSignalingServer.Transactions
{
    internal class ICENegotiation
    {
        private readonly ILoggerFactory loggerFactory;

        private readonly ILogger<ICENegotiation> logger;

        private SIPTunnel SIPTunnel { get; set; }

        public ICENegotiation(SIPTunnel tunnel, ILoggerFactory loggerFactory)
        {
            this.loggerFactory = loggerFactory;
            this.logger = this.loggerFactory.CreateLogger<ICENegotiation>();

            this.SIPTunnel = tunnel;
        }

        public async Task Start()
        {
            await Task.Delay(1000).ConfigureAwait(false);

            await SendControlledAgentConfig();
            await SendControllingAgentConfig();
        }

        private async Task SendControllingAgentConfig()
        {
            SDPExchangeConfig controllingConfig = new SDPExchangeConfig();
            controllingConfig.IsOffering = true;
            string controllingConfigJson = JsonSerializer.Serialize(controllingConfig);

            await this.SIPTunnel.Left.SendRequest(SIPMethodsEnum.NOTIFY, controllingConfigJson, "application/json");
        }

        private async Task SendControlledAgentConfig()
        {
            SDPExchangeConfig controlledConfig = new SDPExchangeConfig();
            string controlledConfigJson = JsonSerializer.Serialize(controlledConfig);

            await this.SIPTunnel.Right.SendRequest(SIPMethodsEnum.NOTIFY, controlledConfigJson, "application/json");

        }
    }
}
