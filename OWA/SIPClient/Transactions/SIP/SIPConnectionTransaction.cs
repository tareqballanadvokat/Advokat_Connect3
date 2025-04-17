using SIPSorcery.SIP;
using System.Diagnostics;
using System.Diagnostics.CodeAnalysis;
using System.Net.Sockets;
using WebRTCLibrary.SIP;
using WebRTCLibrary.SIP.Models;
using static WebRTCLibrary.Utils.TaskHelpers;

namespace WebRTCClient.Transactions.SIP
{
    internal class SIPConnectionTransaction : WebRTCLibrary.SIP.SIPTransaction, ISIPMessager
    {
        public event ISIPMessager.RequestReceivedDelegate? OnRequestReceived;
        
        public event ISIPMessager.ResponseReceivedDelegate? OnResponseReceived;



        private SIPMessaging? MessagingDialog { get; set; }

        [MemberNotNullWhen(true, nameof(MessagingDialog))]
        public bool Connected { get => MessagingDialog?.Running ?? false && PeerListeningConfirmation; }

        private bool PeerListeningConfirmation { get; set; }

        private bool Connecting { get; set; }

        public SIPConnectionTransaction(SIPSchemesEnum sipScheme, SIPTransport transport, TransactionParams dialogParams)
            : base(sipScheme, transport, dialogParams)
        {
        }

        public async override Task Start()
        {
            if (Connected) // TODO: messagingDialogRunning
            {
                // already connected
                return;
            }

            if (Connecting)
            {
                // another connection is already running
                return;
            }

            Connecting = true;
            Connection.SIPRequestReceived += InitialNotifyListener;
        }

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

            Connection.SIPRequestReceived -= InitialNotifyListener;
            Connection.SIPRequestReceived += ConnectionNotifyListener;

            Params.RemoteTag = sipRequest.Header.From.FromTag;
            Params.CallId = sipRequest.Header.CallId;

            MessagingDialog = new SIPMessaging(SIPScheme, Connection.Transport, Params);

            MessagingDialog.OnRequestReceived += RequestRecieved;
            MessagingDialog.OnResponseReceived += ResponseRecieved;
            await MessagingDialog.Start();

            // TODO: Implement cancellation logic. Where to save tokensource? Which requests should use the same token?
            using CancellationTokenSource cts = new CancellationTokenSource();

            Debug.WriteLine($"Client sending ACK."); // DEBUG
            await Connection.SendSIPRequest(SIPMethodsEnum.ACK, GetHeaderParams(cSeq: 5), cts.Token);

            await WaitFor(
                () => PeerListeningConfirmation,
                ReceiveTimeout,
                failureCallback: () => { } // TODO: fail connection
                );

            Connection.SIPRequestReceived -= ConnectionNotifyListener;

            //this.Connected = true;
            Connecting = false;
        }

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

            PeerListeningConfirmation = true;
        }

        public async override Task Stop()
        {
            // TODO: Rework completely

            if (!Connected)
            {
                // not connected.
                return;
            }

            Params.RemoteTag = null;
            Params.CallId = null;

            if (Connecting)
            {
                Connection.SIPRequestReceived -= InitialNotifyListener;

                // TODO: what to do here? send disconnect message?
                return;
            }

            //this.Connected = false;
            // TODO: send a message for disconnect?
        }

        public async Task<SocketError> SendRequest(SIPMethodsEnum method, string message, string contentType, int cSeq)
        {
            if (!Connected)
            {
                return SocketError.NotConnected;
            }

            return await MessagingDialog.SendRequest(method, message, contentType, cSeq);
        }

        public async Task<SocketError> SendResponse(SIPResponseStatusCodesEnum statusCode, string message, string contentType, int cSeq)
        {
            if (!Connected)
            {
                return SocketError.NotConnected;
            }

            return await MessagingDialog.SendResponse(statusCode, message, contentType, cSeq);
        }

        private async Task RequestRecieved(ISIPMessager sender, SIPRequest sipRequest)
        {
            await (OnRequestReceived?.Invoke(this, sipRequest) ?? Task.CompletedTask);
        }

        private async Task ResponseRecieved(ISIPMessager sender, SIPResponse sipResponse)
        {
            await (OnResponseReceived?.Invoke(this, sipResponse) ?? Task.CompletedTask);
        }
    }
}
