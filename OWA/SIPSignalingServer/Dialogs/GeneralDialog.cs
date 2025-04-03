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
    internal class GeneralDialog : ServerSideSIPDialog // ,IAsyncDisposable  
    {
        private bool Registered { get => this.RegistrationDialog.Registered; }

        private bool Connected { get => this.ConnectionDialog?.Connected ?? false;}

        private SIPRequest InitialRequest {get; set;}

        private SIPRegistry Registry { get; set; }

        private ServerRegistrationDialog RegistrationDialog { get; set; }

        private SIPConnectionDialog? ConnectionDialog { get; set; }

        public GeneralDialog(SIPRequest initialRequest, SIPEndPoint signalingServer, SIPTransport transport, SIPRegistry registry)
            : base(
                 new ServerSideDialogParams(
                     GetRemoteParticipant(initialRequest, signalingServer),
                     GetCallerParticipant(initialRequest),
                     sourceTag: CallProperties.CreateNewTag(),
                     remoteTag: initialRequest.Header.From.FromTag, // TODO: What if request does not contain a tag?
                     callId: initialRequest.Header.CallId),

                 // TODO: get sipscheme passed or from request
                 connection: new SIPConnection(SIPSchemesEnum.sip, transport)
            )
        {
            this.Connection.MessagePredicate = this.IsPartOfDialog;
            this.Connection.MessageTimeout = this.SendTimeout;

            this.InitialRequest = initialRequest;
            this.Registry = registry;

            this.RegistrationDialog = new ServerRegistrationDialog(initialRequest, this.Params, this.Connection, this.Registry);
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

            //this.RegistrationDialog.OnRegistered += this.SuccessfullRegistrationListener;
            this.RegistrationDialog.OnRegistrationFailed += this.RegistrationFailedListener;

            await this.RegistrationDialog.Start();

            await WaitForAsync(
                () => this.Registered,
                timeOut: this.ReceiveTimeout,
                //failureCallback: Task.CompletedTask , // TODO: do something on timeout
                successCallback: this.Connect);

            //this.RegistrationDialog.OnRegistered -= this.SuccessfullRegistrationListener;
            this.RegistrationDialog.OnRegistrationFailed -= this.RegistrationFailedListener;
        }

        //private void SuccessfullRegistrationListener(ServerRegistrationDialog sender, RegistrationEventArgs e)
        //{
        //    this.Registered = true;
        //    this.CurrentRegistration = e.Registration;
        //}

        private void RegistrationFailedListener(ServerRegistrationDialog sender, FailedRegistrationEventArgs e)
        {
            // TODO: Dispose on Registation fail / timeout
            //       Stop waiting for registration
            //this.Registered = false;
            //this.CurrentRegistration = null;
        }

        private async Task Connect()
        {            
            this.ConnectionDialog = new SIPConnectionDialog(this.Params, this.Connection, this.Registry, startCSeq: 4);

            // Add listeners
            this.ConnectionDialog.OnConnectionFailed += this.ConnectionFailedListener;

            CancellationTokenSource cts = new CancellationTokenSource(); // TODO: add some sort of timeout for connection?
            CancellationToken ct = cts.Token;
            // TODO pass ct to ConenctionDialog? Pass it deeper to KeepAliveDialog?

            await this.ConnectionDialog.Start();

            await WaitFor(() => this.Connected,
                ct,
                failureCallback: () => { }); // timeout - token got cancelled

            this.ConnectionDialog.OnConnectionFailed -= this.ConnectionFailedListener;
        }

        //private void OnConnectionSuccessfull(SIPConnectionDialog sender)
        //{

        //}

        private void ConnectionFailedListener(SIPConnectionDialog sender, FailureEventArgs e)
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
