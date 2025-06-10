using Microsoft.Extensions.Logging;
using SIPSorcery.SIP;
using System.Net.Sockets;
using WebRTCLibrary.SIP.Interfaces;
using WebRTCLibrary.SIP.Models;
using WebRTCLibrary.SIP.Utils;
using static WebRTCLibrary.SIP.Interfaces.ISIPConnection;

namespace WebRTCLibrary.SIP
{
    public class SIPConnection : ISIPConnection
    {
        private readonly ILogger<SIPConnection> logger;

        public static readonly int defaultMessageTimeout = 2000;

        public int MessageTimeout { get; set; } = defaultMessageTimeout;

        //public delegate bool AcceptMessage(SIPMessageBase message);

        public AcceptMessage? MessagePredicate { get; set; }

        public SIPSchemesEnum SIPScheme { get; private set; }

        public ISIPTransport Transport { get; private set; }

        public event SIPTransportResponseAsyncDelegate? SIPResponseReceived;

        public event SIPTransportRequestAsyncDelegate? SIPRequestReceived;

        public SIPConnection(SIPSchemesEnum scheme, ISIPTransport transport, ILoggerFactory loggerFactory, AcceptMessage messagePredicate)
            :this(scheme, transport, loggerFactory)
        {
            this.MessagePredicate = messagePredicate;
        }

        public SIPConnection(SIPSchemesEnum scheme, ISIPTransport transport, ILoggerFactory loggerFactory)
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

            this.logger.LogDebug(
                ">> Sending {method} {cSeq} - to:'{to}'; from:\"{fromName}\" tag:\"{fromTag}\"; callId:\"{callId}\"",
                request.Method,
                request.Header.CSeq,
                request.Header.To,
                request.Header.From.FromName,
                request.Header.From.FromTag,
                request.Header.CallId);
            this.logger.LogTrace("payload: {payload}", request.Body);

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

            this.logger.LogDebug(
                ">> Sending {statusCode} {cSeq} - to:'{to}'; from:\"{fromName}\" tag:\"{fromTag}\"; callId:\"{callId}\"",
                response.StatusCode,
                response.Header.CSeq,
                response.Header.To,
                response.Header.From.FromName,
                response.Header.From.FromTag,
                response.Header.CallId);
            this.logger.LogTrace("payload: {payload}", response.Body);

            Task<SocketError> responseTask = this.Transport.SendResponseAsync(response); // TODO: Should we specify the endpoint? 
            return await this.WaitForSendConfirmation(responseTask, timeOut);
        }

        private async Task OnResponseRecieved(SIPEndPoint localSIPEndPoint, SIPEndPoint remoteEndPoint, SIPResponse sipResponse)
        {
            if (this.MessagePredicate?.Invoke(sipResponse) ?? true)
            {
                // we can filter for current connection, but it should only recieve current connections anyway.

                this.logger.LogDebug(
                    "<< Receiving {statusCode} {cSeq} - from:'{from}'; to:\"{toName}\" tag:\"{toTag}\"; callId:\"{callId}\"",
                    sipResponse.StatusCode,
                    sipResponse.Header.CSeq,
                    sipResponse.Header.From,
                    sipResponse.Header.To.ToName,
                    sipResponse.Header.To.ToTag,
                    sipResponse.Header.CallId);
                this.logger.LogTrace("payload: {payload}", sipResponse.Body);

                await (this.SIPResponseReceived?.Invoke(localSIPEndPoint, remoteEndPoint, sipResponse) ?? Task.CompletedTask);
            }
        }

        private async Task OnRequestRecieved(SIPEndPoint localSIPEndPoint, SIPEndPoint remoteEndPoint, SIPRequest sipRequest)
        {
            if (this.MessagePredicate?.Invoke(sipRequest) ?? true)
            {
                this.logger.LogDebug(
                    "<< Receiving {method} {cSeq} - from:'{from}'; to:\"{toName}\" tag:\"{toTag}\"; callId:\"{callId}\"",
                    sipRequest.Method,
                    sipRequest.Header.CSeq,
                    sipRequest.Header.From,
                    sipRequest.Header.To.ToName,
                    sipRequest.Header.To.ToTag,
                    sipRequest.Header.CallId);
                this.logger.LogTrace("payload: {payload}", sipRequest.Body);

                await (this.SIPRequestReceived?.Invoke(localSIPEndPoint, remoteEndPoint, sipRequest) ?? Task.CompletedTask);
            }
        }

        private async Task<SocketError> WaitForSendConfirmation(Task<SocketError> request, int? timeOut = null, uint retries = 0)
        {
            SocketError result = SocketError.SocketError; // always gets reassigned

            for(uint i = 0; i <= retries; i++)
            {
                timeOut ??= this.MessageTimeout;
                Task timeoutTask = Task.Delay((int)timeOut);

                if (await Task.WhenAny(request, timeoutTask) == request) 
                {
                    // Task completed within timeout.
                    // TODO: Consider that the task may have faulted or been canceled.
                    // We re-await the task so that any exceptions/cancellation is rethrown.

                    result = await request;
                    if (result == SocketError.Success)
                    {
                        //break;
                        return SocketError.Success;
                    }

                    this.logger.LogDebug("Sending failed. Error: {error}, try: {tryCount}", result, i+1);
                }
                else
                {
                    this.logger.LogDebug("Send timeout. try: {tryCount}", i + 1);
                    result = SocketError.TimedOut;
                }
            }

            this.logger.LogDebug("Sending failed no more retries. Error: {error}", result);
            return result;
        }
    }
}
