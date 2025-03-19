using SIPSorcery.SIP;
using System.Diagnostics.CodeAnalysis;
using System.Net.Sockets;
using WebRTCCallerLibrary.Models;

namespace WebRTCCallerLibrary
{
    public class RegistrationManager
    {
        public static readonly SIPSchemesEnum SIPScheme = SIPSchemesEnum.sip; // TODO: should probably be changed to SIPS later on

        public int MessageTimeout = 2000;

        public string CallID { get; private set; }

        //public bool Connected { get; private set; }

        public bool Registered { get; private set; }

        private bool Registering { get; set; }

        [MemberNotNullWhen(true, nameof(this.Registered), nameof(this.Registering))]
        public SIPParticipant? SourceParticipant { get; private set; }

        [MemberNotNullWhen(true, nameof(this.Registered), nameof(this.Registering))]
        private SIPParticipant? RemoteParticipant { get; set; }

        //[MemberNotNullWhen(true, nameof(this.Registered), nameof(this.Registering))]
        //private SIPTransport? Transport { get; set; }

        [MemberNotNullWhen(true, nameof(this.Registered), nameof(this.Registering))]
        private SIPConnection? Connection { get; set; }

        public RegistrationManager():
            this(CallProperties.CreateNewCallId()) // TODO: should we append ip-address?
        {
        }

        public RegistrationManager(string callID)
        {
            this.CallID = callID;
        }

        public async Task Register(SIPParticipant sourceParticipant, SIPParticipant remoteParticipant, int? timeOut = null)
        {
            if (this.Registered || this.Registering)
            {
                // TODO: log. already registered or registering
                return;
            }

            this.Registering = true;
            this.SourceParticipant = sourceParticipant;
            this.RemoteParticipant = remoteParticipant;
            this.SetConnection();
                
            // TODO: get the tag to the responselistener somehow
            string tag = CallProperties.CreateNewTag();
            
            // set response delegate
            this.Connection.SIPResponseReceived += this.ListenForRegistrationAccept;

            SIPHeaderParams headerParams = this.GetHeaderParams(fromTag: tag);
            await this.SendSIPMessage(SIPMethodsEnum.REGISTER, headerParams);

            await this.WaitFor(
                () => (this.Registered && !this.Registering),
                failureCallback: this.RegistrationFailed,
                timeOut: timeOut);

            // TODO: make sure this happens after timeout / failure or success
            this.Connection.SIPResponseReceived -= this.ListenForRegistrationAccept; // remove listener


        }

        public async Task Disconnect(int? timeOut = null) // call method Unregister?
        {
            if (!this.Registered)
            {
                // TODO: log. Not registered
                return;
            }

            if (this.Registering)
            {
                // TODO: cancel registering and check if we have to continue
                return;
            }

            // TODO: get the tag to the responselistener somehow
            string tag = CallProperties.CreateNewTag();

            // set response listener
            // cannot be null if registered is true
            this.Connection.SIPResponseReceived += this.ListenForDisconnectAccept;


            // send disconnect message
            SIPHeaderParams headerParams = this.GetHeaderParams(fromTag: tag);
            await this.SendSIPMessage(SIPMethodsEnum.BYE, headerParams);

            // TODO: add failurecallback --> log failure to disconnect
            await this.WaitFor(() => !this.Registered, timeOut: timeOut);

            // remove listener
            // TODO: will this always run after previous task is finished?
            this.Connection.SIPResponseReceived -= this.ListenForDisconnectAccept;
        }

        private async Task ListenForRegistrationAccept(SIPEndPoint localEndPoint, SIPEndPoint remoteEndPoint, SIPResponse sipResponse)
        {
            if (sipResponse.Status == SIPResponseStatusCodesEnum.Accepted
                && this.RemoteParticipant != null
                // TODO: implement this comparison better - is it even needed?
                && remoteEndPoint.GetIPEndPoint().ToString() == this.RemoteParticipant.Endpoint.GetIPEndPoint().ToString())
            {
                // TODO: Check tag
                SIPHeaderParams sipResponseHeaderParams = this.GetHeaderParamsForResponseTo(sipResponse);
                await this.SendSIPMessage(SIPMethodsEnum.ACK, headerParams: sipResponseHeaderParams);

                // success
                this.Registered = true;
                this.Registering = false;
                return;
            }

            // failure
            this.RegistrationFailed();
        }

        private async Task ListenForDisconnectAccept(SIPEndPoint localEndPoint, SIPEndPoint remoteEndPoint, SIPResponse sipResponse)
        {
            if (sipResponse.Status == SIPResponseStatusCodesEnum.Accepted
                && this.RemoteParticipant != null
                // TODO: implement this comparison better - is it even needed?
                && remoteEndPoint.GetIPEndPoint().ToString() == this.RemoteParticipant.Endpoint.GetIPEndPoint().ToString())
            {
                // TODO: check Tag

                // TODO should this be Acknowledged aswell? What if the accept doesn't reach the peer. We still think we are registered.
                this.Registered = false;

                // TODO: dispose connection itself
                this.Connection.Transport?.Dispose();
                // TODO: check if channels have to be closed manually
                return;
            }

            // failed
        }

        [MemberNotNull(nameof(this.Connection))]
        private void SetConnection()
        {
            SIPTransport transport = new SIPTransport();

            // set listening channel
            SIPUDPChannel channel = new SIPUDPChannel(this.SourceParticipant.Endpoint.GetIPEndPoint());
            transport.AddSIPChannel(channel);

            this.Connection = new SIPConnection(SIPScheme, transport);
        }

        private void RegistrationFailed()
        {
            this.Registered = false;
            this.Registering = false;
            this.SourceParticipant = null;
            this.RemoteParticipant = null;
            
            this.Connection?.Transport.Dispose();
            this.Connection = null; // TODO: Dispose
        }

        private async Task SendSIPMessage(SIPMethodsEnum method, SIPHeaderParams headerParams, string? message = null, CancellationToken? ct = null, int? timeOut = null)
        {
            // TODO: Make ct Mandatory

            //if ((!this.Registering && !this.Registered)
            //    || (this.RemoteParticipant == null || this.SourceParticipant == null))
            //{
            //    // TODO: Log - not registered
            //    return;
            //}

            SocketError result = await this.Connection.SendSIPMessage(method, headerParams, message, ct, timeOut);

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

        private async Task WaitFor(Func<bool> predicate, Action? successCallback = null, Action? failureCallback = null, int? timeOut = null)
        {
            CancellationTokenSource cts = new CancellationTokenSource(timeOut ?? this.MessageTimeout);
            CancellationToken ct = cts.Token;

            await Task.Factory.StartNew(() =>
            {
                while (!ct.IsCancellationRequested)
                {
                    if (predicate.Invoke())
                    {
                        // success
                        successCallback?.Invoke();
                        return;
                    }

                    Task.Delay(100);
                }

                // timout/failure
                failureCallback?.Invoke();
            });
        }

        private SIPHeaderParams GetHeaderParams(string? fromTag = null, string? toTag = null, int cSeq = 1)
        {
            return new SIPHeaderParams(
                this.SourceParticipant,
                this.RemoteParticipant,
                fromTag: fromTag,
                toTag: toTag,
                cSeq: cSeq,
                callID: this.CallID);
        }

        private SIPHeaderParams GetHeaderParamsForResponseTo(SIPResponse response)
        {
            SIPHeaderParams sipHeaderParams = this.GetHeaderParams(
                fromTag: response.Header.To.ToTag,
                toTag: response.Header.From.FromTag,
                cSeq: response.Header.CSeq + 1);

            return sipHeaderParams;
        }
    }
}
