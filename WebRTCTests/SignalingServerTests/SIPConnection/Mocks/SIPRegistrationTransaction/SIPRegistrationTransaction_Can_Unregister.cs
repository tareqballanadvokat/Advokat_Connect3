using SIPSignalingServer.Models;
using SIPSignalingServer.Transactions.Interfaces;
using SIPSorcery.SIP;
using WebRTCLibrary.SIP;
using WebRTCLibrary.SIP.Interfaces;
using WebRTCLibrary.SIP.Models;

namespace SignalingServerTests.SIPConnection.Mocks.SIPRegistrationTransaction
{
    internal class SIPRegistrationTransaction_Can_Unregister : ISIPRegistrationTransaction
    {
        public bool Registered { get; set; } = true;

        public ServerSideTransactionParams Params { get; set; }

        public ISIPConnection Connection => throw new NotImplementedException();

        public SIPSchemesEnum SIPScheme => throw new NotImplementedException();

        TransactionParams ISIPTransaction.Params => Params;

        public bool Running => throw new NotImplementedException();

        public int CurrentCseq => 4;

        public int StartCseq { get => throw new NotImplementedException(); set => throw new NotImplementedException(); }
        public SIPConfig Config { get; set; }

        public SIPRegistrationTransaction_Can_Unregister(
            SIPRequest initialRequest,
            SIPEndPoint signalingServer)
        {
            this.Params = GetParamsFromRequest(initialRequest, signalingServer);
        }

        public event ISIPRegistrationTransaction.RegistrationFailedDelegate? OnRegistrationFailed;
        public event ISIPTransaction.ConnectionLostDelegate? ConnectionLost;
        public event ISIPTransaction.TransactionStoppedDelegate? TransactionStopped;

        public async Task Start(CancellationToken? ct = null)
        {
        }

        public async Task Unregister()
        {
            this.Registered = false;
        }

        public async Task Stop()
        {
            this.Registered = false;
        }

        private static SIPParticipant GetCallerParticipant(SIPRequest request)
        {
            string name = request.Header.From.FromName;
            return new SIPParticipant(name, request.RemoteSIPEndPoint);
        }

        private static SIPParticipant GetRemoteParticipant(SIPRequest request, SIPEndPoint signalingServer)
        {
            string name = request.Header.To.ToName;
            return new SIPParticipant(name, signalingServer);
        }

        private static ServerSideTransactionParams GetParamsFromRequest(SIPRequest request, SIPEndPoint signalingServer)
        {
            return new ServerSideTransactionParams(
                GetRemoteParticipant(request, signalingServer),
                GetCallerParticipant(request),
                remoteTag: CallProperties.CreateNewTag(),
                clientTag: request.Header.From.FromTag, // TODO: What if request does not contain a tag?
                callId: request.Header.CallId);
        }
    }
}
