using SIPSignalingServer.Models;
using SIPSignalingServer.Utils.CustomEventArgs;
using SIPSorcery.SIP;
using System.Diagnostics;
using System.Diagnostics.CodeAnalysis;
using WebRTCLibrary.SIP;
using WebRTCLibrary.SIP.Models;

using static WebRTCLibrary.Utils.TaskHelpers;

namespace SIPSignalingServer.Dialogs
{
    internal class GeneralDialog : SIPDialog // ,IAsyncDisposable  
    {
        private bool Registered { get; set; }

        private bool Connected { get => this.ConnectionDialog?.Connected ?? false;}

        private SIPRequest InitialRequest {get; set;}

        private SIPRegistry Registry { get; set; }

        private ServerRegistrationDialog RegistrationDialog { get; set; }

        private SIPConnectionDialog? ConnectionDialog { get; set; }

        private SIPRegistration? CurrentRegistration { get; set; }

        // Signaling server acts as the remote participant
        private new SIPParticipant RemoteParticipant { get => this.SourceParticipant; }

        private SIPParticipant ClientParticipant { get => base.RemoteParticipant; }

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
            this.InitialRequest = request;
            this.Registry = registry;

            this.RegistrationDialog = new ServerRegistrationDialog(
                initialRequest: request,
                remoteParticipant: this.RemoteParticipant,
                clientParticipant: this.ClientParticipant,
                connection: this.Connection,
                registry: registry,
                this.CallId,
                this.RemoteTag, // TODO: what to do if remote tag is not set?
                this.SourceTag!); // SourceTag gets generated while passing to base
        }

        public async override Task Start()
        {
            if (this.InitialRequest.Method != SIPMethodsEnum.REGISTER)
            {
                // request was not a register request.
                // TODO: dispose this dialog / send event that it should be disposed
                return;
            }

            await this.Register();
        }

        public override Task Stop()
        {
            throw new NotImplementedException();
        }

        private async Task Register()
        {
            // TODO: Check somewhere if the request is valid.
            //       If not return some specific response or don't respond at all
            Debug.WriteLine($"Server received Register."); // DEBUG

            this.RegistrationDialog.OnRegistered += this.SuccessfullRegistrationListener;
            this.RegistrationDialog.OnRegistrationFailed += this.RegistrationFailedListener;

            await this.RegistrationDialog.Start();

            await WaitForAsync(
                () => this.Registered,
                timeOut: this.ReceiveTimeout,
                //failureCallback: Task.CompletedTask , // TODO: do something on timeout
                successCallback: this.Connect);

            this.RegistrationDialog.OnRegistered -= this.SuccessfullRegistrationListener;
            this.RegistrationDialog.OnRegistrationFailed -= this.RegistrationFailedListener;
        }

        private void SuccessfullRegistrationListener(ServerRegistrationDialog sender, RegistrationEventArgs e)
        {
            this.Registered = true;
            this.CurrentRegistration = e.Registration;
        }
        
        private void RegistrationFailedListener(ServerRegistrationDialog sender, FailedRegistrationEventArgs e)
        {
            // TODO: Dispose on Registation fail / timeout
            // TODO: Do something with 
            this.Registered = false;
            this.CurrentRegistration = null;
        }

        private async Task Connect()
        {
            if (!this.Registered)
            {
                return;
            }

            this.ConnectionDialog = new SIPConnectionDialog(
                this.Registry,
                this.CurrentRegistration!, // is not null if registered
                this.SourceParticipant,
                this.Connection,
                this.CallId,
                this.SourceTag,
                this.RemoteTag,
                startCSeq: 4);


            // Add listeners
            this.ConnectionDialog.OnConnectionFailed += this.OnConnectionFailed;

            CancellationTokenSource cts = new CancellationTokenSource(); // TODO: add some sort of timeout for connection?
            CancellationToken ct = cts.Token;
            // TODO pass ct to ConenctionDialog? Pass it deeper to KeepAliveDialog?

            await this.ConnectionDialog.Start();

            await WaitFor(() => this.Connected,
                ct,
                failureCallback: () => { }); // timeout - token got cancelled

            this.ConnectionDialog.OnConnectionFailed -= this.OnConnectionFailed;
        }

        //private void OnConnectionSuccessfull(SIPConnectionDialog sender)
        //{

        //}

        private void OnConnectionFailed(SIPConnectionDialog sender, FailureEventArgs e)
        {

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
