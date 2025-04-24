using Microsoft.Extensions.Logging;
using SIPSorcery.SIP;
using System.Diagnostics.CodeAnalysis;
using System.Net.Sockets;
using WebRTCLibrary.SIP;
using WebRTCLibrary.SIP.Models;
using static WebRTCLibrary.Utils.TaskHelpers;

namespace WebRTCClient.Transactions.SIP
{
    internal class SIPConnectionTransaction : WebRTCLibrary.SIP.SIPTransaction, ISIPMessager
    {
        private readonly ILoggerFactory loggerFactory;

        private readonly ILogger<SIPConnectionTransaction> logger;

        public event ISIPMessager.RequestReceivedDelegate? OnRequestReceived;
        
        public event ISIPMessager.ResponseReceivedDelegate? OnResponseReceived;

        private SIPMessaging? MessagingDialog { get; set; }

        [MemberNotNullWhen(true, nameof(MessagingDialog))]
        public bool Connected { get => MessagingDialog?.Running ?? false && PeerListeningConfirmation; }

        private bool PeerListeningConfirmation { get; set; }

        private bool Connecting { get; set; }

        public SIPConnectionTransaction(SIPSchemesEnum sipScheme, SIPTransport transport, TransactionParams dialogParams, ILoggerFactory loggerFactory)
            : base(sipScheme, transport, dialogParams, loggerFactory)
        {
            this.loggerFactory = loggerFactory;
            this.logger = this.loggerFactory.CreateLogger<SIPConnectionTransaction>();
        }

        public async override Task Start()
        {
            if (this.Connected) // TODO: messagingDialogRunning
            {
                // already connected
                return;
            }

            if (this.Connecting)
            {
                // another connection is already running
                return;
            }

            this.Connecting = true;
            this.Connection.SIPRequestReceived += this.InitialNotifyListener;
        }

        // TODO: This method does too much
        private async Task InitialNotifyListener(SIPEndPoint localEndpoint, SIPEndPoint remoteEndPoint, SIPRequest sipRequest)
        {
            if (sipRequest.Method != SIPMethodsEnum.NOTIFY)
            {
                // TODO: Check if it is a ping - ignore if it is
                //       If is is something else we should fail i think
                //       
                //       Should not be a problem now - ping is with different tag and callID
                return;
            }

            if (sipRequest.Header.CSeq != 4
                || sipRequest.Header.From.FromTag == null
                || sipRequest.Header.CallId == null) // TODO: nullOrEmpty?
            {
                // invalid header
                return;
            }

            this.Connection.SIPRequestReceived -= this.InitialNotifyListener;
            this.Connection.SIPRequestReceived += this.ConnectionNotifyListener;

            this.Params.RemoteTag = sipRequest.Header.From.FromTag;
            this.Params.CallId = sipRequest.Header.CallId;

            this.logger.LogDebug(
                "Now listening for SIP messages. caller:\"{caller}\" tag:\"{fromTag}\" -  remote:\"{remote}\" tag:\"{toTag}\"",
                this.Params.SourceParticipant.Name,
                this.Params.SourceTag,

                this.Params.RemoteParticipant.Name,
                this.Params.RemoteTag);

            this.MessagingDialog = new SIPMessaging(this.Connection, this.Params, this.loggerFactory);

            this.MessagingDialog.OnRequestReceived += this.RequestRecieved;
            this.MessagingDialog.OnResponseReceived += this.ResponseRecieved;
            await this.MessagingDialog.Start();

            // TODO: Implement cancellation logic. Where to save tokensource? Which requests should use the same token?
            using CancellationTokenSource cts = new CancellationTokenSource();

            await this.Connection.SendSIPRequest(SIPMethodsEnum.ACK, this.GetHeaderParams(cSeq: 5), cts.Token);

            await WaitFor(
                () => this.PeerListeningConfirmation,
                this.ReceiveTimeout,
                failureCallback: () => { } // TODO: fail connection
                );

            this.Connection.SIPRequestReceived -= this.ConnectionNotifyListener;
            this.Connecting = false;
        }

        // TODO: Move this listener to messaging dialog. Only allow sending once this is has been received.
        private async Task ConnectionNotifyListener(SIPEndPoint localEndpoint, SIPEndPoint remoteEndPoint, SIPRequest sipRequest)
        {
            if (sipRequest.Method != SIPMethodsEnum.NOTIFY)
            {
                // TODO: Check if it is a ping - ignore if it is
                //       If is is something else we should fail i think
                //       
                //       Should not be a problem now - ping is with different tag and callID
                return;
            }

            if (sipRequest.Header.CSeq != 6)
            {
                // invalid header
                return;
            }

            this.PeerListeningConfirmation = true;
        }

        public async override Task Stop()
        {
            // TODO: Rework completely

            if (!this.Connected)
            {
                // not connected.
                return;
            }

            this.Params.RemoteTag = null;
            this.Params.CallId = null;

            if (this.Connecting)
            {
                this.Connection.SIPRequestReceived -= this.InitialNotifyListener;

                // TODO: what to do here? send disconnect message?
                return;
            }

            //this.Connected = false;
            // TODO: send a message for disconnect?
        }

        public async Task<SocketError> SendSIPRequest(SIPMethodsEnum method, string message, string contentType, int cSeq)
        {
            if (!this.Connected)
            {
                return SocketError.NotConnected;
            }

            return await this.MessagingDialog.SendSIPRequest(method, message, contentType, cSeq);
        }

        public async Task<SocketError> SendSIPResponse(SIPResponseStatusCodesEnum statusCode, string message, string contentType, int cSeq)
        {
            if (!this.Connected)
            {
                return SocketError.NotConnected;
            }

            return await this.MessagingDialog.SendSIPResponse(statusCode, message, contentType, cSeq);
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
