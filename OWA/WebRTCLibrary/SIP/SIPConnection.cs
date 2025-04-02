using SIPSorcery.SIP;
using System.Net.Sockets;
using WebRTCLibrary.SIP.Models;
using WebRTCLibrary.SIP.Utils;

namespace WebRTCLibrary.SIP
{
    public class SIPConnection : IDisposable
    {
        public int MessageTimeout = 2000;

        public SIPSchemesEnum SIPScheme { get; private set; }

        public SIPTransport Transport { get; private set; }

        public event SIPTransportResponseAsyncDelegate? SIPResponseReceived;

        public event SIPTransportRequestAsyncDelegate? SIPRequestReceived;

        // TODO: Maybe pass callId and tags / create another wrapping classs - only fire events when response/request is part of the dialog
        public SIPConnection(SIPSchemesEnum scheme, SIPTransport transport)
        {
            SIPScheme = scheme;
            Transport = transport;
            this.Transport.SIPTransportResponseReceived += this.OnResponseRecieved;
            this.Transport.SIPTransportRequestReceived += this.OnRequestRecieved;
        }

        public async Task<SocketError> SendSIPRequest(SIPMethodsEnum method, SIPHeaderParams headerParams, string? message = null, CancellationToken? ct = null, int? timeOut = null)
        {
            // TODO: Make ct Mandatory

            SIPRequest request = SIPHelper.GetRequest(this.SIPScheme, method, headerParams, message);
            return await this.SendSIPRequest(request, ct, timeOut);
        }

        public async Task<SocketError> SendSIPRequest(SIPRequest request, CancellationToken? ct = null, int ? timeOut = null)
        {
            // TODO: Make ct Mandatory

            Task<SocketError> requestTask = this.Transport.SendRequestAsync(request);
            return await this.WaitForSendConfirmation(requestTask, timeOut);
        }

        //public async Task<SocketError> SendSIPResponse(SIPResponseStatusCodesEnum statusCode, SIPHeaderParams headerParams, string? message = null, CancellationToken? ct = null, int? timeOut = null)
        //{
        //    // TODO: Make ct Mandatory

        //    SIPResponse response = SIPHelper.GetResponse(this.SIPScheme, statusCode, headerParams, message);
        //    return await this.SendSIPResponse(response, ct, timeOut);
        //}

        public async Task<SocketError> SendSIPResponse(SIPResponse response, CancellationToken? ct = null, int? timeOut = null)
        {
            // TODO: Make ct Mandatory

            Task<SocketError> responseTask = this.Transport.SendResponseAsync(response);
            return await this.WaitForSendConfirmation(responseTask, timeOut);
        }

        ///// <summary>Returns an eventlistener for incoming responses that gets passed previous assigned tags.
        /////          This is useful to compare the tags of the response and the previous request in the callback function.
        /////          We can make sure the response is for a specific request like this.</summary>
        ///// <param name="callback">callback function that actually handles the response. String parameters get passed in the order reqeustFromTag, requestToTag</param>
        ///// <param name="requestFromTag">The from tag of the original request.</param>
        ///// <param name="requestToTag">The to tag of the original request.</param>
        ///// <returns></returns>
        ///// <version date="19.03.2025" sb="MAC"></version>
        //public static SIPTransportResponseAsyncDelegate GetResponseListener(
        //    Func<SIPEndPoint, SIPEndPoint, SIPResponse, string?, string?, Task> callback,
        //    string? requestFromTag = null,
        //    string? requestToTag = null)
        //{
        //    return (SIPEndPoint localEndPoint, SIPEndPoint remoteEndPoint, SIPResponse sipResponse) =>
        //    {
        //        return callback.Invoke(localEndPoint, remoteEndPoint, sipResponse, requestFromTag, requestToTag);
        //    };
        //}

        ///// <summary>Returns an eventlistener for incoming requests that gets passed previous assigned tags.
        /////          This is useful to compare the tags of the request and the previous request in the callback function.
        /////          We can make sure the request is part of a specific dialog like this.</summary>
        ///// <param name="callback">callback function that actually handles the request. Tag parameters get passed in the order fromTag, toTag</param>
        ///// <param name="requestFromTag">The from tag of the original request.</param>
        ///// <param name="requestToTag">The to tag of the original request.</param>
        ///// <returns></returns>
        ///// <version date="19.03.2025" sb="MAC"></version>
        //public static SIPTransportRequestAsyncDelegate GetRequestListener(
        //    Func<SIPEndPoint, SIPEndPoint, SIPRequest, string?, string?, Task> callback,
        //    string? fromTag = null,
        //    string? toTag = null)
        //{
        //    return (SIPEndPoint localEndPoint, SIPEndPoint remoteEndPoint, SIPRequest sipRequest) =>
        //    {
        //        return callback.Invoke(localEndPoint, remoteEndPoint, sipRequest, fromTag, toTag);
        //    };
        //}

        private async Task OnResponseRecieved(SIPEndPoint localSIPEndPoint, SIPEndPoint remoteEndPoint, SIPResponse sipResponse)
        {
            // we can filter for current connection, but it should only recieve current connections anyway.
            this.SIPResponseReceived?.Invoke(localSIPEndPoint, remoteEndPoint, sipResponse);
        }

        private async Task OnRequestRecieved(SIPEndPoint localSIPEndPoint, SIPEndPoint remoteEndPoint, SIPRequest sipRequest)
        {
            // we can filter for current connection, but it should only recieve current connections anyway.
            this.SIPRequestReceived?.Invoke(localSIPEndPoint, remoteEndPoint, sipRequest);
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

 
        //private SIPRequest GetRequest(SIPMethodsEnum method, SIPHeaderParams headerParams, string? message = null)
        //{
        //    // branch?
        //    SIPRequest request = SIPRequest.GetRequest(
        //        method,
        //        new SIPURI(
        //            this.SIPScheme,
        //            headerParams.DestinationParticipant.Endpoint.Address,
        //            headerParams.DestinationParticipant.Endpoint.Port));

        //    SIPURI FromUri = this.GetSIPURIFor(headerParams.SourceParticipant);
        //    SIPURI ToUri = this.GetSIPURIFor(headerParams.DestinationParticipant);

        //    request.Header.From = new SIPFromHeader(headerParams.SourceParticipant.Name, FromUri, headerParams.FromTag);
        //    request.Header.To = new SIPToHeader(headerParams.DestinationParticipant.Name, ToUri, headerParams.ToTag);
        //    request.Header.CSeq = headerParams.CSeq;
        //    request.Header.CallId = headerParams.CallID;
        //    //request.Header.MaxForwards = 70; // 70 is an arbitrary number

        //    // TODO: add message
        //    //request.Body = "";
        //    //request.Header.Contact = new List<SIPContactHeader> { new SIPContactHeader(null, new SIPURI(SIPScheme, this.SourceParticipant.Endpoint)) };

        //    return request;
        //}

        //private SIPResponse GetResponse(SIPResponseStatusCodesEnum statusCode, SIPHeaderParams headerParams, string? message = null)
        //{
        //    // branch?
        //    SIPResponse response = SIPResponse.GetResponse(
        //        headerParams.SourceParticipant.Endpoint,
        //        headerParams.DestinationParticipant.Endpoint,
        //        statusCode,
        //        message);
        //    //new SIPURI(
        //    //    this.SIPScheme,
        //    //    headerParams.RemoteParticipant.Endpoint.Address,
        //    //    headerParams.RemoteParticipant.Endpoint.Port));

        //    //SIPURI FromUri = this.GetSIPURIFor(headerParams.SourceParticipant);
        //    //SIPURI ToUri = this.GetSIPURIFor(headerParams.RemoteParticipant);

        //    //request.Header.From = new SIPFromHeader(headerParams.SourceParticipant.Name, FromUri, headerParams.FromTag);
        //    //request.Header.To = new SIPToHeader(headerParams.RemoteParticipant.Name, ToUri, headerParams.ToTag);
        //    response.Header.CSeq = headerParams.CSeq;
        //    response.Header.CallId = headerParams.CallID;

        //    return response;
        //}


        //private SIPURI GetSIPURIFor(SIPParticipant participant, string? paramsAndHeaders = null)
        //{
        //    return new SIPURI(
        //        participant.Name,
        //        participant.Endpoint.GetIPEndPoint().ToString(),
        //        paramsAndHeaders,
        //        this.SIPScheme, // can the scheme differ for each participant?
        //        participant.Endpoint.Protocol);
        //}

        public void Dispose()
        {
            // TODO: should we even do this here?
            this.Transport.Dispose();
        }
    }
}
