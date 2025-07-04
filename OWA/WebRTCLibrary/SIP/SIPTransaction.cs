using Microsoft.Extensions.Logging;
using SIPSorcery.SIP;
using WebRTCLibrary.SIP.Interfaces;
using WebRTCLibrary.SIP.Models;

namespace WebRTCLibrary.SIP
{
    public abstract class SIPTransaction : ISIPTransaction
    {
        private readonly ILogger<SIPTransaction> logger;

        protected object isRunningLock = new object();

        public virtual bool Running { get; protected set; }

        //private static readonly int DefaultTimeOut = 2000;
        private static readonly int DefaultTimeOut = 20000; // DEBUG

        public int ReceiveTimeout { get; set; } = DefaultTimeOut;

        public SIPSchemesEnum SIPScheme { get => this.Connection.SIPScheme; }

        private bool transportPassed = false;

        public TransactionParams Params { get; protected set; }

        public ISIPConnection Connection { get; private set; }
        
        public int CurrentCseq { get; protected set; }

        private int startCseq = 1;

        public virtual int StartCseq
        {
            get => this.startCseq;
            set
            {
                if (this.Running)
                {
                    throw new InvalidOperationException("StartCseq cannot be changed when the SIPTransaction is running.");
                }

                this.startCseq = value;
            }
        }

        protected CancellationTokenSource Cts { get; set; }

        protected CancellationToken Ct { get => this.Cts.Token; }

        public event ISIPTransaction.ConnectionLostDelegate? ConnectionLost;

        public event ISIPTransaction.TransactionStoppedDelegate? TransactionStopped;

        // TODO: maybe pass ConnectionFactory - for testing and different kinds of connections
        public SIPTransaction(SIPSchemesEnum sipScheme, ISIPTransport transport, TransactionParams dialogParams, ILoggerFactory loggerFactory)
            : this(new SIPConnection(sipScheme, transport, loggerFactory), dialogParams, loggerFactory)
        {
            this.transportPassed = true;
        }

        public SIPTransaction(ISIPConnection connection, TransactionParams dialogParams, ILoggerFactory loggerFactory)
        {
            this.logger = loggerFactory.CreateLogger<SIPTransaction>();

            this.Params = dialogParams;
            this.Connection = connection;
        }

        protected async virtual Task StartRunning()
        {
        }

        public async virtual Task Start(CancellationToken? ct = null)
        {
            lock (this.isRunningLock)
            {
                if (!this.CanStart())
                {
                    return;
                }

                this.SetInitalParametes(ct);
                this.Running = true;
            }

            await StartRunning();
        }

        public async virtual Task Stop()
        {
            lock (this.isRunningLock)
            {
                if (!this.CanStop())
                {
                    return;
                }

                this.StopRunning();
            }

            await this.Finish();
            await this.InvokeTransactionStopped();
        }

        protected async virtual Task Finish()
        {
        }

        protected virtual void StopRunning()
        {
            if (this.Running)
            {
                this.Cts.Cancel();
                this.Running = false;
            }
        }

        protected virtual SIPHeaderParams GetHeaderParams(int cSeq = 1) // TODO: make cseq nullable - default = current Cseq
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

        protected virtual void SetInitalParametes(CancellationToken? newCt)
        {
            this.CurrentCseq = this.StartCseq;
            this.Cts = newCt == null ? new CancellationTokenSource() : CancellationTokenSource.CreateLinkedTokenSource((CancellationToken)newCt);

            if (transportPassed)
            {
                this.Connection.MessagePredicate = this.AcceptMessage;
            }
        }

        protected virtual bool CanStart()
        {
            return !this.Running;
        }

        protected virtual bool CanStop()
        {
            return this.Running;
        }

        protected virtual async Task InvokeConnectionLost()
        {
            await (this.ConnectionLost?.Invoke(this) ?? Task.CompletedTask);
        }

        private async Task InvokeTransactionStopped()
        {
            await (this.TransactionStopped?.Invoke(this) ?? Task.CompletedTask);
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
