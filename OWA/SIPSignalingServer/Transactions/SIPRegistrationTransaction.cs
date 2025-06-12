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
using WebRTCLibrary.SIP.Interfaces;
using SIPSignalingServer.Transactions.Interfaces;

[assembly: InternalsVisibleTo("SignalingServerTests")]
namespace SIPSignalingServer.Transactions
{
    internal class SIPRegistrationTransaction : ServerSideSIPTransaction, ISIPRegistrationTransaction
    {
        private readonly ILoggerFactory loggerFactory;

        private readonly ILogger<SIPRegistrationTransaction> logger;

        private readonly object registrationLock = new object();

        public bool Registered { get; private set; }

        private bool Registering { get; set; }

        private ISIPRegistry Registry { get; set; }

        private SIPRequest InitialRequest { get; set; }

        private int CurrentCseq { get; set; }

        private int startCseq = 1;

        public int StartCseq
        {
            get => this.startCseq;
            set
            {
                if (this.Registering || this.Registered)
                {
                    throw new InvalidOperationException("StartCseq cannot be changed when a registraion is running or completed.");
                }

                this.startCseq = value;
            }
        }

        private SIPRegistration Registration { get; set; }

        private CancellationTokenSource registrationCts = new CancellationTokenSource();

        private CancellationToken RegistrationCt { get => this.registrationCts.Token; }

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

        // TODO: remove once base class is changed to take a cancellationtoken
        public async override Task Start()
        {
            await this.Start(CancellationToken.None);
        }

        public async override Task Start(CancellationToken? ct = null)
        {
            lock (this.registrationLock)
            {
                this.Reset();

                if (this.Registering)
                {
                    // already a registering process running
                    return;
                }

                if (this.Registry.IsRegistered(this.Registration))
                {
                    // already registered
                    return;
                }

                this.Registering = true;
                this.registrationCts = ct == null ? new CancellationTokenSource() : CancellationTokenSource.CreateLinkedTokenSource((CancellationToken)ct);
            }

            await this.Register();
        }

        private async Task Register()
        {
            if (this.InitialRequest.Header?.CSeq == null || this.InitialRequest.Header.CSeq != this.CurrentCseq)
            {
                this.CurrentCseq++;
                await this.RegistrationFailed(SIPResponseStatusCodesEnum.BadRequest, "Registration failed. Header was invalid.");
                return;
            }

            this.CurrentCseq++; // 2

            if (this.InitialRequest.Method != SIPMethodsEnum.REGISTER)
            {
                await this.RegistrationFailed(SIPResponseStatusCodesEnum.MethodNotAllowed, "Registration failed. Initial request was not a registration request.");
                return;
            }

            this.Connection.SIPRequestReceived += this.BYEListener;
            this.Connection.SIPRequestReceived += this.ACKListener;

            this.Registry.Register(this.Registration);

            // SendAcceptedResponse handles failed registration state. Stop registration in that case
            bool success = await this.SendAcceptedResponse();
            if (!success) return;

            await WaitForAsync(
                () => this.Registered,
                timeOut: this.ReceiveTimeout,
                this.RegistrationCt,
                // TODO: interval?
                timeoutCallback: async () => await this.RegistrationFailed(SIPResponseStatusCodesEnum.RequestTimeout, "Confirmation for registration timed out."),
                cancellationCallback: async () => await this.RegistrationFailed(SIPResponseStatusCodesEnum.RequestTerminated, "Registration was cancelled.")
                );

            // remove listener
            this.Connection.SIPRequestReceived -= this.ACKListener;
        }

        private SIPResponse GetRegisteredAcceptedResponse()
        {
            SIPHeaderParams headerParams = this.GetHeaderParams(cSeq: this.CurrentCseq);
            return SIPHelper.GetResponse(this.SIPScheme, SIPResponseStatusCodesEnum.Accepted, headerParams);
        }

        private async Task<bool> SendAcceptedResponse()
        {
            try
            {
                // send Accepted response
                SIPResponse accpetedResponse = this.GetRegisteredAcceptedResponse();
                
                // must be before sending response. A fast response happens before Cseq can be updated
                this.CurrentCseq++; // 3
                SocketError socketState = await this.Connection.SendSIPResponse(accpetedResponse, this.RegistrationCt);

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

            if (this.RegistrationCt.IsCancellationRequested)
            {
                await this.RegistrationFailed(SIPResponseStatusCodesEnum.RequestTerminated, "Confirmation failed. Registration was cancelled.");
                return;
            }

            lock (this.registrationLock)
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

            if (request.Header.CSeq != this.CurrentCseq)
            {
                // TODO: Header invalid. What to do here?
                return;
            }

            this.CurrentCseq++;
            await this.Unregister();
        }

        private async Task SendBYEMessage()
        {
            SocketError result = await this.Connection.SendSIPRequest(
                SIPMethodsEnum.BYE,
                this.GetHeaderParams(this.CurrentCseq),
                CancellationToken.None,
                this.SendTimeout);

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

        public async Task Unregister()
        {

            lock (registrationLock)
            {
                if (!this.Registered && !this.Registering)
                {
                    // not registered or a registering process running
                    return;
                }

                if (this.Registering)
                {
                    this.registrationCts.Cancel();
                    this.Registering = false;
                }

                this.RemoveFromRegistry();
            }

            await this.SendBYEMessage();

            this.Reset();
        }

        private void Reset()
        {
            this.CurrentCseq = this.StartCseq;
        }

        private void RemoveFromRegistry()
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
