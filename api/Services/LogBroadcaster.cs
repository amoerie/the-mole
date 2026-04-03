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

    // Plain Queue protected by _lock gives O(1) Count (unlike ConcurrentQueue which is O(n)).
    private readonly Queue<LogEntry> _history = new();
    private readonly List<Channel<LogEntry>> _subscribers = [];
    private readonly object _lock = new();

    public void Broadcast(LogEntry entry)
    {
        lock (_lock)
        {
            _history.Enqueue(entry);
            if (_history.Count > MaxHistory)
                _history.Dequeue();

            foreach (var ch in _subscribers)
                ch.Writer.TryWrite(entry);
        }
    }

    /// <summary>
    /// Atomically registers the subscriber and snapshots the current history so
    /// that no entry can appear both in the history replay and the live stream.
    /// </summary>
    public (Channel<LogEntry> Channel, LogEntry[] History) SubscribeWithHistory()
    {
        var channel = Channel.CreateBounded<LogEntry>(
            new BoundedChannelOptions(200) { FullMode = BoundedChannelFullMode.DropOldest }
        );
        lock (_lock)
        {
            _subscribers.Add(channel);
            return (channel, _history.ToArray());
        }
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

    // Explicitly exclude LogLevel.None (numerically > Information) to avoid
    // broadcasting artificial "None" entries from misconfigured providers.
    public bool IsEnabled(LogLevel logLevel) =>
        logLevel != LogLevel.None && logLevel >= LogLevel.Information;

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
