using SIPSorcery.SIP;
using WebRTCLibrary.SIP.Models;

namespace WebRTCLibrary.SIP
{
    public abstract class SIPDialog
    {
        //private static readonly int DefaultTimeOut = 2000;
        private static readonly int DefaultTimeOut = 20000; // DEBUG


        public int SendTimeout { get; set; } = DefaultTimeOut;

        public int ReceiveTimeout { get; set; } = DefaultTimeOut;

        //public SIPSchemesEnum SIPScheme { get; private set; }

        public SIPParticipant SourceParticipant { get; private set; }

        public SIPParticipant RemoteParticipant { get; private set; }

        public string? SourceTag { get; set; }

        public string? RemoteTag { get; set; }

        public string CallId { get; private set; }

        public SIPConnection Connection { get; private set; }

        public SIPDialog(
            SIPParticipant sourceParticipant,
            SIPParticipant remoteParticipant,
            //SIPParticipant signalingServer,
            SIPConnection connection,
            string? callId = null,
            string? sourceTag = null,
            string? remoteTag = null)
        {
            SourceParticipant = sourceParticipant;
            RemoteParticipant = remoteParticipant;
            Connection = connection;
            CallId = callId ?? CallProperties.CreateNewCallId();
            SourceTag = sourceTag;
            RemoteTag = remoteTag;
        }

        public abstract Task Start();

        public abstract Task Stop(); // ??

        protected virtual SIPHeaderParams GetHeaderParams(int cSeq = 1)
        {
            return new SIPHeaderParams(
                this.SourceParticipant,
                this.RemoteParticipant,
                fromTag: this.SourceTag,
                toTag: this.RemoteTag,
                cSeq: cSeq,
                callID: this.CallId);
        }

        /// <summary>Checks if an incoming message is part of this dialog.</summary>
        /// <param name="message">Incoming SIPMessage. SIPRequest or SIPResponse.</param>
        /// <version date="21.03.2025" sb="MAC"></version>
        protected virtual bool IsPartOfDialog(SIPMessageBase message)
        {
            return message.Header.CallId == this.CallId
                && message.Header.To.ToTag == this.SourceTag
                && message.Header.From.FromTag == this.RemoteTag;
        }
    }
}
