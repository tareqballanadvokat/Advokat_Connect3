using SIPSorcery.SIP;
using System.Diagnostics.CodeAnalysis;
using System.Net;
using System.Net.Sockets;
using WebRTCLibrary.SIP;
using WebRTCLibrary.SIP.Models;

using static WebRTCLibrary.Utils.TaskHelpers;


namespace WebRTCClient.Transactions.SIP
{
    internal class SIPDialog : WebRTCLibrary.SIP.SIPTransaction, ISIPMessager
    {
        public event ISIPMessager.RequestReceivedDelegate? OnRequestReceived;

        public event ISIPMessager.ResponseReceivedDelegate? OnResponseReceived;

        public bool Registered { get => SIPRegistrationTransaction.Registered; }

        [MemberNotNullWhen(true, nameof(SIPConnectionTransaction))]
        public bool Connected { get => SIPConnectionTransaction?.Connected ?? false; }

        private SIPRegistrationTransaction SIPRegistrationTransaction { get; set; }

        private SIPConnectionTransaction? SIPConnectionTransaction { get; set; }

        private SIPKeepAlive SIPKeepAlive { get; set; }

        private SIPTransport Transport { get; set; }

        //public IPEndPoint SignalingServer { get; private set; }

        public SIPDialog(SIPSchemesEnum sipScheme, SIPTransport transport, SIPParticipant sourceParticipant, SIPParticipant remoteParticipant)
            : base(
                  sipScheme,
                  transport,
                  new TransactionParams(sourceParticipant, remoteParticipant, callId:CallProperties.CreateNewCallId()))
        {
            SIPRegistrationTransaction = new SIPRegistrationTransaction(Connection, Params);
            SIPKeepAlive = new SIPKeepAlive(Connection, Params);

            SIPRegistrationTransaction.SendTimeout = SendTimeout;
            SIPRegistrationTransaction.ReceiveTimeout = ReceiveTimeout;

            Transport = transport;
        }

        public override async Task Start()
        {
            await SIPRegistrationTransaction.Start();

            await WaitForAsync(
                () => Registered,
                ReceiveTimeout, // TODO: Find suitable timeout for registration process
                successCallback: RegistationSuccessful,
                failureCallback: async () => { }); // TODO: what to do on registering failure / timeout
        }

        public override async Task Stop()
        {
            // TODO: assign new callId? Otherwise we could get another start with the same call id
            //await this.RegistrationDialog.Stop();
            throw new NotImplementedException();
        }

        private async Task RegistationSuccessful()
        {
            TransactionParams dialogParams = new TransactionParams(
                Params.SourceParticipant,
                Params.RemoteParticipant,
                sourceTag: Params.SourceTag);

            SIPConnectionTransaction = new SIPConnectionTransaction(SIPScheme, Transport, dialogParams);

            SIPConnectionTransaction.OnRequestReceived += RequestRecieved;
            SIPConnectionTransaction.OnResponseReceived += ResponseRecieved;

            await SIPConnectionTransaction.Start();
            await SIPKeepAlive.Start(); // TODO: stop dialog on stop / unregister

            await WaitFor(
                () => Connected,
                ReceiveTimeout // TODO: Get suitable timeout for connection - keep in mind to wait for remote to register. have a timeout at all?
                               // TODO: failed?
                );
        }

        public async Task<SocketError> SendRequest(SIPMethodsEnum method, string message, string contentType, int cSeq)
        {
            if (!Connected)
            {
                return SocketError.NotConnected;
            }

            return await SIPConnectionTransaction.SendRequest(method, message, contentType, cSeq);
        }

        public async Task<SocketError> SendResponse(SIPResponseStatusCodesEnum statusCode, string message, string contentType, int cSeq)
        {
            if (!Connected)
            {
                return SocketError.NotConnected;
            }

            return await SIPConnectionTransaction.SendResponse(statusCode, message, contentType, cSeq);
        }

        private async Task RequestRecieved(ISIPMessager sender, SIPRequest sipRequest)
        {
            await (OnRequestReceived?.Invoke(this, sipRequest) ?? Task.CompletedTask);
        }

        private async Task ResponseRecieved(ISIPMessager sender, SIPResponse sipResponse)
        {
            await (OnResponseReceived?.Invoke(this, sipResponse) ?? Task.CompletedTask);
        }
    }
}
