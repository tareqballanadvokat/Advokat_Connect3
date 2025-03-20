using SIPSorcery.SIP;
using System.ComponentModel;
using System.Diagnostics.CodeAnalysis;
using System.Net.Sockets;
using WebRTCLibrary.SIP.Models;
using static WebRTCLibrary.SIP.SIPConnection;
using static WebRTCLibrary.Utils.TaskHelpers;

namespace WebRTCLibrary.SIP
{
    public class RegistrationManager : AbstractSIPMessager
    {
        public int MessageTimeout = 2000;                                     // TODO: should be passed in constructor

        public string CallID { get; private set; }

        private bool registered;

        public event Action<RegistrationManager> OnRegistered;
        
        public event Action<RegistrationManager> OnUnRegistered;

        public bool Registered
        {
            get => registered;
            private set
            {
                if (this.registered != value)
                {
                    this.registered = value;

                    if (value == true)
                    {
                        this.OnRegistered?.Invoke(this);
                    }
                    else
                    {
                        this.OnUnRegistered?.Invoke(this);
                    }
                }
            } 
        }

        private bool Registering { get; set; }

        [MemberNotNullWhen(true, nameof(this.Registered), nameof(this.Registering))]
        public SIPParticipant? SourceParticipant { get; private set; }

        [MemberNotNullWhen(true, nameof(this.Registered), nameof(this.Registering))]
        private SIPParticipant? RemoteParticipant { get; set; }

        private SIPConnection Connection { get; set; }

        public RegistrationManager(SIPConnection connection, string callID)
        {
            this.CallID = callID;
            this.Connection = connection;
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
            //this.SetConnection();
                
            // TODO: get the tag to the responselistener somehow
            string tag = CallProperties.CreateNewTag();

            // set response delegate
            SIPTransportResponseAsyncDelegate responseDelegate = GetResponseListener(this.ListenForRegistrationAccept, requestFromTag: tag);
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
                //&& remoteEndPoint.GetIPEndPoint().ToString() == this.RemoteParticipant.Endpoint.GetIPEndPoint().ToString()

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

            // Signaling server sends not found if the other peer is not present
            // TODO: remove afte it has been fixed.
            if (sipResponse.Status == SIPResponseStatusCodesEnum.NotFound)
            {
                return;
            }

            //TODO: Only fail if response is for this dialog (tag matches)

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
            SIPTransportResponseAsyncDelegate responseDelegate = GetResponseListener(this.ListenForDisconnectAccept, requestFromTag: tag);
            this.Connection.SIPResponseReceived += responseDelegate;

            SIPHeaderParams headerParams = this.GetHeaderParams(fromTag: tag);
            // send disconnect message
            await this.SendSIPMessage(SIPMethodsEnum.BYE, headerParams);

            // TODO: add failurecallback --> log failure to disconnect or retry
            await WaitFor(() => !this.Registered, timeOut: timeOut ?? this.MessageTimeout);

            // remove listener
            // TODO: will this always run after previous task is finished?
            this.Connection.SIPResponseReceived -= responseDelegate; // remove listener
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
                //&& remoteEndPoint.GetIPEndPoint().ToString() == this.RemoteParticipant.Endpoint.GetIPEndPoint().ToString()

                //&& sipResponse.Header.To.ToTag == requestFromTag // TODO: activate. Signaling server does currently not respond with the correct tag
                )
            {
                // TODO should this be Acknowledged aswell? What if the accept doesn't reach the peer. We still think we are registered.

                this.SourceParticipant = null;
                this.RemoteParticipant = null;
                this.Registered = false;
                return;
            }

            // failed
        }

        private void RegistrationFailed()
        {
            this.Registered = false;
            this.Registering = false;
            this.SourceParticipant = null;
            this.RemoteParticipant = null;
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
