using SIPSignalingServer.Models;
using SIPSignalingServer.Utils;
using SIPSorcery.SIP;
using System.Diagnostics;
using WebRTCLibrary.SIP;
using WebRTCLibrary.SIP.Models;

using static WebRTCLibrary.Utils.TaskHelpers;

namespace SIPSignalingServer.Dialogs
{
    internal class GeneralDialog : SIPDialog // ,IAsyncDisposable  
    {
        
        private bool Registered { get; set; }

        private ServerRegistrationDialog RegistrationDialog { get; set; }

        public GeneralDialog(
            SIPRequest request,
            SIPEndPoint signalingServer,
            SIPConnection connection,
            SIPRegistry registry) 
            :base(
                 sourceParticipant: GetRemoteParticipant(request, signalingServer),
                 remoteParticipant: GetCallerParticipant(request),
                 connection,
                 request.Header.CallId,
                 sourceTag: CallProperties.CreateNewTag(),
                 remoteTag: request.Header.From.FromTag)
        {
            this.RegistrationDialog = new ServerRegistrationDialog(
                initialRequest: request,
                remoteParticipant: this.SourceParticipant,
                clientParticipant: this.RemoteParticipant,
                connection: this.Connection,
                registry: registry,
                this.CallId,
                this.RemoteTag, // TODO: what to do if remote tag is not set?
                this.SourceTag!); // SourceTag gets generated while passing to base
        }

        public async override Task Start()
        {
            // TODO: Check somewhere if the request is valid.
            //       If not return some specific response or don't respond at all
            Debug.WriteLine($"Server received Register."); // DEBUG

            this.RegistrationDialog.OnRegistered += this.SuccessfullRegistrationListener;
            this.RegistrationDialog.OnRegistrationFailed += this.RegistrationFailedListener;

            await this.RegistrationDialog.Start();

            await WaitFor(
                () => this.Registered,
                timeOut: this.ReceiveTimeout,
                failureCallback: () => { }, // TODO: do something on timeout
                successCallback: () => { }); // TODO: start tunnel

            this.RegistrationDialog.OnRegistered -= this.SuccessfullRegistrationListener;
            this.RegistrationDialog.OnRegistrationFailed -= this.RegistrationFailedListener;
        }

        public override Task Stop()
        {
            throw new NotImplementedException();
        }

        private void SuccessfullRegistrationListener(ServerRegistrationDialog sender, RegistrationEventArgs e)
        {
            this.Registered = true;
        }
        
        private void RegistrationFailedListener(ServerRegistrationDialog sender, FailedRegistrationEventArgs e)
        {
            // TODO: Dispose on Registation fail / timeout
            this.Registered = false;
        }

        private static SIPParticipant GetCallerParticipant(SIPRequest request)
        {
            string name = request.Header.From.FromName;
            return new SIPParticipant(name, new SIPEndPoint(request.Header.From.FromURI));
        }

        private static SIPParticipant GetRemoteParticipant(SIPRequest request, SIPEndPoint signalingServer)
        {
            string name = request.Header.To.ToName;
            return new SIPParticipant(name, signalingServer);
        }
    }
}
