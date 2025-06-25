namespace Serilog.Sinks.LogList
{
    using Serilog;
    using Serilog.Configuration;
    using Serilog.Core;
    using Serilog.Events;
    using Serilog.Formatting;
    using Serilog.Formatting.Display;

    public static class SinkExtention
    {
        public static LoggerConfiguration LogList(
            this LoggerSinkConfiguration config,
            ICollection<string>? logList = null,
            IFormatProvider? formatProvider = null,
            string outputTemplate = "{Timestamp:dd.MM.yyyy HH:mm:ss} {Message:lj} {Exception}",
            LogEventLevel restrictedToMinimumLevel = LogEventLevel.Verbose,
            LoggingLevelSwitch levelSwitch = null,
            object? lockObject = null)
        {
            ITextFormatter textFormatter = new MessageTemplateTextFormatter(outputTemplate, formatProvider);
            return config.Sink(new LogList(textFormatter, logList, lockObject), restrictedToMinimumLevel, levelSwitch);
        }
    }
}
