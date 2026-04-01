# Feature: Email Improvements

## Overview

Three related email improvements: a styled password-reset email, a weekly Sunday-morning reminder for players who haven't submitted their ranking, and a per-user opt-out preference for those reminder emails.

## Goal

Make transactional emails feel like a natural part of the app (dark spy aesthetic, personalised with the user's display name), help players remember to submit their ranking before the deadline, and give players full control over whether they receive those reminders.

---

## 1. Styled password-reset email

### Changes

- `IEmailService.SendPasswordResetAsync` gains a `displayName` parameter so the email can open with "Hallo {name},".
- The HTML body is rebuilt with inline-CSS styling that mirrors the app's dark theme (`#0a0a0a` background, `#141414` card, `#00ff41` green accents, `#e0e0e0` body text).
- The favicon (`{baseUrl}/favicon.ico`) is embedded as an `<img>` in the email header alongside the "DE MOL" brand name.
- The call-to-action is a styled green button rather than a bare URL.
- The `forgot-password` route passes `user.DisplayName` to the service.

---

## 2. Sunday-morning ranking reminder

### Logic

On Sunday mornings (08:00–10:00 Brussels time), the background service sends one email per user who:

1. Has `ReminderEmailsEnabled = true`.
2. Is a player in at least one game that has an **open episode** (an episode whose `Deadline` is in the future).
3. Has **not yet submitted** a ranking for that open episode.

A user who plays in multiple games receives a **single** email listing all the games where a ranking is missing, each with a direct link to that game (`{baseUrl}/game/{gameId}`). Links are wrapped in a `/login?redirect=…` envelope so unauthenticated users land on the game page immediately after logging in.

The service uses a `BackgroundService` with a 30-minute timer. It keeps the last-sent date in memory to guarantee at-most-one send per Sunday (safe for single-instance Fly.io deployments; a database-backed flag can be added later if needed).

### API

No new API endpoints — the background service runs entirely server-side.

### Email content (Dutch)

- **Subject:** `Vergeet je rangschikking niet — De Mol`
- Greeting with display name
- One link per game with a missing ranking
- Footer with link to `/profile` to manage notification preferences

---

## 3. Reminder email opt-out preference

### Data Model

A new boolean column on `AppUser`:

| Field | Type | Default | Notes |
|---|---|---|---|
| `ReminderEmailsEnabled` | `bool` | `true` | Opt out of Sunday-morning ranking reminders |

An EF Core migration adds the column with `defaultValue: true` so existing users are opted in automatically.

### API

#### `GET /api/me/preferences`

Returns the current user's notification preferences.

**Auth:** Authenticated.

**Response:**
```json
{ "reminderEmailsEnabled": true }
```

#### `PATCH /api/me/preferences`

Updates the current user's notification preferences.

**Auth:** Authenticated.

**Request body:**
```json
{ "reminderEmailsEnabled": false }
```

**Response:** Same shape as GET.

### Frontend

A new **"E-mailmeldingen"** card is added to `ProfilePage` below the display-name card. It contains a labelled toggle (shadcn/ui `Switch`) that reflects and updates `reminderEmailsEnabled`. The save is optimistic with error rollback.

### Login redirect support

`LoginPage` reads the `redirect` query-string parameter (e.g. `/login?redirect=/game/abc`). After a successful login — and when there is no pending game-join flow — the user is sent to the decoded redirect path instead of `/`. Only same-origin paths (starting with `/`) are accepted to prevent open-redirect attacks.

---

## Tests

- **Backend:** Integration tests for `GET /api/me/preferences` (happy path, 401) and `PATCH /api/me/preferences` (happy path, 401, invalid input).
- **Frontend:** Vitest + Testing Library tests for the preferences toggle (render, toggle, save, error).

## Coverage

Both backend and frontend new code must maintain the project's 80% line/function/branch/statement threshold.
