using SIPSorcery.SIP;
using System.Diagnostics.CodeAnalysis;
using System.Net.Sockets;
using WebRTCCallerLibrary.Models;
using WebRTCCallerLibrary.Utils;

namespace WebRTCCallerLibrary
{
    public class SignalingServerConnection
    {
        public int MessageTimeout = 2000;

        public bool Connected { get; private set; }

        public bool Registered { get; private set; }

        private bool Registering { get; set; }

        [MemberNotNullWhen(true, nameof(this.Registered), nameof(this.Registering))]
        public SIPParticipant? SourceParticipant { get; private set; }

        [MemberNotNullWhen(true, nameof(this.Registered), nameof(this.Registering))]
        private SIPParticipant? RemoteParticipant { get; set; }

        [MemberNotNullWhen(true, nameof(this.Registered), nameof(this.Registering))]
        private SIPTransport? Connection { get; set; }

        public async Task Register(SIPParticipant sourceParticipant, SIPParticipant remoteParticipant, int? timeOut = null)
        {
            if (this.Registered)
            {
                // TODO: log. already registered
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
            this.Connection.SIPTransportResponseReceived += this.OnRegisterAcknowledge;

            await this.SendSIPMessage(SIPMethodsEnum.REGISTER, this.Connection, new SIPMessage(RemoteParticipant));


            CancellationTokenSource cts = new CancellationTokenSource(timeOut ?? this.MessageTimeout);
            CancellationToken ct = cts.Token;

            // Check for timeout. Call RegistrationFailed when timeout is reached.
            await Task.Factory.StartNew(() =>
            {
                while (!ct.IsCancellationRequested)
                {
                    if (this.Registered && !this.Registering)
                    {
                        // success
                        return;
                    }

                    Task.Delay(100);
                }

                // timout/failure
                this.Connection.SIPTransportResponseReceived -= this.OnRegisterAcknowledge; // remove listener
                this.RegistrationFailed();
            });
        }

        private async Task OnRegisterAcknowledge(SIPEndPoint localEndPoint, SIPEndPoint remoteEndPoint, SIPResponse sipResponse)
        {
            if (sipResponse.Status == SIPResponseStatusCodesEnum.Accepted
                && this.RemoteParticipant != null
                // TODO: implement this comparison better - is it even needed?
                && remoteEndPoint.GetIPEndPoint().ToString() == this.RemoteParticipant.Endpoint.GetIPEndPoint().ToString())
            {
                await this.SendSIPMessage(SIPMethodsEnum.ACK, new SIPMessage(this.RemoteParticipant));// TODO: Check if new message (tag, call id Cseq etc.)

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

        public async Task Disconnect() // call method Unregister?
        {
            if (!this.Registered)
            {
                // TODO: log. Not registered
                return;
            }

            await this.SendSIPMessage(SIPMethodsEnum.BYE, new SIPMessage(this.RemoteParticipant));
            // TODO: check if request was accepted
            
            // TODO: check if channels have to be closed manually
            this.Connection.Dispose();
        }

        private async Task SendSIPMessage(SIPMethodsEnum method, SIPTransport connection, SIPMessage sipMessage, CancellationToken? ct = null, int? timeOut = null)
        {
            if ((!this.Registering && !this.Registered)
                || (this.RemoteParticipant == null || this.SourceParticipant == null))
            {
                // TODO: Log - not registered
                return;
            }

            // TODO: Make ct Mandatory

            SIPSchemesEnum SIPScheme = SIPSchemesEnum.sip; // TODO: should probably be changed to SIPS later on

            SIPRequest registerRequest = SIPRequest.GetRequest(
                method,
                new SIPURI(
                    SIPScheme,
                    this.RemoteParticipant.Endpoint.Address, // cannot be null here
                    this.RemoteParticipant.Endpoint.Port));

            sipMessage.Tag ??= CallProperties.CreateNewTag();

            SIPURI FromUri = new SIPURI(this.SourceParticipant.Name, this.SourceParticipant.Endpoint.GetIPEndPoint().ToString(), "", SIPScheme, SIPProtocolsEnum.udp);
            SIPURI ToUri = new SIPURI(sipMessage.To.Name, sipMessage.To.Endpoint.GetIPEndPoint().ToString(), "", SIPScheme, SIPProtocolsEnum.udp);

            registerRequest.Header.From = new SIPFromHeader(this.SourceParticipant.Name, FromUri, sipMessage.Tag);
            registerRequest.Header.To = new SIPToHeader(sipMessage.To.Name, ToUri, sipMessage.Tag); // TODO: should both From and to have a tag?
            registerRequest.Header.CSeq = sipMessage.CSeq ?? 1;
            registerRequest.Header.CallId = CallProperties.CreateNewCallId(); // TODO: CallerId should be per endpoint
            registerRequest.Header.MaxForwards = 70; // 70 is an arbitrary number

            // TODO: add message
            //registerRequest.Body = "";
            //registerRequest.Header.Contact = new List<SIPContactHeader> { new SIPContactHeader(null, new SIPURI(SIPScheme, this.SourceParticipant.Endpoint)) };

            Task<SocketError> request = connection.SendRequestAsync(registerRequest);

            if(await Task.WhenAny(request, Task.Delay(timeOut ?? this.MessageTimeout)) == request) // TODO: pass ct: Task.Delay(timeOut ?? this.MessageTimeout, ct)
            {

                // Task completed within timeout.
                // TODO: Consider that the task may have faulted or been canceled.
                // We re-await the task so that any exceptions/cancellation is rethrown.

                SocketError response = await request;
                if (response == SocketError.Success)
                {
                    //Log("✅ SIP request sent successfully. " + type);
                    //return true;
                }
                else
                {
                    //Log($"❌ Failed to send SIP request: {response}");
                    //return false;
                }
            }
            else
            {
                // timeout/cancellation logic
            }
        }

        public async Task SendSIPMessage(SIPMethodsEnum method, SIPMessage sipMessage, CancellationToken? ct = null, int? timeOut = null)
        {
            using SIPTransport connection = new SIPTransport();
            await this.SendSIPMessage(method, connection, sipMessage, ct, timeOut);
        }
    }
}
