using SIPSorcery.SIP;
using System.Net;
using WebRTCLibrary.SIP;
using WebRTCLibrary.SIP.Models;
using WebRTCLibrary.Utils;

using static WebRTCLibrary.Utils.TaskHelpers;


namespace WebRTCClient.Dialogs.ClientDialogs
{
    internal class ClientDialog : SIPDialog
    {
        public bool Registered { get => RegistrationDialog.Registered; }

        public bool Connected { get => this.ConnectionDialog?.Connected ?? false; }

        //public bool ConnectionPending { get => this.Registered && !this.Connected; }

        public override string? SourceTag { get => this.RegistrationDialog.SourceTag;}

        public override string? RemoteTag { get => this.RegistrationDialog.RemoteTag; }

        private ClientRegistrationDialog RegistrationDialog { get; set; }

        private ClientSIPConnectionDialog? ConnectionDialog { get; set; }

        public IPEndPoint SignalingServer { get; private set; }

        public ClientDialog(
            SIPParticipant sourceParticipant,
            SIPParticipant remoteParticipant,
            SIPTransport transport,
            SIPSchemesEnum sipScheme)
            : base(
                sourceParticipant: sourceParticipant,
                remoteParticipant: remoteParticipant,
                connection: new SIPConnection(sipScheme, transport))
        {
            this.Connection.MessagePredicate = this.IsPartOfDialog;

            this.RegistrationDialog = new ClientRegistrationDialog(this.SourceParticipant, this.RemoteParticipant, this.Connection, this.CallId);
            this.RegistrationDialog.SendTimeout = SendTimeout;
            this.RegistrationDialog.ReceiveTimeout = ReceiveTimeout;

            //RegistrationDialog.OnRegistered += RegistationSuccessful;
            //RegistrationManager.OnUnRegistered += OnUnRegistered;
        }

        public override async Task Start()
        {
            await this.RegistrationDialog.Start();

            await WaitForAsync(
                () => this.Registered,
                this.ReceiveTimeout, // TODO: Find suitable timeout for registration process
                successCallback: this.RegistationSuccessful,
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
            this.ConnectionDialog = new ClientSIPConnectionDialog(
                this.SourceParticipant,
                this.RemoteParticipant,
                this.Connection,
                this.CallId,
                this.SourceTag,
                this.RemoteTag);

            await this.ConnectionDialog.Start();

            await WaitFor(
                () => this.Connected,
                this.ReceiveTimeout // TODO: Get suitable timeout for connection - keep in mind to wait for remote to register have a timeout at all?
                );
        }
    }
}
