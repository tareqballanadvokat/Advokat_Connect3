using SIPSorcery.SIP;
using System.Diagnostics.CodeAnalysis;
using System.Net.Sockets;
using WebRTCCallerLibrary.Models;
using static WebRTCCallerLibrary.SIPConnection;
using static WebRTCCallerLibrary.Utils.TaskHelpers;


namespace WebRTCCallerLibrary
{
    public class RegistrationManager : AbstractSIPMessager
    {
        public static readonly SIPSchemesEnum SIPScheme = SIPSchemesEnum.sip; // TODO: should probably be changed to SIPS later on
                                                                              // TODO: should be passed in constructor

        public int MessageTimeout = 2000;                                     // TODO: should be passed in constructor

        public string CallID { get; private set; }

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
            SIPTransportResponsetAsyncDelegate responseDelegate = GetResponseListener(this.ListenForRegistrationAccept, requestFromTag: tag);
            this.Connection.SIPResponseReceived += responseDelegate;

            // send request
            SIPHeaderParams headerParams = this.GetHeaderParams(fromTag: tag);
            await this.SendSIPMessage(SIPMethodsEnum.REGISTER, headerParams);

            await WaitFor(
                () => (this.Registered && !this.Registering),
                failureCallback: this.RegistrationFailed,
                timeOut: timeOut ?? this.MessageTimeout);
            
            // TODO: make sure this happens after timeout / failure or success
            if (this.Connection != null)
            {
                this.Connection.SIPResponseReceived -= responseDelegate; // remove listener
            }
        }

        private async Task ListenForRegistrationAccept(
            SIPEndPoint localEndPoint,
            SIPEndPoint remoteEndPoint,
            SIPResponse sipResponse,
            string? requestFromTag = null,
            string? requestToTag = null)
        {
            if (sipResponse.Status == SIPResponseStatusCodesEnum.Accepted
                && this.RemoteParticipant != null
                // TODO: implement this comparison better - is it even needed?
                && remoteEndPoint.GetIPEndPoint().ToString() == this.RemoteParticipant.Endpoint.GetIPEndPoint().ToString()
                //&& sipResponse.Header.To.ToTag == requestFromTag // TODO: activate. Signaling server does currently not respond with the correct tag
                )
            {
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

        public async Task Unregister(int? timeOut = null)
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

            string tag = CallProperties.CreateNewTag();

            // set response listener
            // cannot be null if registered is true
            SIPTransportResponsetAsyncDelegate responseDelegate = GetResponseListener(this.ListenForDisconnectAccept, requestFromTag: tag);
            this.Connection.SIPResponseReceived += responseDelegate;

            SIPHeaderParams headerParams = this.GetHeaderParams(fromTag: tag);
            // send disconnect message
            await this.SendSIPMessage(SIPMethodsEnum.BYE, headerParams);

            // TODO: add failurecallback --> log failure to disconnect or retry
            await WaitFor(() => !this.Registered, timeOut: timeOut ?? this.MessageTimeout);

            if (this.Connection != null)
            {
                // remove listener
                // TODO: will this always run after previous task is finished?
                this.Connection.SIPResponseReceived -= responseDelegate; // remove listener
            }
        }

        private async Task ListenForDisconnectAccept(
            SIPEndPoint localEndPoint,
            SIPEndPoint remoteEndPoint,
            SIPResponse sipResponse,
            string? requestFromTag = null,
            string? requestToTag = null)
        {
            if (sipResponse.Status == SIPResponseStatusCodesEnum.Accepted
                && this.RemoteParticipant != null
                // TODO: implement this comparison better - is it even needed?
                && remoteEndPoint.GetIPEndPoint().ToString() == this.RemoteParticipant.Endpoint.GetIPEndPoint().ToString()
                //&& sipResponse.Header.To.ToTag == requestFromTag // TODO: activate. Signaling server does currently not respond with the correct tag
                )
            {
                // TODO should this be Acknowledged aswell? What if the accept doesn't reach the peer. We still think we are registered.

                this.Connection?.Dispose();
                this.Connection = null;
                // TODO: check if channels have to be closed manually

                this.SourceParticipant = null;
                this.RemoteParticipant = null;
                this.Registered = false;
                return;
            }

            // failed
        }

        [MemberNotNull(nameof(this.Connection))]
        private void SetConnection()
        {
            // TODO: Inject connectionfactory - ISIPConenction easier to test and switch UDP / TCP / WS

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
            
            this.Connection?.Dispose();
            this.Connection = null;
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

        private SIPHeaderParams GetHeaderParams(string? fromTag = null, string? toTag = null, int cSeq = 1)
        {
            return this.GetHeaderParams(
                this.SourceParticipant,
                this.RemoteParticipant,
                fromTag: fromTag,
                toTag: toTag,
                cSeq: cSeq,
                callID: this.CallID);
        }

        private SIPHeaderParams GetHeaderParamsForResponseTo(SIPResponse response)
        {
            return this.GetHeaderParamsForResponseTo(
                this.SourceParticipant,
                this.RemoteParticipant,
                response,
                callId: this.CallID
                );
        }
    }
}
