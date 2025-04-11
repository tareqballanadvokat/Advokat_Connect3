using SIPSorcery.SIP;
using System.Net.Sockets;
using WebRTCLibrary.SIP.Models;
using WebRTCLibrary.SIP.Utils;

namespace WebRTCLibrary.SIP
{
    public class SIPConnection // : IDisposable
    {
        public static readonly int defaultMessageTimeout = 2000;

        public int MessageTimeout { get; set; } = defaultMessageTimeout;

        public delegate bool AcceptMessage(SIPMessageBase message);

        public AcceptMessage? MessagePredicate { get; set; }

        public SIPSchemesEnum SIPScheme { get; private set; }

        public SIPTransport Transport { get; private set; }

        public event SIPTransportResponseAsyncDelegate? SIPResponseReceived;

        public event SIPTransportRequestAsyncDelegate? SIPRequestReceived;

        public SIPConnection(SIPSchemesEnum scheme, SIPTransport transport, AcceptMessage? messagePredicate = null)
        {
            this.MessagePredicate = messagePredicate;
            this.SIPScheme = scheme;
            this.Transport = transport;
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

        public async Task<SocketError> SendSIPResponse(SIPResponseStatusCodesEnum statusCode, SIPHeaderParams headerParams, string? message = null, CancellationToken? ct = null, int? timeOut = null)
        {
            // TODO: Make ct Mandatory

            SIPResponse response = SIPHelper.GetResponse(this.SIPScheme, statusCode, headerParams, message);
            return await this.SendSIPResponse(response, ct, timeOut);
        }

        public async Task<SocketError> SendSIPResponse(SIPResponse response, CancellationToken? ct = null, int? timeOut = null)
        {
            // TODO: Make ct Mandatory

            Task<SocketError> responseTask = this.Transport.SendResponseAsync(response);
            return await this.WaitForSendConfirmation(responseTask, timeOut);
        }

        private async Task OnResponseRecieved(SIPEndPoint localSIPEndPoint, SIPEndPoint remoteEndPoint, SIPResponse sipResponse)
        {
            if (this.MessagePredicate?.Invoke(sipResponse) ?? true)
            {
                // we can filter for current connection, but it should only recieve current connections anyway.
                this.SIPResponseReceived?.Invoke(localSIPEndPoint, remoteEndPoint, sipResponse);
            }
        }

        private async Task OnRequestRecieved(SIPEndPoint localSIPEndPoint, SIPEndPoint remoteEndPoint, SIPRequest sipRequest)
        {
            if (this.MessagePredicate?.Invoke(sipRequest) ?? true)
            {
                // we can filter for current connection, but it should only recieve current connections anyway.
                this.SIPRequestReceived?.Invoke(localSIPEndPoint, remoteEndPoint, sipRequest);
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

        //public void Dispose()
        //{
        //    // TODO: should we even do this here?
        //    this.Transport.Dispose();
        //}
    }
}
