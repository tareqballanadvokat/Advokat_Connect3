//using Microsoft.Extensions.Logging;
//using SIPSignalingServer.Models;
//using SIPSorcery.SIP;
//using System.Text.Json;
//using WebRTCClient.Models;

//namespace SIPSignalingServer.Transactions
//{
//    // Initiatior for the ICE negotiation
//    internal class ICENegotiation
//    {
//        private readonly ILoggerFactory loggerFactory;

//        private readonly ILogger<ICENegotiation> logger;

//        private SIPTunnel SIPTunnel { get; set; }

//        public ICENegotiation(SIPTunnel tunnel, ILoggerFactory loggerFactory)
//        {
//            this.loggerFactory = loggerFactory;
//            this.logger = this.loggerFactory.CreateLogger<ICENegotiation>();

//            this.SIPTunnel = tunnel;
//        }

//        public async Task Start()
//        {
//            this.logger.LogDebug(
//                "Starting ICE negotiation. {left} - {right}",
//                this.SIPTunnel.Left.Params.ClientParticipant,
//                this.SIPTunnel.Right.Params.ClientParticipant);

//            await SendControlledAgentConfig();
//            await SendControllingAgentConfig();
//        }

//        private async Task SendControllingAgentConfig()
//        {
//            SDPExchangeConfig controllingConfig = new SDPExchangeConfig();
//            controllingConfig.IsOffering = true;
//            string controllingConfigJson = JsonSerializer.Serialize(controllingConfig);

//            this.logger.LogDebug(
//                "Sending SDP offering allocation - to:'{to}' tag:\"{toTag}\"",
//                this.SIPTunnel.Left.Params.ClientParticipant,
//                this.SIPTunnel.Left.Params.ClientTag);

//            await this.SIPTunnel.Left.SendRequest(SIPMethodsEnum.NOTIFY, controllingConfigJson, "application/json");
//        }

//        private async Task SendControlledAgentConfig()
//        {
//            SDPExchangeConfig controlledConfig = new SDPExchangeConfig();
//            string controlledConfigJson = JsonSerializer.Serialize(controlledConfig);

//            this.logger.LogDebug(
//                "Sending SDP answering allocation - to:'{to}' tag:\"{toTag}\"",
//                this.SIPTunnel.Right.Params.ClientParticipant,
//                this.SIPTunnel.Right.Params.ClientTag);

//            await this.SIPTunnel.Right.SendRequest(SIPMethodsEnum.NOTIFY, controlledConfigJson, "application/json");
//        }
//    }
//}
