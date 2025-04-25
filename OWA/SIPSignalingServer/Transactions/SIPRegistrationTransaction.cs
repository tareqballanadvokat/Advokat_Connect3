using SIPSorcery.SIP;
using SIPSignalingServer.Models;
using WebRTCLibrary.SIP.Models;
using WebRTCLibrary.SIP.Utils;
using SIPSignalingServer.Utils.CustomEventArgs;

using static WebRTCLibrary.Utils.TaskHelpers;
using Microsoft.Extensions.Logging;
using WebRTCLibrary.SIP;

namespace SIPSignalingServer.Transactions
{
    internal class SIPRegistrationTransaction : ServerSideSIPTransaction
    {
        private readonly ILoggerFactory loggerFactory;

        private readonly ILogger<SIPRegistrationTransaction> logger;

        // TODO: Check if this can be out of sync.
        // Flag to reduce the times registry IsConfirmed is called.
        //private bool registrationConfirmed;

        public bool Registered { get; private set; }

        private SIPRegistry Registry { get; set; }

        private SIPRequest InitialRequest { get; set; }

        private SIPRegistration Registration { get; set; }

        public event Action<SIPRegistrationTransaction, FailedRegistrationEventArgs>? OnRegistrationFailed;

        public SIPRegistrationTransaction(
            SIPConnection connection,
            SIPRequest initialRequest,
            SIPEndPoint signalingServer,
            SIPRegistry registry,
            ILoggerFactory loggerFactory)
            : this(connection,
                initialRequest,
                GetParamsFromRequest(initialRequest, signalingServer),
                registry,
                loggerFactory)
        {
        }

        public SIPRegistrationTransaction(
            SIPConnection connection,
            SIPRequest initialRequest,
            ServerSideTransactionParams transactionsParams,
            SIPRegistry registry,
            ILoggerFactory loggerFactory)
            : base(connection,
                 transactionsParams,
                 loggerFactory)
        {
            this.loggerFactory = loggerFactory;
            this.logger = this.loggerFactory.CreateLogger<SIPRegistrationTransaction>();

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
            
            //this.registrationConfirmed = false;
            this.Registered = false;
            // TODO: send event - registering stopped
        }

        private async Task StartRegistartion()
        {
            if (this.InitialRequest.Method != SIPMethodsEnum.REGISTER)
            {
                this.RegistrationFailed(SIPResponseStatusCodesEnum.MethodNotAllowed, "Registration failed. Was not a registration request.");
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
            SIPResponse accpetedResponse = this.GetRegisteredAcceptedResponse();

            // TODO: Implement cancellation logic. Where to save tokensource? Which requests should use the same token?
            using CancellationTokenSource cts = new CancellationTokenSource();

            await this.Connection.SendSIPResponse(accpetedResponse, cts.Token);

            await WaitFor(
                () => this.Registry.IsConfirmed(this.Registration),
                //() => this.registrationConfirmed && this.Registry.IsConfirmed(this.Registration),
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

            //this.registrationConfirmed = true;
            this.Registry.Confirm(this.Registration);
        }

        private void RegistrationFailed(SIPResponseStatusCodesEnum statusCode = SIPResponseStatusCodesEnum.None, string? message = null)
        {
            this.logger.LogInformation("Registration failed {statusCode}. {message}", statusCode, message);

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
            return new SIPParticipant(name, request.RemoteSIPEndPoint);
        }

        private static SIPParticipant GetRemoteParticipant(SIPRequest request, SIPEndPoint signalingServer)
        {
            string name = request.Header.To.ToName;
            return new SIPParticipant(name, signalingServer);
        }

        private static ServerSideTransactionParams GetParamsFromRequest(SIPRequest request, SIPEndPoint signalingServer)
        {
            return new ServerSideTransactionParams(
                GetRemoteParticipant(request, signalingServer),
                GetCallerParticipant(request),
                remoteTag: CallProperties.CreateNewTag(),
                clientTag: request.Header.From.FromTag, // TODO: What if request does not contain a tag?
                callId: request.Header.CallId);
        } 
    }
}
