using Advokat.WebRTC.Library.SIP.Interfaces;
using Advokat.WebRTC.Library.SIP.Models;
using Microsoft.Extensions.Logging;
using SIPSignalingServer.Models;
using SIPSignalingServer.Utils.CustomEventArgs;
using SIPSorcery.SIP;
using System.Net.Sockets;

namespace SIPSignalingServer.Transactions
{
    public class SIPMessageRelay : ServerSideSIPTransaction
    {
        private readonly ILogger<SIPMessageRelay> logger;

        public bool Relaying => this.Running;

        public SIPMessageRelay(ISIPConnection connection, ServerSideTransactionParams transactionParams, ILoggerFactory loggerFactory)
            : base(connection, transactionParams, loggerFactory)
        {
            this.logger = loggerFactory.CreateLogger<SIPMessageRelay>();
        }

        public event EventHandler<SIPRequestEventArgs>? OnRequestReceived;

        public event EventHandler<SIPResponseEventArgs>? OnResponseReceived;

        public event EventHandler? RelayStopped;
        
        public event EventHandler? RelayStarted;

        public async void RelayRequest(object? sender, SIPRequestEventArgs e)
        {
            if (!this.Relaying)
            {
                return;
            }

            if (this.Ct.IsCancellationRequested)
            {
                await this.Stop();
            }

            SIPHeaderParams headerParams = this.GetHeaderParams(e.Request.Header.CSeq);
                
            this.logger.LogDebug(
                "<> Relaying {method} {cSeq} - from: '{from}', to:\"{to}\" toTag:\"{toTag}\".",
                e.Request.Method,
                headerParams.CSeq,
                e.Request.Header.From,
                headerParams.DestinationParticipant,
                headerParams.ToTag);

            // TODO: maybe check if request matches transactionParams?
            // TODO: catch Cancellation
            SocketError sendingStatus = await this.Connection.SendSIPRequest(
                e.Request.Method,
                headerParams,
                e.Request.Body,
                e.Request.Header.ContentType,
                this.Ct);

            if (sendingStatus != SocketError.Success)
            {
                // TODO: do something here. Relay failed
                //       Maybe send message to sending client
            }
        }

        public async void RelayResponse(object? sender, SIPResponseEventArgs e)
        {
            if (!this.Relaying)
            {
                return;
            }

            if (this.Ct.IsCancellationRequested)
            {
                await this.Stop();
            }

            SIPHeaderParams headerParams = this.GetHeaderParams(e.Response.Header.CSeq);

            this.logger.LogDebug(
                "<> Relaying {statusCode} {cSeq} - from: '{from}', to:\"{to}\" toTag:\"{toTag}\".",
                e.Response.StatusCode,
                headerParams.CSeq,
                e.Response.Header.From,
                headerParams.DestinationParticipant,
                headerParams.ToTag);

            // TODO: maybe check if request matches transactionParams?
            // TODO: catch Cancellation
            SocketError sendingStatus = await this.Connection.SendSIPResponse(
                    e.Response.Status,
                    headerParams,
                    e.Response.Body,
                    e.Response.Header.ContentType,
                    this.Ct);

            if (sendingStatus != SocketError.Success)
            {
                // TODO: do something here. Relay failed.
                //       Maybe send message to sending client
            }
        }

        private async Task ReceiveMessage(SIPEndPoint _, SIPEndPoint __, SIPRequest request)
        {
            if (!this.Relaying)
            {
                return;
            }

            if (this.Ct.IsCancellationRequested)
            {
                await this.Stop();
            }

            this.OnRequestReceived?.Invoke(this, new SIPRequestEventArgs(request));
        }

        private async Task ReceiveMessage(SIPEndPoint _, SIPEndPoint __, SIPResponse response)
        {
            if (!this.Relaying)
            {
                return;
            }

            if (this.Ct.IsCancellationRequested)
            {
                await this.Stop();
            }

            this.OnResponseReceived?.Invoke(this, new SIPResponseEventArgs(response));   
        }

        protected async override Task StartRunning()
        {
            await base.StartRunning();
            this.Connection.SIPRequestReceived += this.ReceiveMessage;
            this.Connection.SIPResponseReceived += this.ReceiveMessage;

            this.RelayStarted?.Invoke(this, EventArgs.Empty);
        }

        protected override void SetInitalParametes(CancellationToken? newCt)
        {
            base.SetInitalParametes(newCt);
            this.Ct.Register(async () => await this.Stop());
        }

        protected async override Task Finish()
        {
            await base.Finish();
            this.Connection.SIPRequestReceived -= this.ReceiveMessage;
            this.Connection.SIPResponseReceived -= this.ReceiveMessage;

            this.RelayStopped?.Invoke(this, EventArgs.Empty);
        }
    }
}
