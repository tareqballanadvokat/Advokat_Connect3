using Microsoft.Extensions.Logging;
using SIPSorcery.SIP;
using System.Diagnostics.CodeAnalysis;
using System.Net.Sockets;
using WebRTCLibrary.Interfaces;
using WebRTCLibrary.SIP;
using WebRTCLibrary.SIP.Models;

using static WebRTCLibrary.Utils.TaskHelpers;

namespace WebRTCClient.Transactions.SIP
{
    internal class SIPDialog : WebRTCLibrary.SIP.SIPTransaction, ISIPMessager
    {
        private readonly ILoggerFactory loggerFactory;

        private readonly ILogger<SIPDialog> logger;

        public event ISIPMessager.RequestReceivedDelegate? OnRequestReceived;

        public event ISIPMessager.ResponseReceivedDelegate? OnResponseReceived;

        public bool Registered { get => SIPRegistrationTransaction.Registered; }

        [MemberNotNullWhen(true, nameof(SIPConnectionTransaction))]
        public bool Connected { get => SIPConnectionTransaction?.Connected ?? false; }

        private SIPRegistrationTransaction SIPRegistrationTransaction { get; set; }

        private SIPConnectionTransaction? SIPConnectionTransaction { get; set; }

        private SIPKeepAlive SIPKeepAlive { get; set; }

        private ISIPTransport Transport { get; set; }

        public SIPDialog(SIPSchemesEnum sipScheme, ISIPTransport transport, SIPParticipant sourceParticipant, SIPParticipant remoteParticipant, ILoggerFactory loggerFactory)
            : base(
                  sipScheme,
                  transport,
                  new TransactionParams(sourceParticipant, remoteParticipant, callId:CallProperties.CreateNewCallId()),
                  loggerFactory)
        {
            this.loggerFactory = loggerFactory;
            this.logger = this.loggerFactory.CreateLogger<SIPDialog>();

            this.Transport = transport;

            this.SIPRegistrationTransaction = new SIPRegistrationTransaction(this.Connection, this.Params, this.loggerFactory);
            this.SIPKeepAlive = new SIPKeepAlive(this.Connection, this.Params, this.loggerFactory);

            this.SIPRegistrationTransaction.SendTimeout = this.SendTimeout;
            this.SIPRegistrationTransaction.ReceiveTimeout = this.ReceiveTimeout;
        }

        public override async Task Start()
        {
            await this.SIPRegistrationTransaction.Start();

            await WaitForAsync(
                () => this.Registered,
                this.ReceiveTimeout, // TODO: Find suitable timeout for registration process
                ct: CancellationToken.None, // TODO: implement cancellation logic
                successCallback: this.RegistationSuccessful,
                timeoutCallback: async () => { }); // TODO: what to do on registering failure / timeout
        }

        public override async Task Stop()
        {
            // TODO: assign new callId? Otherwise we could get another start with the same call id
            //throw new NotImplementedException();
            
            await this.SIPRegistrationTransaction.Stop();
        }

        private async Task RegistationSuccessful()
        {
            TransactionParams dialogParams = new TransactionParams(
                this.Params.SourceParticipant,
                this.Params.RemoteParticipant,
                sourceTag: this.Params.SourceTag);

            this.SIPConnectionTransaction = new SIPConnectionTransaction(SIPScheme, this.Transport, dialogParams, this.loggerFactory);

            this.SIPConnectionTransaction.OnRequestReceived += RequestRecieved;
            this.SIPConnectionTransaction.OnResponseReceived += ResponseRecieved;

            await this.SIPConnectionTransaction.Start();
            await this.SIPKeepAlive.Start(); // TODO: stop dialog on stop / unregister
                                        //       Also, should keep alive send pings starting from peer or from server
                                        //       Is not needed if there is no timeout for our signaling server

            await WaitFor(
                () => this.Connected,
                this.ReceiveTimeout, // TODO: Get suitable timeout for connection - keep in mind to wait for remote to register. have a timeout at all?
                ct: CancellationToken.None, // TODO: implement cancellation logic
                successCallback: () =>
                {
                    this.logger.LogInformation("SIP Connection established. {caller} - {remote}",
                        this.Params.SourceParticipant.Name,
                        this.Params.RemoteParticipant.Name);
                }
                // TODO: failed?
                );
        }

        public async Task<SocketError> SendSIPRequest(SIPMethodsEnum method, string message, string contentType, int cSeq)
        {
            if (!this.Connected)
            {
                return SocketError.NotConnected;
            }

            return await this.SIPConnectionTransaction.SendSIPRequest(method, message, contentType, cSeq);
        }

        public async Task<SocketError> SendSIPResponse(SIPResponseStatusCodesEnum statusCode, string message, string contentType, int cSeq)
        {
            if (!this.Connected)
            {
                return SocketError.NotConnected;
            }

            return await this.SIPConnectionTransaction.SendSIPResponse(statusCode, message, contentType, cSeq);
        }

        private async Task RequestRecieved(ISIPMessager sender, SIPRequest sipRequest)
        {
            await (this.OnRequestReceived?.Invoke(this, sipRequest) ?? Task.CompletedTask);
        }

        private async Task ResponseRecieved(ISIPMessager sender, SIPResponse sipResponse)
        {
            await (this.OnResponseReceived?.Invoke(this, sipResponse) ?? Task.CompletedTask);
        }
    }
}
