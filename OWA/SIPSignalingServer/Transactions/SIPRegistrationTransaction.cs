using SIPSorcery.SIP;
using SIPSignalingServer.Models;
using WebRTCLibrary.SIP.Models;
using WebRTCLibrary.SIP.Utils;
using SIPSignalingServer.Utils.CustomEventArgs;

using static WebRTCLibrary.Utils.TaskHelpers;
using Microsoft.Extensions.Logging;
using System.Net.Sockets;
using System.Runtime.CompilerServices;
using SIPSignalingServer.Interfaces;
using WebRTCLibrary.Interfaces;

[assembly: InternalsVisibleTo("SignalingServerTests")]
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

        private bool stoppedByClient;

        private ISIPRegistry Registry { get; set; }

        private SIPRequest InitialRequest { get; set; }

        private SIPRegistration Registration { get; set; }

        private CancellationTokenSource registrationCts = new CancellationTokenSource();

        private CancellationToken RegistrationCT { get => this.registrationCts.Token; }

        public event Action<SIPRegistrationTransaction, FailedRegistrationEventArgs>? OnRegistrationFailed;

        public SIPRegistrationTransaction(
            ISIPConnection connection,
            SIPRequest initialRequest,
            SIPEndPoint signalingServer,
            ISIPRegistry registry,
            ILoggerFactory loggerFactory)
            : this(connection,
                initialRequest,
                GetParamsFromRequest(initialRequest, signalingServer),
                registry,
                loggerFactory)
        {
        }

        public SIPRegistrationTransaction(
            ISIPConnection connection,
            SIPRequest initialRequest,
            ServerSideTransactionParams transactionsParams,
            ISIPRegistry registry,
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

        // TODO: remove once base class is changed to take a cancellationtoken
        public async override Task Start()
        {
            await this.Start(CancellationToken.None);
        }

        public async override Task Start(CancellationToken? ct = null)
        {
            if (this.InitialRequest.Method != SIPMethodsEnum.REGISTER)
            {
                // TODO: Check if token that gets cancelled could be a problem - old token
                await this.RegistrationFailed(2, SIPResponseStatusCodesEnum.MethodNotAllowed, "Registration failed. Initial request was not a registration request.");
                return;
            }

            // TODO: Set startCseq as request cseq + 1?

            //if (this.InitialRequest.Header.CSeq != 1)
            //{
            //    this.RegistrationFailed(SIPResponseStatusCodesEnum.BadRequest, "Registration failed. Header was invalid.");
            //    return;
            //}

            if (this.Registry.IsRegistered(this.Registration))
            {
                // already registered
                return;
            }
            
            this.registrationCts = ct == null ? new CancellationTokenSource() : CancellationTokenSource.CreateLinkedTokenSource((CancellationToken)ct);
            await this.Register();
        }

        public async override Task Stop()
        {
            if (!this.Registered)
            {
                // Not registered
                return;
            }

            this.Connection.SIPRequestReceived -= this.BYEListener;
            
            this.Unregister();
            await this.SendBYEMessage(4);
            // TODO: send event - registering stopped?
        }

        private async Task Register()
        {
            this.Connection.SIPRequestReceived += this.BYEListener;
            this.Connection.SIPRequestReceived += this.ACKListener;

            this.Registry.Register(this.Registration);

            bool success = await this.SendAcceptedResponse();
            if (!success) return;

            await WaitForAsync(
                () => this.Registry.IsConfirmed(this.Registration),
                //() => this.registrationConfirmed && this.Registry.IsConfirmed(this.Registration),
                timeOut: this.ReceiveTimeout,
                this.RegistrationCT,
                // TODO: interval?
                successCallback: async () => { this.Registered = true; },
                timeoutCallback: async () => await this.RegistrationFailed(3, SIPResponseStatusCodesEnum.RequestTimeout, "Confirmation for registration timed out."),
                cancellationCallback: async () => await this.RegistrationFailed(3, SIPResponseStatusCodesEnum.RequestTerminated, "Registration was cancelled.")
                );

            // remove listener
            this.Connection.SIPRequestReceived -= this.ACKListener;
        }

        private SIPResponse GetRegisteredAcceptedResponse()
        {
            SIPHeaderParams headerParams = this.GetHeaderParams(cSeq: 2);
            return SIPHelper.GetResponse(this.SIPScheme, SIPResponseStatusCodesEnum.Accepted, headerParams);
        }

        private async Task<bool> SendAcceptedResponse()
        {
            try
            {
                // send Accepted response
                SIPResponse accpetedResponse = this.GetRegisteredAcceptedResponse();
                SocketError socketState = await this.Connection.SendSIPResponse(accpetedResponse, this.RegistrationCT);

                if (SocketError.Success != socketState)
                {
                    // response did not get sent
                    await this.RegistrationFailed(2, SIPResponseStatusCodesEnum.InternalServerError, "Failed to send Accepted response.");
                    return false;
                }
            }
            catch (OperationCanceledException ex)
            {
                // response did not get sent
                await this.RegistrationFailed(2, SIPResponseStatusCodesEnum.RequestTerminated, "Accept not sent. Registration was cancelled.");
                return false;
            }

            return true;
        }

        private async Task ACKListener(SIPEndPoint localEndPoint, SIPEndPoint remoteEndPoint, SIPRequest request)
        {
            if (request.Method != SIPMethodsEnum.ACK)
            {
                // not an ACK request
                return;
            }

            if (request.Header.CSeq != 3)
            {
                await this.RegistrationFailed(4, SIPResponseStatusCodesEnum.BadRequest, "Confirmation failed. Header was invalid.");
                return;
            }

            if (this.RegistrationCT.IsCancellationRequested)
            {
                await this.RegistrationFailed(4, SIPResponseStatusCodesEnum.RequestTerminated, "Confirmation failed. Registration was cancelled.");
                return;
            }

            //this.registrationConfirmed = true;
            
            // TODO: Should fire event or return bool if confirmation was successful
            //       In the case that the client sent a bye in the meantime
            this.Registry.Confirm(this.Registration);
        }

        private async Task BYEListener(SIPEndPoint localEndPoint, SIPEndPoint remoteEndPoint, SIPRequest request)
        {
            if (request.Method != SIPMethodsEnum.BYE)
            {
                // not a BYE request
                return;
            }

            if (request.Header.CSeq != 2
                && request.Header.CSeq != 4)
            {
                // TODO: Header invalid. What to do here?
                return;
            }

            this.stoppedByClient = true;
            this.registrationCts.Cancel();
            await this.SendBYEMessage(request.Header.CSeq + 1);
        }

        private async Task SendBYEMessage(int cSeq)
        {
            SocketError result = await this.Connection.SendSIPRequest(
                SIPMethodsEnum.BYE,
                this.GetHeaderParams(cSeq),
                CancellationToken.None,
                this.SendTimeout);

            if (result != SocketError.Success)
            {
                // request was not sent.
                // TODO: What to do here? Retry?
            }
        }

        private async Task RegistrationFailed(int cSeq, SIPResponseStatusCodesEnum statusCode = SIPResponseStatusCodesEnum.None, string? message = null)
        {
            this.Connection.SIPRequestReceived -= this.BYEListener;
            this.Connection.SIPRequestReceived -= this.ACKListener;

            this.logger.LogInformation("Registration failed {statusCode}. {message}", statusCode, message);

            this.Unregister();

            if (!this.stoppedByClient)
            {
                await this.SendBYEMessage(cSeq);
            }

            FailedRegistrationEventArgs eventArgs = new FailedRegistrationEventArgs();
            eventArgs.StatusCode = statusCode;
            eventArgs.Message = message;
            eventArgs.Registration = this.Registration; // TODO: is this even needed?

            this.OnRegistrationFailed?.Invoke(this, eventArgs);
        }

        private void Unregister()
        {
            this.Registry.Unregister(this.Registration);
            this.Registered = false;
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
