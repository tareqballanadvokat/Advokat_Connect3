using SIPSorcery.SIP;
using SIPSignalingServer.Models;
using WebRTCLibrary.SIP;
using WebRTCLibrary.SIP.Models;
using WebRTCLibrary.SIP.Utils;
using System.Diagnostics;
using WebRTCLibrary.Utils;

using static WebRTCLibrary.Utils.TaskHelpers;
using SIPSignalingServer.Utils;

namespace SIPSignalingServer.Dialogs
{
    internal class ServerRegistrationDialog : SIPDialog
    {
        private SIPRegistry Registry { get; set; }

        private new SIPParticipant RemoteParticipant { get => this.SourceParticipant; }

        private SIPParticipant ClientParticipant { get => this.RemoteParticipant; }

        private SIPRequest InitialRequest { get; set; }

        public event Action<ServerRegistrationDialog, RegistrationEventArgs>? OnRegistered;

        public event Action<ServerRegistrationDialog, FailedRegistrationEventArgs>? OnRegistrationFailed;


        //public event Action<ServerRegistrationDialog, SIPDialogEventArgs>? OnUnRegistered;

        public ServerRegistrationDialog(
            SIPRequest initialRequest,
            SIPParticipant remoteParticipant,
            SIPParticipant clientParticipant,
            SIPConnection connection,
            SIPRegistry registry,
            string callId,
            string remoteTag,
            string sourceTag)
            : base(
                  remoteParticipant,
                  clientParticipant,
                  connection,
                  callId,
                  sourceTag,
                  remoteTag)
        {
            this.InitialRequest = initialRequest;
            this.Registry = registry;
        }

        public async override Task Start()
        {
            await this.StartRegistartion();
        }

        public override Task Stop()
        {
            // TODO: something to unregister from signaling server side? Nothing like that is currently implement 
            throw new NotImplementedException();
        }

        private async Task StartRegistartion()
        {
            if (this.InitialRequest.Method != SIPMethodsEnum.REGISTER)
            {
                //this.RegistrationFailed(SIPResponseStatusCodesEnum.MethodNotAllowed, "Registration failed. Was not a registration request.");
                // TODO: Not a registration request. Registration failed event or ignore?
                return;
            }

            if (this.InitialRequest.Header.CSeq != 1)
            {
                this.RegistrationFailed(SIPResponseStatusCodesEnum.BadRequest, "Registration failed. Header was invalid.");
                return;
            }

            SIPRegistration registration = new SIPRegistration(this.ClientParticipant, this.SourceParticipant.Name);

            if (this.Registry.IsRegistered(registration))
            {
                // already registered
                return;
            }

            // register
            this.Registry.Register(registration);

            this.Connection.SIPRequestReceived += this.ACKListener;

            // send Accepted response
            SIPResponse accpetedResponse = this.GetRegisteredAcceptedResponse();
            Debug.WriteLine($"Server sending Accepted."); // DEBUG
            await this.Connection.SendSIPResponse(accpetedResponse);

            await WaitFor(
                () => this.Registry.IsConfirmed(registration),
                timeOut: this.ReceiveTimeout,
                failureCallback: () => this.RegistrationFailed(SIPResponseStatusCodesEnum.RequestTimeout, "Confirmation for registration timed out.", registration));

            // remove listener
            this.Connection.SIPRequestReceived -= this.ACKListener;
        }

        private SIPResponse GetRegisteredAcceptedResponse()
        {
            SIPHeaderParams headerParams = this.GetHeaderParams(cSeq: 2);

            // TODO: get scheme from request and respond in this scheme - or set scheme globally
            SIPSchemesEnum sipScheme = SIPSchemesEnum.sip;
            return SIPHelper.GetResponse(sipScheme, SIPResponseStatusCodesEnum.Accepted, headerParams);
        }

        private async Task ACKListener(SIPEndPoint localEndPoint, SIPEndPoint remoteEndPoint, SIPRequest request)
        {
            if (!this.IsPartOfDialog(request))
            {
                // not part of dialog - ignore
                return;
            }

            if (request.Method != SIPMethodsEnum.ACK)
            {
                this.RegistrationFailed(SIPResponseStatusCodesEnum.MethodNotAllowed, "Not a ACK request.");
                return;
            }

            if (request.Header.CSeq != 3)
            {
                this.RegistrationFailed(SIPResponseStatusCodesEnum.BadRequest, "Confirmation failed. Header was invalid.");
                return;
            }

            Debug.WriteLine($"Server received ACK"); // DEBUG
            SIPRegistration registration = new SIPRegistration(this.ClientParticipant, this.SourceParticipant.Name);
            this.Registry.Confirm(registration);

            this.OnRegistered?.Invoke(this, new RegistrationEventArgs(registration));
        }

        private void RegistrationFailed(SIPResponseStatusCodesEnum statusCode = SIPResponseStatusCodesEnum.None, string? message = null, SIPRegistration? registration = null)
        {
            if (registration != null)
            {
                this.Registry.Unregister(registration);
            }

            FailedRegistrationEventArgs eventArgs = new FailedRegistrationEventArgs();
            eventArgs.StatusCode = statusCode;
            eventArgs.Message = message;
            eventArgs.Registration = registration;

            this.OnRegistrationFailed?.Invoke(this, eventArgs);
        }
    }
}
