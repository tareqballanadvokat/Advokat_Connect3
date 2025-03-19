using SIPSorcery.SIP;
using System.Net.Sockets;
using WebRTCCallerLibrary.Models;

namespace WebRTCCallerLibrary
{
    internal class SIPConnection : IDisposable
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

        public async Task<SocketError> SendSIPMessage(SIPMethodsEnum method, SIPHeaderParams headerParams, string? message = null, CancellationToken? ct = null, int? timeOut = null)
        {
            // TODO: Make ct Mandatory

            SIPRequest registerRequest = this.GetRequest(method, headerParams, message);
            Task<SocketError> request = this.Transport.SendRequestAsync(registerRequest);

            return await this.WaitForSendConfirmation(request, timeOut);
        }

        /// <summary>Returns an eventlistener for incoming responses that gets passed previous assigned tags.
        ///          This is useful to compare the tags of the response and the previous request in the callback function.
        ///          We can make sure the response is for a specific request like this.</summary>
        /// <param name="callback">callback function that actually handles the response. String parameters get passed in the order reqeustFromTag, requestToTag</param>
        /// <param name="requestFromTag">The from tag of the original request.</param>
        /// <param name="requestToTag">The to tag of the original request.</param>
        /// <returns></returns>
        /// <version date="19.03.2025" sb="MAC"></version>
        public static SIPTransportResponsetAsyncDelegate GetResponseListener(
            Func<SIPEndPoint, SIPEndPoint, SIPResponse, string?, string?, Task> callback,
            string? requestFromTag = null,
            string? requestToTag = null)
        {
            return (SIPEndPoint localEndPoint, SIPEndPoint remoteEndPoint, SIPResponse sipResponse) =>
            {
                return callback.Invoke(localEndPoint, remoteEndPoint, sipResponse, requestFromTag, requestToTag);
            };
        }

        private async Task OnMessageRecieved(SIPEndPoint localSIPEndPoint, SIPEndPoint remoteEndPoint, SIPResponse sipResponse)
        {
            // we can filter for current connection, but it should only recieve current connections anyway.
            this.SIPResponseReceived?.Invoke(localSIPEndPoint, remoteEndPoint, sipResponse);
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
                    headerParams.RemoteParticipant.Endpoint.Address,
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
                this.SIPScheme, // can the scheme differ for each participant?
                participant.Endpoint.Protocol);
        }

        public void Dispose()
        {
            this.Transport.Dispose();
        }
    }
}
