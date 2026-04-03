# Feature: Admin Diagnostics Page

## Overview

A protected admin-only page at `/admin/diagnostics` that provides two live diagnostic
tools: an interactive SQL query runner against the SQLite database, and a streaming
log viewer that tails backend log output in real time.

## Goal

Give the admin a zero-friction way to inspect application state and debug issues
without needing shell access to the server or a separate database tool.

## SQL Query Runner

### API

#### `POST /api/admin/diagnostics/query`

Executes a read-only SQL statement against the SQLite database and returns the
column names and row values.

**Auth:** Admin only.

**Request body:**
```json
{ "sql": "SELECT id, email, isAdmin FROM AppUsers LIMIT 20" }
```

**Validation:**
- `sql` must be non-empty.

**Response (200 OK):**
```json
{
  "columns": ["id", "email", "isAdmin"],
  "rows": [
    ["usr-1", "alice@example.com", "True"],
    ["usr-2", "bob@example.com", "False"]
  ]
}
```

### Frontend

- **SQL editor** using CodeMirror 6 (`@uiw/react-codemirror` + `@codemirror/lang-sql`)
  with SQL syntax highlighting and a dark theme matching the app's aesthetic.
- **Execute** button submits the query; the editor also responds to `Ctrl+Enter` /
  `Cmd+Enter`.
- **Results table** rendered below the editor:
  - Column headers in the first row.
  - All cell values displayed as plain text; `NULL` shown as an italic `null`.
  - Horizontal scroll on wide result sets.
  - Row count shown beneath the table ("N rows returned").
- **Error banner** shown when the query fails (validation error or SQLite error).
- **Empty state** when the query returns zero rows.

## Log Viewer

### API

#### `GET /api/admin/diagnostics/logs/stream`

A Server-Sent Events (SSE) endpoint that streams structured log entries.

**Auth:** Admin only (checked before headers are written; returns `401`/`403` if
the caller is not an authenticated admin).

**Behaviour:**
1. On connection, replay the last ≤ 500 buffered log entries so the viewer has
   immediate context.
2. Stream new log entries as they are emitted by the application's logging
   pipeline.
3. Closes when the client disconnects.

Each SSE event carries a JSON payload:
```
data: {"level":"Information","category":"Api.Routes.GameRoutes","message":"Game xyz created","timestamp":"2026-04-03T10:00:00Z"}

```

**Log levels captured:** `Information`, `Warning`, `Error`, `Critical`.
`Trace` and `Debug` are excluded to reduce noise.

### Backend: LogBroadcaster

A singleton `LogBroadcaster` is registered as both an `ILoggerProvider` and as a
plain DI service so it can be injected into the SSE route handler.

- Maintains a bounded in-memory `ConcurrentQueue<LogEntry>` (cap: 500 entries).
- Keeps a list of active subscriber `Channel<LogEntry>` instances (one per
  connected SSE client, cap: 200 buffered entries per channel, drops oldest on
  overflow).
- On each new log entry: enqueue + broadcast to all active channels.
- Subscribers are registered on SSE connection and removed on disconnect.

### Frontend

- Opens an `EventSource` to `/api/admin/diagnostics/logs/stream` on mount and
  closes it on unmount.
- Maintains an in-memory list of log entries capped at **500 entries** (oldest
  are dropped when the cap is exceeded) to avoid memory growth.
- **Auto-scroll**: the log feed scrolls to the newest entry automatically unless
  the user has manually scrolled up, in which case auto-scroll is paused until
  the user scrolls back to the bottom.
- **Log-level colour coding:**

  | Level       | Colour          |
  |-------------|-----------------|
  | Critical    | Bold red        |
  | Error       | Red             |
  | Warning     | Amber / yellow  |
  | Information | Default (white) |
  | Debug       | Muted grey      |

- Each row shows: `[timestamp]  [level]  [category]  message`.
- **Connection status badge** (Connected / Reconnecting / Error) shown in the
  panel header.
- Empty state shown when no entries have arrived yet.

## Navigation

A **"Diagnostics"** link is added to the top navigation bar, visible only to
admin users, pointing to `/admin/diagnostics`.

## Tests

- **Backend:**
  - Query: happy path (columns + rows returned), auth guard (401 unauthenticated,
    403 non-admin), write-blocked (INSERT rejected with 400), empty result set,
    SQLite syntax error returns 400.
  - Logs stream: auth guard (401 unauthenticated, 403 non-admin), connection
    returns `text/event-stream` content type for admin.

- **Frontend:** Vitest + Testing Library tests for loading state, redirect when
  not admin, query execution (success, error), results table rendering, log
  viewer mount/unmount of EventSource, auto-scroll behaviour, log-level colour
  classes.

## Coverage

Both backend and frontend new code must maintain the project's 80 % line /
function / branch / statement threshold.
