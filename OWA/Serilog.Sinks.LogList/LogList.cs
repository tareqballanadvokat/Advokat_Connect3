namespace Serilog.Sinks.LogList
{
    using System.IO;
    using Serilog.Core;
    using Serilog.Events;
    using Serilog.Formatting;

    public class LogList : ILogEventSink
    {
        private readonly ITextFormatter _formatter;

        private object lockObject;

        public ICollection<string> Logs { get; }

        public LogList(ITextFormatter formatter, ICollection<string>? logs = null, object? lockObject = null)
        {
            this.Logs = logs ?? [];
            this._formatter = formatter;
            this.lockObject = lockObject ?? new();
        }

        public void Emit(LogEvent logEvent)
        {
            using StringWriter stringWriter = new StringWriter();
            this._formatter.Format(logEvent, stringWriter);

            lock (this.lockObject)
            {
                this.Logs.Add(stringWriter.ToString());
            }
        }
    }
}
