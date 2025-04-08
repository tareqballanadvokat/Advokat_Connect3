using SIPSorcery.SIP;
using WebRTCLibrary.SIP.Models;

namespace WebRTCLibrary.SIP
{
    public abstract class SIPDialog
    {
        //private static readonly int DefaultTimeOut = 2000;
        private static readonly int DefaultTimeOut = 20000; // DEBUG

        private static readonly SIPSchemesEnum defaultSipScheme = SIPSchemesEnum.sip;

        public int SendTimeout { get; set; } = DefaultTimeOut;

        public int ReceiveTimeout { get; set; } = DefaultTimeOut;

        public SIPSchemesEnum SIPScheme { get; protected set; } = defaultSipScheme;

        public DialogParams Params { get; protected set; }


        public SIPConnection Connection { get; private set; }

        public SIPDialog(DialogParams dialogParams, SIPConnection connection)
        {
            this.Params = dialogParams;
            this.Connection = connection;
        }

        public abstract Task Start();

        public abstract Task Stop(); // ??

        protected virtual SIPHeaderParams GetHeaderParams(int cSeq = 1)
        {
            return new SIPHeaderParams(
                this.Params.SourceParticipant,
                this.Params.RemoteParticipant,
                fromTag: this.Params.SourceTag,
                toTag: this.Params.RemoteTag,
                cSeq: cSeq,
                callID: this.Params.CallId);
        }

        /// <summary>Checks if an incoming message is part of this dialog.</summary>
        /// <param name="message">Incoming SIPMessage. SIPRequest or SIPResponse.</param>
        /// <version date="21.03.2025" sb="MAC"></version>
        protected virtual bool IsPartOfDialog(SIPMessageBase message)
        {
            // TODO: check from / to participant
            bool callIdIsValid = this.Params.CallId == null || message.Header.CallId == this.Params.CallId;
            bool toTagIsValid = this.Params.SourceTag == null || message.Header.To.ToTag == this.Params.SourceTag;
            bool fromTagIsValid = this.Params.RemoteTag == null || message.Header.From.FromTag == this.Params.RemoteTag;

            return callIdIsValid && toTagIsValid && fromTagIsValid;
        }
    }
}
