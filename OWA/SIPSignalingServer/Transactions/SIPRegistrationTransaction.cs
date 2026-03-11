// <copyright file="SIPRegistrationTransaction.cs" company="Advokat GmbH">
// Copyright (c) Advokat GmbH. Alle Rechte vorbehalten.
// </copyright>

using System.Runtime.CompilerServices;

[assembly: InternalsVisibleTo("SignalingServerTests")]

namespace SIPSignalingServer.Transactions
{
    using System.Net.Sockets;
    using System.Text.Json;
    using Advokat.WebRTC.Library.SIP;
    using Advokat.WebRTC.Library.SIP.Interfaces;
    using Advokat.WebRTC.Library.SIP.Models;
    using Advokat.WebRTC.Library.SIP.Utils;
    using Microsoft.Extensions.Logging;
    using SIPSignalingServer.Interfaces;
    using SIPSignalingServer.Models;
    using SIPSignalingServer.Transactions.Interfaces;
    using SIPSignalingServer.Utils.CustomEventArgs;
    using SIPSorcery.SIP;

    internal class SIPRegistrationTransaction : ServerSideSIPTransaction, ISIPRegistrationTransaction
    {
        private readonly ILoggerFactory loggerFactory;

        private readonly ILogger<SIPRegistrationTransaction> logger;

        public event ISIPRegistrationTransaction.RegistrationFailedDelegate? OnRegistrationFailed;

        public new ISIPDialogConfig Config
        {
            get => (ISIPDialogConfig)base.Config;
            set => base.Config = value;
        }

        public bool Registered { get; private set; }

        private ISIPRegistry Registry { get; set; }

        private SIPRequest InitialRequest { get; set; }

        private SIPRegistration Registration { get; set; }

        private TaskCompletionSource RegistrationTask { get; set; }

        private CancellationTokenSource? TimeoutCts { get; set; }

        private CancellationTokenSource? ACKTimeoutCts { get; set; }

        public SIPRegistrationTransaction(
            ISIPConnection connection,
            SIPRequest initialRequest,
            SIPEndPoint signalingServer,
            ISIPRegistry registry,
            ILoggerFactory loggerFactory)
            : this(
                  connection,
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
            : base(
                  connection,
                  transactionsParams,
                  loggerFactory)
        {
            this.loggerFactory = loggerFactory;
            this.logger = this.loggerFactory.CreateLogger<SIPRegistrationTransaction>();

            this.InitialRequest = initialRequest;
            this.Registry = registry;
            this.Registration = new SIPRegistration(this.Params);

            this.Config = new SIPDialogConfig();

            this.RegistrationTask = new TaskCompletionSource();
            this.RegistrationTask.SetResult();
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
            if (!success)
            {
                return;
            }

            this.ACKTimeoutCts?.Cancel();
            this.ACKTimeoutCts?.Dispose();

            this.ACKTimeoutCts = new CancellationTokenSource(this.Config.ReceiveTimeout);
            this.ACKTimeoutCts.Token.Register(async () =>
                await this.CanceledAsync(SIPResponseStatusCodesEnum.RequestTimeout, "Confirmation for registration timed out."));

            await this.RegistrationTask.Task;
        }

        protected override void SetInitalParametes(CancellationToken? newCt)
        {
            base.SetInitalParametes(newCt);

            this.RegistrationTask = new TaskCompletionSource();
            this.Ct.Register(async () => await this.CanceledAsync(SIPResponseStatusCodesEnum.InternalServerError, "Registration cancelled."));

            this.TimeoutCts?.Cancel();
            this.TimeoutCts?.Dispose();

            this.TimeoutCts = new CancellationTokenSource(this.Config.RegistrationTimeout);
            this.TimeoutCts.Token.Register(async () => await this.CanceledAsync(SIPResponseStatusCodesEnum.RequestTimeout, "Registration timed out."));
        }

        private async Task CanceledAsync(SIPResponseStatusCodesEnum errorCode, string message)
        {
            if (this.Running && !this.Registered)
            {
                await this.RegistrationFailed(errorCode, message);
            }
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

                if (socketState != SocketError.Success)
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

        private SIPResponse GetRegisteredAcceptedResponse()
        {
            SIPHeaderParams headerParams = this.GetHeaderParams(cSeq: this.CurrentCseq);
            string body = JsonSerializer.Serialize(this.Config);
            string contentType = "text/json";

            return SIPHelper.GetResponse(this.SIPScheme, SIPResponseStatusCodesEnum.Accepted, headerParams, body, contentType);
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

            this.Connection.SIPRequestReceived -= this.ACKListener;

            // TODO: Registry should fire an event when registration was successful or return a bool
            this.Registry.Confirm(this.Registration);
            this.Registered = true;
            this.RegistrationTask.TrySetResult();
        }

        private async Task BYEListener(SIPEndPoint localEndPoint, SIPEndPoint remoteEndPoint, SIPRequest request)
        {
            if (request.Method != SIPMethodsEnum.BYE)
            {
                // not a BYE request
                return;
            }

            this.CurrentCseq = request.Header.CSeq + 1;
            await this.Stop();
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
            this.logger.LogInformation("Registration failed {statusCode}. {message}", statusCode, message);

            await this.Stop();

            FailedRegistrationEventArgs eventArgs = new FailedRegistrationEventArgs();
            eventArgs.StatusCode = statusCode;
            eventArgs.Message = message;
            eventArgs.Registration = this.Registration; // TODO: is this even needed?

            await (this.OnRegistrationFailed?.Invoke(this, eventArgs) ?? Task.CompletedTask);
        }

        protected override void StopRunning()
        {
            base.StopRunning();

            this.Connection.SIPRequestReceived -= this.BYEListener;
            this.Connection.SIPRequestReceived -= this.ACKListener;

            this.TimeoutCts?.Cancel();
            this.TimeoutCts?.Dispose();
            this.TimeoutCts = null;

            this.ACKTimeoutCts?.Cancel();
            this.ACKTimeoutCts?.Dispose();
            this.ACKTimeoutCts = null;

            this.Registry.Unregistered -= this.OnUnregistered;
            this.Registry.Unregister(this.Registration);
            this.Registered = false;

            // Sets it as cancelled if its not already completed - happens when Stop is called while not fully registered
            this.RegistrationTask.TrySetCanceled();
        }

        protected async override Task Finish()
        {
            await base.Finish();
            await this.SendBYEMessage();
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
