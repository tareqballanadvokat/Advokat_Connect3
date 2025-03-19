using SIPSorcery.SIP;
using System.Net.Sockets;
using WebRTCCallerLibrary.Models;

namespace WebRTCCallerLibrary
{
    internal class SIPConnection
    {
        public int MessageTimeout = 2000;

        public SIPSchemesEnum SIPScheme { get; set; }

        public SIPTransport Transport { get; private set; }

        public delegate Task SIPTransportResponsetAsyncDelegate(SIPEndPoint localSIPEndPoint, SIPEndPoint remoteEndPoint, SIPResponse sipResponse);

        public event SIPTransportResponsetAsyncDelegate SIPResponseReceived;

        internal SIPConnection(SIPSchemesEnum scheme, SIPTransport transport)
        {
            SIPScheme = scheme;
            Transport = transport;
            this.Transport.SIPTransportResponseReceived += this.OnMessageRecieved;
        }

        private async Task OnMessageRecieved(SIPEndPoint localSIPEndPoint, SIPEndPoint remoteEndPoint, SIPResponse sipResponse)
        {
            // we can filter for current connection, but it should only recieve current connections anyway.
            this.SIPResponseReceived?.Invoke(localSIPEndPoint, remoteEndPoint, sipResponse);
        }

        public async Task<SocketError> SendSIPMessage(SIPMethodsEnum method, SIPHeaderParams headerParams, string? message = null, CancellationToken? ct = null, int? timeOut = null)
        {
            // TODO: Make ct Mandatory

            SIPRequest registerRequest = this.GetRequest(method, headerParams, message);
            Task<SocketError> request = this.Transport.SendRequestAsync(registerRequest);

            return await this.WaitForSendConfirmation(request, timeOut);
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

 
        private SIPRequest GetRequest(SIPMethodsEnum method, SIPHeaderParams headerParams, string? message = null)
        {
            // branch?
            SIPRequest request = SIPRequest.GetRequest(
                method,
                new SIPURI(
                    this.SIPScheme,
                    headerParams.RemoteParticipant.Endpoint.Address, // cannot be null here
                    headerParams.RemoteParticipant.Endpoint.Port));

            SIPURI FromUri = this.GetSIPURIFor(headerParams.SourceParticipant);
            SIPURI ToUri = this.GetSIPURIFor(headerParams.RemoteParticipant);

            request.Header.From = new SIPFromHeader(headerParams.SourceParticipant.Name, FromUri, headerParams.FromTag);
            request.Header.To = new SIPToHeader(headerParams.RemoteParticipant.Name, ToUri, headerParams.ToTag);
            request.Header.CSeq = headerParams.CSeq;
            request.Header.CallId = headerParams.CallID;
            //request.Header.MaxForwards = 70; // 70 is an arbitrary number

            // TODO: add message
            //request.Body = "";
            //request.Header.Contact = new List<SIPContactHeader> { new SIPContactHeader(null, new SIPURI(SIPScheme, this.SourceParticipant.Endpoint)) };

            return request;
        }

        private SIPURI GetSIPURIFor(SIPParticipant participant, string? paramsAndHeaders = null)
        {
            return new SIPURI(
                participant.Name,
                participant.Endpoint.GetIPEndPoint().ToString(),
                paramsAndHeaders,
                this.SIPScheme,
                participant.Endpoint.Protocol);
        }

    }
}
