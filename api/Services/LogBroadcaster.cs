using System.Collections.Concurrent;
using System.Threading.Channels;

namespace Api.Services;

public sealed record LogEntry(
    string Level,
    string Category,
    string Message,
    DateTimeOffset Timestamp
);

/// <summary>
/// Captures log entries from the ASP.NET Core logging pipeline and broadcasts
/// them to connected SSE subscribers. Register as both an ILoggerProvider and
/// a singleton service so it can be injected into route handlers.
/// </summary>
public sealed class LogBroadcaster : ILoggerProvider
{
    private const int MaxHistory = 500;

    private readonly ConcurrentQueue<LogEntry> _history = new();
    private readonly List<Channel<LogEntry>> _subscribers = [];
    private readonly object _lock = new();

    public IEnumerable<LogEntry> GetHistory() => _history;

    public void Broadcast(LogEntry entry)
    {
        _history.Enqueue(entry);
        while (_history.Count > MaxHistory && _history.TryDequeue(out _)) { }

        lock (_lock)
        {
            foreach (var ch in _subscribers)
                ch.Writer.TryWrite(entry);
        }
    }

    public Channel<LogEntry> Subscribe()
    {
        var channel = Channel.CreateBounded<LogEntry>(
            new BoundedChannelOptions(200) { FullMode = BoundedChannelFullMode.DropOldest }
        );
        lock (_lock)
            _subscribers.Add(channel);
        return channel;
    }

    public void Unsubscribe(Channel<LogEntry> channel)
    {
        lock (_lock)
            _subscribers.Remove(channel);
        channel.Writer.TryComplete();
    }

    public ILogger CreateLogger(string categoryName) =>
        new LogBroadcasterLogger(this, categoryName);

    public void Dispose() { }
}

internal sealed class LogBroadcasterLogger(LogBroadcaster broadcaster, string categoryName)
    : ILogger
{
    public IDisposable? BeginScope<TState>(TState state)
        where TState : notnull => null;

    public bool IsEnabled(LogLevel logLevel) => logLevel >= LogLevel.Information;

    public void Log<TState>(
        LogLevel logLevel,
        EventId eventId,
        TState state,
        Exception? exception,
        Func<TState, Exception?, string> formatter
    )
    {
        if (!IsEnabled(logLevel))
            return;

        var message = formatter(state, exception);
        if (exception != null)
            message += $"\n{exception}";

        broadcaster.Broadcast(
            new LogEntry(logLevel.ToString(), categoryName, message, DateTimeOffset.UtcNow)
        );
    }
}
