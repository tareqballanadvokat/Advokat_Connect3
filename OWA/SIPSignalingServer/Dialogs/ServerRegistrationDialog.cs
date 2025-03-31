using SIPSorcery.SIP;
using SIPSignalingServer.Models;
using WebRTCLibrary.SIP;
using WebRTCLibrary.SIP.Models;
using WebRTCLibrary.SIP.Utils;
using System.Diagnostics;

namespace SIPSignalingServer.Dialogs
{
    internal class ServerRegistrationDialog : SIPDialog
    {
        private SIPRegisty Registy { get; set; }

        private SIPParticipant SignalingServerParticipant { get => this.SourceParticipant; }

        private SIPParticipant ClientParticipant { get => this.RemoteParticipant; }

        private SIPRequest InitialRequest { get; set; }

        public ServerRegistrationDialog(
            SIPRequest initialRequest,
            SIPParticipant signalingServerParticipant,
            SIPParticipant clientParticipant,
            SIPConnection connection,
            SIPRegisty registy,
            string callId,
            string remoteTag)
            : base(
                  signalingServerParticipant,
                  clientParticipant,
                  connection,
                  callId,
                  null,
                  remoteTag)
        {
            this.InitialRequest = initialRequest;
            this.Registy = registy;
        }

        public async override Task Start()
        {
            if (this.InitialRequest.Method != SIPMethodsEnum.REGISTER)
            {
                // registration failed. Was not a registration request
                return;
            }

            SIPRegistration registration = new SIPRegistration(this.ClientParticipant, this.SignalingServerParticipant.Name);

            if (this.Registy.IsRegistered(registration))
            {
                // already registered
                return;
            }

            // register
            this.Registy.Register(registration); // TODO: register on first request or on ACK?

            this.Connection.SIPRequestReceived += this.ACKListener;

            // send Accepted response
            this.SourceTag = CallProperties.CreateNewTag();
            SIPResponse accpetedResponse = this.GetRegisteredAcceptedResponse();
            Debug.WriteLine($"Server sending Accepted."); // DEBUG

            await this.Connection.SendSIPResponse(accpetedResponse);
        }

        public override Task Stop()
        {
            // TODO: something to unregister?
            throw new NotImplementedException();
        }

        private SIPResponse GetRegisteredAcceptedResponse()
        {
            SIPHeaderParams headerParams = this.GetHeaderParams(2);

            // TODO: get scheme from request and respond in this scheme - or set scheme globally
            SIPSchemesEnum sipScheme = SIPSchemesEnum.sip;
            return SIPHelper.GetResponse(sipScheme, SIPResponseStatusCodesEnum.Accepted, headerParams);
        }

        private async Task ACKListener(SIPEndPoint localEndPoint, SIPEndPoint remoteEndPoint, SIPRequest request)
        {
            if (!this.IsPartOfDialog(request))
            {
                // not part of dialog
                return;
            }

            if (!this.IsValidACKRequest(request))
            {
                // invalid ack request
                // TODO: do something?
                return;
            }

            Debug.WriteLine($"Server received ACK"); // DEBUG
                                                         
            // remove listener
            // TODO: also remove on invalid request?
            this.Connection.SIPRequestReceived -= this.ACKListener;

            // TODO: do something?
        }

        private bool IsValidACKRequest(SIPRequest request)
        {
            return request.Method == SIPMethodsEnum.ACK
                && request.Header.CSeq == 3;
        }
    }
}
