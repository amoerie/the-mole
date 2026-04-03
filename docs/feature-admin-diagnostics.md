# Feature: Admin Diagnostics

## Overview

Two protected super-admin-only pages that provide live diagnostic tooling:

- **`/admin/query`** — interactive SQL runner against the SQLite database.
- **`/admin/logs`** — streaming log viewer that tails backend output in real time.

## Goal

Give the super-admin a zero-friction way to inspect application state and debug
issues without needing shell access to the server or a separate database tool.

## Authorization

Both endpoints (and both pages) are restricted to the **super-admin**: the caller
must hold the `admin` role **and** their email must match `config["AdminEmail"]`.
Any other caller receives `401 Unauthorized` (unauthenticated) or `403 Forbidden`
(authenticated but not the super-admin).

## SQL Query Runner

### Route

`/admin/query`

### API

#### `POST /api/admin/diagnostics/query`

Executes an arbitrary SQL statement against the SQLite database and returns the
column names and row values.

**Auth:** Super-admin only (see above).

**Request body:**
```json
{ "sql": "SELECT id, email, isAdmin FROM AppUsers LIMIT 20" }
```

**Validation:**
- `sql` must be non-empty.
- All statement types are accepted (SELECT, INSERT, UPDATE, DELETE, PRAGMA, …).
  SQLite errors are caught and returned as `400 Bad Request`.

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

For non-SELECT statements (INSERT/UPDATE/DELETE) `columns` and `rows` are empty.

### Frontend

- **Table browser sidebar** listing all tables from `sqlite_master`, loaded on
  mount. Double-clicking a table prefills the editor with
  `SELECT * FROM "<table>" LIMIT 1000` (identifier double-quote escaped).
- **SQL editor** using CodeMirror 6 (`@uiw/react-codemirror` + `@codemirror/lang-sql`)
  with SQL syntax highlighting and a dark theme.
- **Execute** button submits the query; `Ctrl+Enter` / `Cmd+Enter` also works.
- **Results table** rendered below the editor:
  - Column headers in the first row.
  - All cell values displayed as plain text; `NULL` shown as an italic `null`.
  - Horizontal scroll on wide result sets.
  - Row count shown beneath the table.
- **Error banner** shown when the query fails (validation error or SQLite error).
- **Empty state** when the query returns zero rows.

## Log Viewer

### Route

`/admin/logs`

### API

#### `GET /api/admin/diagnostics/logs/stream`

A Server-Sent Events (SSE) endpoint that streams structured log entries.

**Auth:** Super-admin only (see above).

**Behaviour:**
1. Subscribe and snapshot existing history **atomically** (under the same lock)
   so no entry can appear in both the history replay and the live channel.
2. Replay the last ≤ 500 buffered entries so the viewer has immediate context.
3. Stream new log entries as they are emitted by the application's logging
   pipeline.
4. Closes when the client disconnects.

Each SSE event carries a JSON payload:
```
data: {"level":"Information","category":"Api.Routes.GameRoutes","message":"Game xyz created","timestamp":"2026-04-03T10:00:00Z"}

```

**Log levels captured:** `Information`, `Warning`, `Error`, `Critical`.
`Trace`, `Debug`, and `None` are excluded to reduce noise.

### Backend: LogBroadcaster

A singleton `LogBroadcaster` is registered as both an `ILoggerProvider` and as a
plain DI service so it can be injected into the SSE route handler.

- Maintains a bounded in-memory `Queue<LogEntry>` (cap: 500 entries) protected
  by a single lock. Using `Queue<T>` gives O(1) `Count`; `ConcurrentQueue<T>`
  would be O(n).
- Exposes `SubscribeWithHistory()` which atomically registers a subscriber
  channel and returns the current history snapshot, preventing duplicates.
- Per-subscriber `Channel<LogEntry>` (cap: 200, drops oldest on overflow).
- On each new log entry: enqueue (trimming if over cap) + broadcast to all
  channels — all under the same lock.

### Frontend

- Opens an `EventSource` to `/api/admin/diagnostics/logs/stream` on mount and
  closes it on unmount.
- Maintains an in-memory list of log entries capped at **500 entries** (oldest
  are dropped when the cap is exceeded) to avoid memory growth.
- Each entry is assigned a stable monotonic key (counter ref) so React can
  reconcile the list correctly when old entries are trimmed.
- **Auto-scroll** controlled by a "Volg laatste log" checkbox (checked by
  default). Scrolling away from the bottom unchecks it automatically;
  re-checking jumps back to the bottom.
- **Log-level colour coding:**

  | Level       | Colour          |
  |-------------|-----------------|
  | Critical    | Bold red        |
  | Error       | Red             |
  | Warning     | Amber / yellow  |
  | Information | Default (white) |
  | Debug       | Muted grey      |

- Each row shows: `[timestamp]  [level]  [category]  message`.
- **Connection status badge**: `Verbinden...` (connecting / reconnecting),
  `Verbonden` (open), `Fout` (permanently closed). Transient disconnects show
  "Verbinden..." rather than "Fout" because `EventSource` will retry automatically.

## Navigation

**"SQL"** and **"Logs"** links are added to the top navigation bar, visible only
to admin users, pointing to `/admin/query` and `/admin/logs` respectively.

## Tests

- **Backend:**
  - Query: happy path (columns + rows returned), empty result set, write statement
    accepted (DELETE WHERE 1=0), SQLite error returns 400, empty SQL returns 400.
  - Auth guard: 401 unauthenticated, 403 non-admin role, 403 admin role but
    non-super-admin email.
  - Logs stream: SSE content-type for super-admin, same auth guards as query.

- **Frontend:** Vitest + Testing Library tests for loading state, redirect when
  not admin, SQL execute/error/empty/null-cells, table browser (loading skeleton,
  table list, double-click prefill with quoted identifier, empty state), log viewer
  SSE connect/reconnect/close/message/colour-coding/stable-key/unmount.

## Coverage

Both backend and frontend new code must maintain the project's 80 % line /
function / branch / statement threshold.
