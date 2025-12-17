using static Advokat.WebRTC.Library.Utils.TaskHelpers;
using SIPSorcery.SIP;
using SIPSignalingServer.Models;
using SIPSignalingServer.Utils.CustomEventArgs;
using Microsoft.Extensions.Logging;
using System.Net.Sockets;
using System.Runtime.CompilerServices;
using SIPSignalingServer.Interfaces;
using SIPSignalingServer.Transactions.Interfaces;
using System.Text.Json;
using Advokat.WebRTC.Library.SIP.Interfaces;
using Advokat.WebRTC.Library.SIP.Models;
using Advokat.WebRTC.Library.SIP.Utils;

[assembly: InternalsVisibleTo("SignalingServerTests")]
namespace SIPSignalingServer.Transactions
{
    internal class SIPRegistrationTransaction : ServerSideSIPTransaction, ISIPRegistrationTransaction
    {
        private readonly ILoggerFactory loggerFactory;

        private readonly ILogger<SIPRegistrationTransaction> logger;

        public override bool Running
        {
            get => this.Registering || this.Registered;
            protected set => this.Registering = value;
        }

        public new ISIPDialogConfig Config
        {
            get => (ISIPDialogConfig)base.Config;
            set => base.Config = value;
        }

        public bool Registered { get; private set; }

        private bool Registering { get; set; }

        private ISIPRegistry Registry { get; set; }

        private SIPRequest InitialRequest { get; set; }
        
        private SIPRegistration Registration { get; set; }

        public event ISIPRegistrationTransaction.RegistrationFailedDelegate? OnRegistrationFailed;

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

        protected async override Task StartRunning()
        {
            await base.StartRunning();
            await this.Register();
        }

        private async Task Register()
        {

            if (this.Ct.IsCancellationRequested)
            {
                await this.RegistrationFailed(SIPResponseStatusCodesEnum.RequestTerminated, "Registration was cancelled.");
                return;
            }

            if (this.InitialRequest.Header?.CSeq == null || this.InitialRequest.Header.CSeq != this.CurrentCseq)
            {
                this.CurrentCseq++;
                await this.RegistrationFailed(SIPResponseStatusCodesEnum.BadRequest, "Header was invalid.");
                return;
            }

            this.CurrentCseq++; // 2

            if (this.InitialRequest.Method != SIPMethodsEnum.REGISTER)
            {
                await this.RegistrationFailed(SIPResponseStatusCodesEnum.MethodNotAllowed, "Initial request was not a registration request.");
                return;
            }

            this.Connection.SIPRequestReceived += this.BYEListener;
            this.Connection.SIPRequestReceived += this.ACKListener;

            this.Registry.Register(this.Registration);
            this.Registry.Unregistered += this.OnUnregistered;

            // SendAcceptedResponse handles failed registration state. Stop registration in that case
            bool success = await this.SendAcceptedResponse();
            if (!success) return;

            await WaitForAsync(
                () => this.Registered,
                timeOut: this.Config.ReceiveTimeout,
                this.Ct,
                // TODO: interval?
                timeoutCallback: async () => await this.RegistrationFailed(SIPResponseStatusCodesEnum.RequestTimeout, "Confirmation for registration timed out."),
                cancellationCallback: async () => await this.RegistrationFailed(SIPResponseStatusCodesEnum.RequestTerminated, "Registration was cancelled."));

            // remove listener
            this.Connection.SIPRequestReceived -= this.ACKListener;
        }

        private SIPResponse GetRegisteredAcceptedResponse()
        {
            SIPHeaderParams headerParams = this.GetHeaderParams(cSeq: this.CurrentCseq);
            string body = JsonSerializer.Serialize(this.Config);
            string contentType = "text/json";

            return SIPHelper.GetResponse(this.SIPScheme, SIPResponseStatusCodesEnum.Accepted, headerParams, body, contentType);
        }

        private async Task<bool> SendAcceptedResponse()
        {
            SIPResponse accpetedResponse = this.GetRegisteredAcceptedResponse();
                
            // must be before sending response. A fast response happens before Cseq can be updated
            this.CurrentCseq++; // 3

            try
            {
                // send Accepted response
                SocketError socketState = await this.Connection.SendSIPResponse(accpetedResponse, this.Ct);

                if (SocketError.Success != socketState)
                {
                    // response did not get sent
                    this.CurrentCseq--; // 2 - accept did not get sent. Revert current cseq.
                    await this.RegistrationFailed(SIPResponseStatusCodesEnum.InternalServerError, "Failed to send Accepted response.");
                    return false;
                }
            }
            catch (OperationCanceledException ex)
            {
                // response did not get sent
                // this.CurrentCseq--; // 2 - accept did not get sent. Revert current cseq.
                await this.RegistrationFailed(SIPResponseStatusCodesEnum.RequestTerminated, "Accept not sent. Registration was cancelled.");
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

            if (request.Header.CSeq != this.CurrentCseq)
            {
                this.CurrentCseq++; // 4
                await this.RegistrationFailed(SIPResponseStatusCodesEnum.BadRequest, "Confirmation failed. Header was invalid.");
                return;
            }

            this.CurrentCseq++; // 4

            if (this.Ct.IsCancellationRequested)
            {
                await this.RegistrationFailed(SIPResponseStatusCodesEnum.RequestTerminated, "Confirmation failed. Registration was cancelled.");
                return;
            }

            lock (this.isRunningLock)
            {
                // TODO: Registry should fire an event when registration was successful or return a bool
                this.Registry.Confirm(this.Registration);
                this.Registered = true;
                this.Registering = false;
            }
        }

        private async Task BYEListener(SIPEndPoint localEndPoint, SIPEndPoint remoteEndPoint, SIPRequest request)
        {
            if (request.Method != SIPMethodsEnum.BYE)
            {
                // not a BYE request
                return;
            }

            this.CurrentCseq = request.Header.CSeq + 1;
            await this.Unregister();
        }

        private async Task SendBYEMessage()
        {
            SIPHeaderParams header = this.GetHeaderParams(this.CurrentCseq);
            header.Reason = "REGISTRATION";

            SocketError result = await this.Connection.SendSIPRequest(
                SIPMethodsEnum.BYE,
                header,
                CancellationToken.None);

            if (result != SocketError.Success)
            {
                // request was not sent.
                // TODO: What to do here? Retry?
            }
        }

        private async Task RegistrationFailed(SIPResponseStatusCodesEnum statusCode = SIPResponseStatusCodesEnum.None, string? message = null)
        {
            this.Connection.SIPRequestReceived -= this.BYEListener;
            this.Connection.SIPRequestReceived -= this.ACKListener;

            this.logger.LogInformation("Registration failed {statusCode}. {message}", statusCode, message);

            await this.Unregister();

            FailedRegistrationEventArgs eventArgs = new FailedRegistrationEventArgs();
            eventArgs.StatusCode = statusCode;
            eventArgs.Message = message;
            eventArgs.Registration = this.Registration; // TODO: is this even needed?

            await (this.OnRegistrationFailed?.Invoke(this, eventArgs) ?? Task.CompletedTask);
        }

        protected override void StopRunning()
        {
            base.StopRunning();

            this.Registry.Unregistered -= this.OnUnregistered;
            this.Registry.Unregister(this.Registration);
            this.Registered = false;
        }

        protected async override Task Finish()
        {
            await base.Finish();
            await this.SendBYEMessage();
        }

        public async Task Unregister()
        {
            await this.Stop();
        }

        private async void OnUnregistered(object? sender, RegistrationEventArgs e)
        {
            if (e.Registration == this.Registration)
            {
                await this.Stop();
            }
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
