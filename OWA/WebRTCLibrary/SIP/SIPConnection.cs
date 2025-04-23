using Microsoft.Extensions.Logging;
using SIPSorcery.SIP;
using System.Net.Sockets;
using WebRTCLibrary.SIP.Models;
using WebRTCLibrary.SIP.Utils;

namespace WebRTCLibrary.SIP
{
    public class SIPConnection
    {
        private readonly ILogger<SIPConnection> logger;

        public static readonly int defaultMessageTimeout = 2000;

        public int MessageTimeout { get; set; } = defaultMessageTimeout;

        public delegate bool AcceptMessage(SIPMessageBase message);

        public AcceptMessage? MessagePredicate { get; set; }

        public SIPSchemesEnum SIPScheme { get; private set; }

        public SIPTransport Transport { get; private set; }

        public event SIPTransportResponseAsyncDelegate? SIPResponseReceived;

        public event SIPTransportRequestAsyncDelegate? SIPRequestReceived;

        public SIPConnection(SIPSchemesEnum scheme, SIPTransport transport, ILoggerFactory loggerFactory, AcceptMessage messagePredicate)
            :this(scheme, transport, loggerFactory)
        {
            this.MessagePredicate = messagePredicate;
        }

        public SIPConnection(SIPSchemesEnum scheme, SIPTransport transport, ILoggerFactory loggerFactory)
        {
            this.logger = loggerFactory.CreateLogger<SIPConnection>();

            this.SIPScheme = scheme;
            this.Transport = transport;
            this.Transport.SIPTransportResponseReceived += this.OnResponseRecieved;
            this.Transport.SIPTransportRequestReceived += this.OnRequestRecieved;
        }

        public async Task<SocketError> SendSIPRequest(SIPMethodsEnum method, SIPHeaderParams headerParams, CancellationToken ct, int? timeOut = null)
        {
            SIPRequest request = SIPHelper.GetRequest(this.SIPScheme, method, headerParams);
            return await this.SendSIPRequest(request, ct, timeOut);
        }

        public async Task<SocketError> SendSIPRequest(
            SIPMethodsEnum method,
            SIPHeaderParams headerParams,
            string message,
            string contentType,
            CancellationToken ct,
            int? timeOut = null)
        {
            SIPRequest request = SIPHelper.GetRequest(this.SIPScheme, method, headerParams, message, contentType);
            return await this.SendSIPRequest(request, ct, timeOut);
        }

        public async Task<SocketError> SendSIPRequest(SIPRequest request, CancellationToken ct, int ? timeOut = null)
        {
            ct.ThrowIfCancellationRequested();
            this.logger.LogTrace("Sending {method} request. to:'{to}', from: '{from}', payload: '{payload}'.", request.Method, request.Header.To, request.Header.From, request.Body);

            Task<SocketError> requestTask = this.Transport.SendRequestAsync(request);
            return await this.WaitForSendConfirmation(requestTask, timeOut);
        }

        public async Task<SocketError> SendSIPResponse(SIPResponseStatusCodesEnum statusCode, SIPHeaderParams headerParams, CancellationToken ct, int? timeOut = null)
        {
            SIPResponse response = SIPHelper.GetResponse(this.SIPScheme, statusCode, headerParams);
            return await this.SendSIPResponse(response, ct, timeOut);
        }

        public async Task<SocketError> SendSIPResponse(
            SIPResponseStatusCodesEnum statusCode,
            SIPHeaderParams headerParams,
            string message,
            string contentType,
            CancellationToken ct,
            int? timeOut = null)
        {
            SIPResponse response = SIPHelper.GetResponse(this.SIPScheme, statusCode, headerParams, message, contentType);
            return await this.SendSIPResponse(response, ct, timeOut);
        }

        public async Task<SocketError> SendSIPResponse(SIPResponse response, CancellationToken ct, int? timeOut = null)
        {
            ct.ThrowIfCancellationRequested();
            this.logger.LogTrace("Sending {statuscode} response. to:'{to}', from: '{from}', payload: '{payload}'.", response.StatusCode, response.Header.To, response.Header.From, response.Body);

            Task<SocketError> responseTask = this.Transport.SendResponseAsync(response); // TODO: Should we specify the endpoint? 
            return await this.WaitForSendConfirmation(responseTask, timeOut);
        }

        private async Task OnResponseRecieved(SIPEndPoint localSIPEndPoint, SIPEndPoint remoteEndPoint, SIPResponse sipResponse)
        {
            if (this.MessagePredicate?.Invoke(sipResponse) ?? true)
            {
                // we can filter for current connection, but it should only recieve current connections anyway.
                this.logger.LogTrace("Response received {statuscode}. to:'{to}', from: '{from}', payload: '{payload}'.", sipResponse.StatusCode, sipResponse.Header.To, sipResponse.Header.From, sipResponse.Body);

                await (this.SIPResponseReceived?.Invoke(localSIPEndPoint, remoteEndPoint, sipResponse) ?? Task.CompletedTask);
            }
        }

        private async Task OnRequestRecieved(SIPEndPoint localSIPEndPoint, SIPEndPoint remoteEndPoint, SIPRequest sipRequest)
        {
            if (this.MessagePredicate?.Invoke(sipRequest) ?? true)
            {
                this.logger.LogTrace("Request received {method}. to:'{to}', from: '{from}', payload: '{payload}'.", sipRequest.Method, sipRequest.Header.To, sipRequest.Header.From, sipRequest.Body);
                await (this.SIPRequestReceived?.Invoke(localSIPEndPoint, remoteEndPoint, sipRequest) ?? Task.CompletedTask);
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
    }
}
