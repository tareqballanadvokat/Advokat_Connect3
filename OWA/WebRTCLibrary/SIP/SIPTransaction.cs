using Microsoft.Extensions.Logging;
using SIPSorcery.SIP;
using WebRTCLibrary.Interfaces;
using WebRTCLibrary.SIP.Models;

namespace WebRTCLibrary.SIP
{
    public abstract class SIPTransaction
    {
        private readonly ILogger<SIPTransaction> logger;

        //private static readonly int DefaultTimeOut = 2000;
        private static readonly int DefaultTimeOut = 20000; // DEBUG

        private int sendTimeout = DefaultTimeOut;

        public int SendTimeout
        {
            get => this.sendTimeout;
            set
            {
                this.sendTimeout = value;
                this.Connection.MessageTimeout = this.SendTimeout;
            }
        }

        public int ReceiveTimeout { get; set; } = DefaultTimeOut;

        public SIPSchemesEnum SIPScheme { get => this.Connection.SIPScheme; }

        public TransactionParams Params { get; protected set; }

        public ISIPConnection Connection { get; private set; }

        // TODO: maybe pass ConnectionFactory - for testing and different kinds of connections
        public SIPTransaction(SIPSchemesEnum sipScheme, ISIPTransport transport, TransactionParams dialogParams, ILoggerFactory loggerFactory)
            : this(new SIPConnection(sipScheme, transport, loggerFactory), dialogParams, loggerFactory)
        {
            this.Connection.MessagePredicate = this.AcceptMessage;
            this.Connection.MessageTimeout = this.SendTimeout;
        }

        public SIPTransaction(ISIPConnection connection, TransactionParams dialogParams, ILoggerFactory loggerFactory)
        {
            this.logger = loggerFactory.CreateLogger<SIPTransaction>();

            this.Params = dialogParams;
            this.Connection = connection;
        }

        // TODO: remove completely - remplace with start with a ct
        public async virtual Task Start() { }

        // TODO: make abstract
        public async virtual Task Start(CancellationToken? ct = null) { }


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

        protected virtual bool AcceptMessage(SIPMessageBase message)
        {
            return this.IsPartOfTransaction(message);
        }

        /// <summary>Checks if an incoming message is part of this dialog.</summary>
        /// <param name="message">Incoming SIPMessage. SIPRequest or SIPResponse.</param>
        /// <version date="21.03.2025" sb="MAC"></version>
        private bool IsPartOfTransaction(SIPMessageBase message)
        {
            // TODO: check from / to participant
            bool callIdIsValid = this.Params.CallId == null || message.Header.CallId == this.Params.CallId;
            bool toTagIsValid = this.Params.SourceTag == null || message.Header.To.ToTag == this.Params.SourceTag;
            bool fromTagIsValid = this.Params.RemoteTag == null || message.Header.From.FromTag == this.Params.RemoteTag;

            return callIdIsValid && toTagIsValid && fromTagIsValid;
        }
    }
}
