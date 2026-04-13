# Feature: Email Dashboard, Reminder Redesign, and Manual Test Send

## Overview

Three related improvements to the email system:

1. **Ranking reminder email redesign** — Change from "you forgot to submit" to "here is your current ranking, you have until DEADLINE to change it."
2. **Admin email log dashboard** — A new admin page at `/admin/emails` showing all sent emails with status, expandable HTML body, and a retry button for failures.
3. **Admin manual test send** — Admin can pick any player and immediately trigger their reminder email for debugging.

## Goal

Since rankings are auto-copied every week, every player already has a ranking. The existing "you forgot to submit" framing is misleading. The redesigned email becomes a weekly nudge to review (and optionally adjust) the auto-copied ranking before the deadline. The email dashboard and manual send make it easy to verify delivery and test the email content without waiting for the Sunday window.

---

## 1. Ranking Reminder Email Redesign

### Data Model — new `GameReminderInfo` type

Replace the anonymous `(string GameName, string GameUrl)` tuple with a named record that carries deadline and ranking data:

```csharp
// api/Services/GameReminderInfo.cs
public record GameReminderInfo(
    string GameName,
    string GameUrl,
    DateTimeOffset Deadline,
    IReadOnlyList<string> RankedContestantNames   // index 0 = most suspect
);
```

`ReminderRecipient` is updated to use `IReadOnlyList<GameReminderInfo>` instead of `IReadOnlyList<(string GameName, string GameUrl)>`.

### Service interface change

```csharp
Task SendRankingReminderAsync(
    string toEmail,
    string displayName,
    IEnumerable<GameReminderInfo> games
);
```

### `PendingReminderQuery` — revised logic

**Old:** return only players who have *not* submitted a ranking for the open episode.
**New:** return *all* players (with `ReminderEmailsEnabled = true`) in games with an open episode, together with their current ranking and the episode deadline.

New method signatures on `IPendingReminderQuery`:

```csharp
// Replaces GetPendingRecipientsAsync — used by the background service
Task<IReadOnlyList<ReminderRecipient>> GetRecipientsAsync(string baseUrl, CancellationToken ct);

// New — used by the manual-send admin endpoint
Task<ReminderRecipient?> GetRecipientForUserAsync(string userId, string baseUrl, CancellationToken ct);
```

**`GetRecipientsAsync` steps:**
1. Load all games with their episodes and contestants.
2. Find games that have at least one open episode (deadline in future); take the earliest open episode per game.
3. Load all rankings for those `(GameId, EpisodeNumber)` pairs.
4. Load all players in those games, grouped by `UserId`.
5. Load `AppUser` rows for those user IDs where `ReminderEmailsEnabled = true`.
6. For each user–game pair: look up their ranking, map `ContestantIds → contestant names` using `Game.Contestants`.  
   If no ranking exists for the open episode (edge case), skip that game for this user.
7. Group by user and build one `ReminderRecipient` per user.

**`GetRecipientForUserAsync` steps:** same flow but scoped to a single `userId`.

### Email content

| Field | Value |
|---|---|
| Subject | `Jouw rangschikking voor deze week — Mollenjagers` |
| Greeting | `Hallo {displayName},` |
| Intro | `Hier is je huidige rangschikking. Je hebt tot {deadline (nl-BE date+time)} om deze nog te wijzigen.` |
| Per game | Game name as a header, numbered list of contestant names (1 = most suspect), "Wijzig rangschikking →" button linking to `{gameUrl}` |
| Footer | Link to `/profile` to manage notification preferences |

Deadline formatted in Dutch: e.g. `zondag 20 april om 23:59`.

---

## 2. Admin Email Log Dashboard

### Data model — `EmailLog`

New table persisting every send attempt (success or failure):

| Column | Type | Notes |
|---|---|---|
| `Id` | `string` | GUID, primary key |
| `SentAt` | `DateTimeOffset` | When the attempt was made |
| `ToEmail` | `string` | Recipient address |
| `ToName` | `string` | Recipient display name |
| `Subject` | `string` | Email subject line |
| `HtmlBody` | `string` | Full rendered HTML (stored for display + retry) |
| `TextBody` | `string` | Plain-text fallback |
| `Type` | `string` | `"RankingReminder"` or `"PasswordReset"` |
| `Success` | `bool` | `true` if MailerSend accepted |
| `ErrorMessage` | `string?` | Exception message on failure |

Migration: `20260413120314_AddEmailLogs`

`AppDbContext` gains `DbSet<EmailLog> EmailLogs`.

### Logging in `MailerSendEmailService`

`MailerSendEmailService` is a singleton, so it injects `IServiceScopeFactory` to get a scoped `AppDbContext` for logging.

The private `SendAsync` helper is replaced by `SendAndLogAsync(toEmail, toName, subject, text, html, type)`:

```
try:
    POST to MailerSend → success = true
catch Exception ex:
    success = false; errorMessage = ex.Message; re-throw
finally:
    using scope → db.EmailLogs.Add(new EmailLog { ... }); db.SaveChangesAsync()
```

This means every email — whether sent successfully or not — produces a log row.

### New admin API routes (added to `AdminRoutes.cs`)

Auth on all: `admin` role required (same as existing `GET /api/admin/users`).

#### `GET /api/admin/emails`

Returns a paginated list of email log entries, most recent first.

Query parameters: `page` (default 1), `pageSize` (default 50, max 200).

Response:
```json
{
  "total": 142,
  "page": 1,
  "pageSize": 50,
  "items": [
    {
      "id": "...",
      "sentAt": "2026-04-13T08:12:00Z",
      "toEmail": "alice@example.com",
      "toName": "Alice",
      "subject": "Jouw rangschikking...",
      "type": "RankingReminder",
      "success": true,
      "errorMessage": null
    }
  ]
}
```

Note: `htmlBody` and `textBody` are **excluded** from the list response (fetched separately on demand).

#### `GET /api/admin/emails/{id}`

Returns the full log entry including `htmlBody` and `textBody`. Returns `404` if not found.

#### `POST /api/admin/emails/{id}/retry`

Re-sends the email using the stored `ToEmail`, `Subject`, `HtmlBody`, `TextBody`. Calls `IEmailService.RetryAsync(...)` which POSTs to MailerSend and creates a **new** `EmailLog` row for the retry (the original row is left unchanged). Returns `404` if the log entry is not found. Returns `400` for `PasswordReset` emails (tokens expire quickly and bodies are not stored).

Response:
```json
{ "success": true }
```

#### `POST /api/admin/emails/send-reminder`

See section 3 below.

### Frontend — `AdminEmailsPage.tsx` at `/admin/emails`

- **Table** columns: Verzonden (nl-BE locale), Aan (email + name), Onderwerp, Type badge, Status badge (green "Verstuurd" / red "Mislukt").
- **Expand row**: clicking a row fetches `GET /api/admin/emails/{id}` and shows the HTML body in an `<iframe srcdoc="...">` below the row. Clicking again collapses it.
- **Retry button**: shown next to each failed row (only). Calls `POST /api/admin/emails/{id}/retry`, shows spinner while in flight, refreshes the page list on success.
- **Pagination**: prev/next buttons, shows "Pagina X van Y".
- **Loading skeleton** while initial list loads; empty state message if no emails yet.

Navigation: add **"E-mails"** link in the header's admin nav alongside "SQL" and "Logs".

---

## 3. Admin Manual Test Send

### API

#### `POST /api/admin/emails/send-reminder`

Auth: admin only.

Request body:
```json
{ "userId": "..." }
```

Steps:
1. Look up `AppUser` by `userId` — return `404` if not found.
2. Call `IPendingReminderQuery.GetRecipientForUserAsync(userId, baseUrl, ct)`.
3. If `null` (no open games), return `400 Bad Request`:
   ```json
   { "error": "Geen open afleveringen gevonden voor deze speler." }
   ```
4. Call `IEmailService.SendRankingReminderAsync(recipient.Email, recipient.DisplayName, recipient.Games)` — this also logs the email.
5. Return `200 OK`:
   ```json
   { "sentTo": "alice@example.com" }
   ```

### Frontend — section at top of `AdminEmailsPage`

- **"Test e-mail versturen"** card above the log table.
- Dropdown populated from `GET /api/admin/users`, showing each user's display name + email.
- **"Verstuur herinnering"** button (disabled while in flight).
- Inline success banner: `"E-mail verstuurd naar alice@example.com"`.
- Inline error banner on failure (e.g. no open games, or email send failed).
- On success, refresh the email log table to show the newly created log entry.

---

## Tests

### Backend

| Area | Cases |
|---|---|
| `PendingReminderQuery.GetRecipientsAsync` | Returns all eligible players (not just those missing a ranking); includes ranked names and deadline; respects `ReminderEmailsEnabled = false`; skips users with no ranking for open episode |
| `PendingReminderQuery.GetRecipientForUserAsync` | Happy path; user not in any open game returns `null` |
| `MailerSendEmailService` | Logs success row; logs failure row with error message on HTTP error |
| `GET /api/admin/emails` | Returns paginated list; excludes body fields; 401/403 auth guards |
| `GET /api/admin/emails/{id}` | Returns full body; 404 for unknown id |
| `POST /api/admin/emails/{id}/retry` | Creates new log entry; calls MailerSend; 404 for unknown id; auth guards |
| `POST /api/admin/emails/send-reminder` | 200 sends and logs; 400 if no open games; 404 if user not found; 401/403 auth guards |

### Frontend

Vitest + Testing Library tests for `AdminEmailsPage`:
- Renders table with log entries.
- Expand row shows iframe with HTML body.
- Retry button triggers POST and refreshes list.
- Pagination prev/next.
- User picker populates from admin users endpoint.
- Manual send shows success / error banner.

## Coverage

All new backend and frontend code must maintain the project's 80 % line / branch / method / statement threshold (enforced via `coverage.runsettings`).
