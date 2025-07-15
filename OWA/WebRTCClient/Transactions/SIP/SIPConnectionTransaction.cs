using Microsoft.Extensions.Logging;
using SIPSorcery.SIP;
using System.Diagnostics.CodeAnalysis;
using System.Net.Sockets;
using WebRTCClient.Transactions.SIP.Interfaces;
using WebRTCLibrary.SIP.Interfaces;
using WebRTCLibrary.SIP.Models;
using static WebRTCLibrary.Utils.TaskHelpers;

namespace WebRTCClient.Transactions.SIP
{
    internal class SIPConnectionTransaction : WebRTCLibrary.SIP.SIPTransaction, ISIPConnectionTransaction
    {
        private readonly ILoggerFactory loggerFactory;

        private readonly ILogger<SIPConnectionTransaction> logger;

        public event ISIPMessager.RequestReceivedDelegate? OnRequestReceived;
        
        public event ISIPMessager.ResponseReceivedDelegate? OnResponseReceived;

        private SIPMessaging? MessagingDialog { get; set; }

        [MemberNotNullWhen(true, nameof(MessagingDialog))]
        public bool Connected { get => MessagingDialog?.Running ?? false && PeerListeningConfirmation; }

        private bool PeerListeningConfirmation { get; set; }

        public SIPConnectionTransaction(SIPSchemesEnum sipScheme, ISIPTransport transport, TransactionParams dialogParams, ILoggerFactory loggerFactory)
            : base(sipScheme, transport, dialogParams, loggerFactory)
        {
            this.loggerFactory = loggerFactory;
            this.logger = this.loggerFactory.CreateLogger<SIPConnectionTransaction>();
        }

        protected async override Task StartRunning()
        {
            await base.StartRunning();
            await this.StartSIPMessager();
        }

        private async Task StartSIPMessager()
        {
            this.MessagingDialog = new SIPMessaging(this.Connection, this.Params, this.loggerFactory);

            this.MessagingDialog.OnRequestReceived += this.RequestRecieved;
            this.MessagingDialog.OnResponseReceived += this.ResponseRecieved;
            await this.MessagingDialog.Start();

            this.logger.LogDebug(
              "Now listening for SIP messages. caller:\"{caller}\" tag:\"{fromTag}\" -  remote:\"{remote}\" tag:\"{toTag}\"",
              this.Params.SourceParticipant.Name,
              this.Params.SourceTag,

              this.Params.RemoteParticipant.Name,
              this.Params.RemoteTag);

            bool success = await this.SendAck();
            if (!success)
            {
                // TODO: cancellcationlogic
                return;
            }

            await WaitFor(
                () => this.PeerListeningConfirmation,
                this.ReceiveTimeout,
                ct: CancellationToken.None, // TODO: implement cancellation logic
                timeoutCallback: () => { } // TODO: fail connection
                );

            this.Connection.SIPRequestReceived -= this.ConnectionNotifyListener;
            //this.Connecting = false;
        }

        private async Task<bool> SendAck()
        {
            SocketError result;
            
            int ackCseq = this.CurrentCseq;
            
            // increment now in case of fast response
            this.CurrentCseq++;
            try
            {
                result = await this.Connection.SendSIPRequest(SIPMethodsEnum.ACK, this.GetHeaderParams(ackCseq), this.Ct);
            }
            catch (OperationCanceledException ex)
            {
                // ACK not sent
                this.CurrentCseq--;


                // TODO: send bye?
                return false;
            }

            if (result != SocketError.Success)
            {
                // ACK not sent
                this.CurrentCseq--;

                // TODO: send bye?
                return false;
            }

            return true;
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

            if (sipRequest.Header.CSeq != this.CurrentCseq)
            {
                // invalid header
                return;
            }
            this.CurrentCseq++;

            this.PeerListeningConfirmation = true;
        }

        protected async override Task Finish()
        {
            await base.Finish();
            await Disconnect();
        }

        private async Task Disconnect()
        {
            if (!this.Connected)
            {
                // not connected.
                return;
            }

            //if (this.Connecting)
            //{
            //    // TODO: Cancel token
            //}

            
            // TODO: Get real CSeq
            await this.SendBYEMessage();
        }

        // TODO: Remove ct as parameter and use Cancellationtoken None?
        private async Task SendBYEMessage()
        {
            SIPHeaderParams headerParams = this.GetHeaderParams();

            SocketError result = await this.Connection.SendSIPRequest(
                SIPMethodsEnum.BYE,
                headerParams,
                CancellationToken.None);

            if (result != SocketError.Success)
            {
                // TODO: Do something. BYE message could not be sent. Retry?
            }
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
