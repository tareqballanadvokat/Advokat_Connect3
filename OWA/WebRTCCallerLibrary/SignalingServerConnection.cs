using SIPSorcery.SIP;
using System.Diagnostics.CodeAnalysis;
using System.Net.Sockets;
using System.Threading;
using WebRTCCallerLibrary.Models;
using WebRTCCallerLibrary.Utils;

namespace WebRTCCallerLibrary
{
    public class SignalingServerConnection
    {
        public static readonly SIPSchemesEnum SIPScheme = SIPSchemesEnum.sip; // TODO: should probably be changed to SIPS later on

        public int MessageTimeout = 2000;

        public string CallID { get; private set; }

        public bool Connected { get; private set; }

        public bool Registered { get; private set; }

        private bool Registering { get; set; }

        [MemberNotNullWhen(true, nameof(this.Registered), nameof(this.Registering))]
        public SIPParticipant? SourceParticipant { get; private set; }

        [MemberNotNullWhen(true, nameof(this.Registered), nameof(this.Registering))]
        private SIPParticipant? RemoteParticipant { get; set; }

        [MemberNotNullWhen(true, nameof(this.Registered), nameof(this.Registering))]
        private SIPTransport? Connection { get; set; }

        public SignalingServerConnection():
            this(CallProperties.CreateNewCallId()) // TODO: should we append ip-address?
        {
        }

        public SignalingServerConnection(string callID)
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

            this.Connection = new SIPTransport();
                
            // set listening channel
            SIPUDPChannel channel = new SIPUDPChannel(SourceParticipant.Endpoint.GetIPEndPoint());
            this.Connection.AddSIPChannel(channel);

            // set response delegate
            this.Connection.SIPTransportResponseReceived += this.ListenForRegistrationAccept;

            await this.SendSIPMessage(SIPMethodsEnum.REGISTER);

            await this.WaitFor(() => (this.Registered && !this.Registering), failureCallback: this.RegistrationFailed, timeOut: timeOut);

            // TODO: make sure this happens after timeout / failure or success
            this.Connection.SIPTransportResponseReceived -= this.ListenForRegistrationAccept; // remove listener

        }

        public async Task Disconnect(int? timeOut = null) // call method Unregister?
        {
            if (!this.Registered)
            {
                // TODO: log. Not registered
                return;
            }

            // set response listener
            this.Connection.SIPTransportResponseReceived += this.ListenForDisconnectAccept;

            // send disconnect message
            await this.SendSIPMessage(SIPMethodsEnum.BYE);

            // TODO: add failurecallback --> log failure to disconnect
            await this.WaitFor(() => !this.Registered, timeOut: timeOut);

            // remove listener
            // TODO: will this always run after previous task is finished?
            this.Connection.SIPTransportResponseReceived -= this.ListenForDisconnectAccept;
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

        private void RegistrationFailed()
        {
            this.Registered = false;
            this.Registering = false;
            this.SourceParticipant = null;
            this.RemoteParticipant = null;
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
                this.Connection?.Dispose();
                // TODO: check if channels have to be closed manually
                return;
            }

            // failed
        }

        private async Task SendSIPMessage(SIPMethodsEnum method, string? message = null, SIPHeaderParams? headerParams = null, CancellationToken? ct = null, int? timeOut = null)
        {
            // TODO: Make ct Mandatory

            if ((!this.Registering && !this.Registered)
                || (this.RemoteParticipant == null || this.SourceParticipant == null))
            {
                // TODO: Log - not registered
                return;
            }

            SIPRequest registerRequest = this.GetRequest(method, message, headerParams);
            Task<SocketError> request = this.Connection.SendRequestAsync(registerRequest);

            SocketError result = await this.WaitForSendConfirmation(request, timeOut);

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

        private async Task<SocketError> WaitForSendConfirmation(Task<SocketError> request, int? timeOut = null)
        {
            timeOut ??= this.MessageTimeout;
            if (await Task.WhenAny(request, Task.Delay((int)timeOut)) == request) // TODO: pass ct: Task.Delay(timeOut ?? this.MessageTimeout, ct)
            {
                // Task completed within timeout.
                // TODO: Consider that the task may have faulted or been canceled.
                // We re-await the task so that any exceptions/cancellation is rethrown.

                return await request;
            }
            else
            {
                return SocketError.TimedOut;
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

        private SIPHeaderParams GetHeaderParamsForResponseTo(SIPResponse response)
        {
            SIPHeaderParams sipHeaderParams = new SIPHeaderParams();
            sipHeaderParams.FromTag = response.Header.To.ToTag;
            sipHeaderParams.ToTag = response.Header.From.FromTag;
            sipHeaderParams.CSeq = response.Header.CSeq + 1;

            return sipHeaderParams;
        }

        private SIPRequest GetRequest(SIPMethodsEnum method, string? message = null, SIPHeaderParams? headerParams = null)
        {
            // set default values
            if (headerParams == null)
            {
                headerParams = new SIPHeaderParams();
                headerParams.FromTag = CallProperties.CreateNewTag(); // should we set this as default here?
            }

            // branch?
            SIPRequest request = SIPRequest.GetRequest(
                method,
                new SIPURI(
                    SIPScheme,
                    this.RemoteParticipant.Endpoint.Address, // cannot be null here
                    this.RemoteParticipant.Endpoint.Port));

            SIPURI FromUri = GetSIPURIFor(this.SourceParticipant);
            SIPURI ToUri = GetSIPURIFor(this.RemoteParticipant);

            request.Header.From = new SIPFromHeader(this.SourceParticipant.Name, FromUri, headerParams.FromTag);
            request.Header.To = new SIPToHeader(this.RemoteParticipant.Name, ToUri, headerParams.ToTag);
            request.Header.CSeq = headerParams.CSeq;
            request.Header.CallId = this.CallID;
            request.Header.MaxForwards = 70; // 70 is an arbitrary number

            // TODO: add message
            //request.Body = "";
            //request.Header.Contact = new List<SIPContactHeader> { new SIPContactHeader(null, new SIPURI(SIPScheme, this.SourceParticipant.Endpoint)) };

            return request;
        }

        private static SIPURI GetSIPURIFor(SIPParticipant participant, string? paramsAndHeaders = null)
        {
            return new SIPURI(
                participant.Name,
                participant.Endpoint.GetIPEndPoint().ToString(),
                paramsAndHeaders,
                SIPScheme,
                participant.Endpoint.Protocol);
        }
    }
}
