using SIPSorcery.SIP;
using System.Diagnostics;
using WebRTCLibrary.SIP;
using WebRTCLibrary.SIP.Models;

namespace SIPSignalingServer.Dialogs
{
    internal class GeneralDialog : SIPDialog // ,IAsyncDisposable  
    {
        private SIPEndPoint SignalingServer { get; set; }

        private ServerRegistrationDialog RegistrationDialog { get; set; }

        public GeneralDialog(
            SIPRequest request,
            SIPEndPoint signalingServer,
            SIPConnection connection,
            SIPRegisty registry) 
            :base(
                 sourceParticipant: GetRemoteParticipant(request),
                 remoteParticipant: GetCallerParticipant(request),
                 connection,
                 request.Header.CallId,
                 sourceTag: null,
                 remoteTag: request.Header.From.FromTag)
        {
            this.SignalingServer = signalingServer;
            
            // TODO: what to do if remote tag is not set?
            SIPParticipant SignalingServerAsRemote = new SIPParticipant(this.SourceParticipant.Name, signalingServer);
            this.RegistrationDialog = new ServerRegistrationDialog(
                request,
                SignalingServerAsRemote,
                this.RemoteParticipant,
                this.Connection,
                registry,
                this.CallId,
                this.RemoteTag);
        }

        public async override Task Start()
        {
            // TODO: Check somewhere if the request is valid.
            //       If not return some specific response or don't respond at all
            Debug.WriteLine($"Server received Register."); // DEBUG

            // TODO: Dispose on Registation fail / timeout
            await this.RegistrationDialog.Start();
        }

        public override Task Stop()
        {
            throw new NotImplementedException();
        }

        private static SIPParticipant GetCallerParticipant(SIPRequest request)
        {
            string name = request.Header.From.FromName;
            return new SIPParticipant(name, new SIPEndPoint(request.Header.From.FromURI));
        }

        private static SIPParticipant GetRemoteParticipant(SIPRequest request)
        {
            string name = request.Header.To.ToName;
            return new SIPParticipant(name, SIPEndPoint.Empty);
        }
    }
}
