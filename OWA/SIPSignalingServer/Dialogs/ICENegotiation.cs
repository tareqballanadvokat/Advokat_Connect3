using SIPSignalingServer.Models;
using SIPSorcery.SIP;
using System.Text.Json;
using WebRTCClient.Models;

namespace SIPSignalingServer.Dialogs
{
    internal class ICENegotiation
    {
        private SIPTunnel SIPTunnel { get; set; }

        public ICENegotiation(SIPTunnel tunnel)
        {
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
            controllingConfig.IsControllingAgent = true;
            string controllingConfigJson = JsonSerializer.Serialize(controllingConfig);

            await this.SIPTunnel.Left.SendRequest(SIPMethodsEnum.NOTIFY, controllingConfigJson);
        }

        private async Task SendControlledAgentConfig()
        {
            SDPExchangeConfig controlledConfig = new SDPExchangeConfig();
            string controlledConfigJson = JsonSerializer.Serialize(controlledConfig);

            await this.SIPTunnel.Right.SendRequest(SIPMethodsEnum.NOTIFY, controlledConfigJson);

        }
    }
}
