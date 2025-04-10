using SIPSorcery.SIP;
using SIPSignalingServer.Models;
using WebRTCLibrary.SIP;
using WebRTCLibrary.SIP.Models;
using WebRTCLibrary.SIP.Utils;
using System.Diagnostics;
using SIPSignalingServer.Utils.CustomEventArgs;

using static WebRTCLibrary.Utils.TaskHelpers;

namespace SIPSignalingServer.Dialogs
{
    internal class ServerRegistrationDialog : ServerSideSIPDialog
    {
        public bool Registered { get; private set; }

        private SIPRegistry Registry { get; set; }

        private SIPRequest InitialRequest { get; set; }

        private SIPRegistration Registration { get; set; }

        public event Action<ServerRegistrationDialog, FailedRegistrationEventArgs>? OnRegistrationFailed;

        public ServerRegistrationDialog(SIPSchemesEnum sipScheme, SIPTransport transport, SIPRequest initialRequest, SIPEndPoint signalingServer, SIPRegistry registry)
            : this(
                sipScheme,
                transport,
                initialRequest,
                GetParamsFromRequest(initialRequest, signalingServer),
                registry)
        {  
        }

        public ServerRegistrationDialog(SIPSchemesEnum sipScheme, SIPTransport transport, SIPRequest initialRequest, ServerSideDialogParams dialogParams, SIPRegistry registry)
            :base(sipScheme,
                 transport,
                 dialogParams)
        {
            this.InitialRequest = initialRequest;
            this.Registry = registry;
            this.Registration = new SIPRegistration(this.Params);
        }

        public async override Task Start()
        {
            await this.StartRegistartion();
        }

        public async override Task Stop()
        {
            if (!this.Registered)
            {
                // Not registered
                return;
            }

            // TODO: something to unregister from signaling server side? Nothing like that is currently implement.
            //       Send message to client?
            this.Registry.Unregister(this.Registration);

            this.Registered = false;
            // TODO: send event - registering stopped
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

            if (this.Registry.IsRegistered(this.Registration))
            {
                // already registered
                return;
            }

            await this.Register();
        }

        private async Task Register()
        {
            this.Registry.Register(this.Registration);

            this.Connection.SIPRequestReceived += this.ACKListener;

            // send Accepted response
            Debug.WriteLine($"Server sending Accepted."); // DEBUG
            SIPResponse accpetedResponse = this.GetRegisteredAcceptedResponse();
            await this.Connection.SendSIPResponse(accpetedResponse);

            await WaitFor(
                () => this.Registry.IsConfirmed(this.Registration),
                timeOut: this.ReceiveTimeout,
                successCallback: () => { this.Registered = true; },
                failureCallback: () => this.RegistrationFailed(SIPResponseStatusCodesEnum.RequestTimeout, "Confirmation for registration timed out."));

            // remove listener
            this.Connection.SIPRequestReceived -= this.ACKListener;
        }

        private SIPResponse GetRegisteredAcceptedResponse()
        {
            SIPHeaderParams headerParams = this.GetHeaderParams(cSeq: 2);
            return SIPHelper.GetResponse(this.SIPScheme, SIPResponseStatusCodesEnum.Accepted, headerParams);
        }

        private async Task ACKListener(SIPEndPoint localEndPoint, SIPEndPoint remoteEndPoint, SIPRequest request)
        {
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
            this.Registry.Confirm(this.Registration);
        }

        private void RegistrationFailed(SIPResponseStatusCodesEnum statusCode = SIPResponseStatusCodesEnum.None, string? message = null)
        {
            if (this.Registry.IsRegistered(this.Registration))
            {
                this.Registry.Unregister(this.Registration);
            }

            FailedRegistrationEventArgs eventArgs = new FailedRegistrationEventArgs();
            eventArgs.StatusCode = statusCode;
            eventArgs.Message = message;
            eventArgs.Registration = this.Registration; // TODO: is this even needed?

            this.OnRegistrationFailed?.Invoke(this, eventArgs);
        }

        private static SIPParticipant GetCallerParticipant(SIPRequest request)
        {
            string name = request.Header.From.FromName;
            return new SIPParticipant(name, new SIPEndPoint(request.Header.From.FromURI));
        }

        private static SIPParticipant GetRemoteParticipant(SIPRequest request, SIPEndPoint signalingServer)
        {
            string name = request.Header.To.ToName;
            return new SIPParticipant(name, signalingServer);
        }

        private static ServerSideDialogParams GetParamsFromRequest(SIPRequest request, SIPEndPoint signalingServer)
        {
            return new ServerSideDialogParams(
                GetRemoteParticipant(request, signalingServer),
                GetCallerParticipant(request),
                remoteTag: CallProperties.CreateNewTag(),
                clientTag: request.Header.From.FromTag, // TODO: What if request does not contain a tag?
                callId: request.Header.CallId);
        } 
    }
}
