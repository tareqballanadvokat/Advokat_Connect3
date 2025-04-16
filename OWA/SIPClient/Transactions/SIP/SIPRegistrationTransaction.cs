using SIPSorcery.SIP;
using System.Diagnostics;
using System.Net.Sockets;
using WebRTCLibrary.SIP;
using WebRTCLibrary.SIP.Models;
using WebRTCLibrary.Utils;

using static WebRTCLibrary.Utils.TaskHelpers;

namespace WebRTCClient.Transactions.SIP
{
    internal class SIPRegistrationTransaction : WebRTCLibrary.SIP.SIPTransaction, IAsyncDisposable
    {
        public bool Registered { get; private set; }

        private bool Registering { get; set; }

        //public event Action<ClientRegistrationDialog, SIPDialogEventArgs>? OnRegistered;

        public event Action<SIPRegistrationTransaction, SIPDialogEventArgs>? OnUnRegistered;

        public SIPRegistrationTransaction(SIPConnection connection, TransactionParams dialogParams)
            : base(connection, dialogParams)
        {
        }

        public SIPRegistrationTransaction(SIPSchemesEnum sipScheme, SIPTransport transport, TransactionParams dialogParams)
            : base(sipScheme, transport, dialogParams)
        {
        }

        public override async Task Start()
        {
            await Register();
        }

        public override async Task Stop()
        {
            await Unregister();
        }

        private async Task Register()
        {
            if (Registered)
            {
                // TODO: log. already registered
                return;
            }

            if (Registering)
            {
                // TODO: log. already registering. Wait for the previous registering to finish. Retry automatically?
                return;
            }

            Registering = true;
            Params.SourceTag = CallProperties.CreateNewTag();

            // set response delegate
            Connection.SIPResponseReceived += ListenForRegistrationAccept;

            // send request
            // TODO: do something with the socekterror
            await SendSIPMessage(SIPMethodsEnum.REGISTER);

            await WaitFor(
                () => Registered && !Registering,
                failureCallback: RegistrationFailed,
                timeOut: ReceiveTimeout);

            // TODO: make sure this happens after timeout / failure or success
            // remove listener
            Connection.SIPResponseReceived -= ListenForRegistrationAccept;

        }

        private async Task ListenForRegistrationAccept(SIPEndPoint localEndPoint, SIPEndPoint remoteEndPoint, SIPResponse sipResponse)
        {
            // Old Signaling server sends not found if the other peer is not present
            // TODO: remove when the servers get switched.
            if (sipResponse.Status == SIPResponseStatusCodesEnum.NotFound)
            {
                return;
            }

            if (sipResponse.Status != SIPResponseStatusCodesEnum.Accepted)
            {
                // bad request, wrong status
                RegistrationFailed();
                return;
            }

            if (Params.RemoteParticipant == null // Why?
                || sipResponse.Header.CSeq != 2)
            {
                // bad request - header is invalid
                RegistrationFailed();
                return;
            }

            await RegistrationAccepted(sipResponse);
        }

        private async Task RegistrationAccepted(SIPResponse sipResponse)
        {
            Debug.WriteLine($"Client received Accepted."); // DEBUG

            Params.RemoteTag = sipResponse.Header.From.FromTag;

            // success
            Registered = true;
            Registering = false;

            // TODO: Do something with the socketerror
            await SendSIPMessage(SIPMethodsEnum.ACK, GetHeaderParams(cSeq: sipResponse.Header.CSeq + 1));
        }

        private async Task Unregister()
        {
            if (!Registered)
            {
                // TODO: log. Not registered
                return;
            }

            if (Registering)
            {
                // TODO: cancel registering and check if we have to continue
                //       Unregister after is has finished?

                //await WaitFor(
                //    () => this.Registering == false && this.Registered == true,
                //    timeOut: this.ReceiveTimeout,
                //    successCallback: this.Unregister());
                return;
            }

            // set response listener
            Connection.SIPResponseReceived += ListenForDisconnectAccept;

            // send disconnect message
            // TODO: do something with the socket error
            await SendSIPMessage(SIPMethodsEnum.BYE);

            // TODO: add failurecallback --> log failure to disconnect. Retry?
            await WaitFor(
                () => !Registered,
                timeOut: ReceiveTimeout);

            // remove listener
            // TODO: will this always run after previous task is finished?
            Connection.SIPResponseReceived -= ListenForDisconnectAccept; // remove listener
        }

        private async Task ListenForDisconnectAccept(SIPEndPoint localEndPoint, SIPEndPoint remoteEndPoint, SIPResponse sipResponse)
        {
            if (sipResponse.Status != SIPResponseStatusCodesEnum.Accepted)
            {
                // bad request - wrong status code
                
                // TODO: What to do on Unregister failed?
                return;
            }

            if (Params.RemoteParticipant == null // why
                || sipResponse.Header.CSeq != 2)
            {
                // bad request - header is invalid
                // TODO: Unregister failed? - Server sent an invalid accepted
                return;
            }
    
            ResetRegistration();
        }

        private void RegistrationFailed()
        {
            Registering = false;
            ResetRegistration();
        }

        private void ResetRegistration()
        {
            // TODO: event that Registration was reset?
            Params.SourceTag = null;
            Params.RemoteTag = null;
            Registered = false;
        }

        private async Task SendSIPMessage(SIPMethodsEnum method, SIPHeaderParams? headerParams = null, string? message = null, CancellationToken? ct = null)
        {
            // TODO: Make ct Mandatory

            //if ((!this.Registering && !this.Registered)
            //    || (this.RemoteParticipant == null || this.SourceParticipant == null))
            //{
            //    // TODO: Log - not registered
            //    return;
            //}

            Debug.WriteLine($"Client sending {method}."); // DEBUG
            SocketError result = await Connection.SendSIPRequest(
                method,
                headerParams ?? GetHeaderParams(),
                message,
                ct,
                SendTimeout);

            // should we return socketerror?
            switch (result)
            {
                case SocketError.Success:
                    // Log("✅ SIP request sent successfully. " + method);
                    // success
                    break;

                case SocketError.TimedOut:
                    // timeout
                    break;

                default:
                    // failure to send
                    break;
            }
        }

        public async ValueTask DisposeAsync()
        {
            await Unregister();
        }
    }
}
