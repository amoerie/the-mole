# Feature: Admin Password Reset Link

## Overview

A game admin can generate a password reset link for any player in their game and
copy-paste it into WhatsApp, Teams, or any other channel. This is a workaround
for situations where the automatic reset e-mail does not arrive (spam folder,
misconfigured mail domain, etc.).

## Goal

Give the game admin a zero-friction fallback when e-mail delivery is broken,
without requiring shell access or super-admin privileges.

## Authorization

The endpoint is restricted to the **game admin**: the caller must be
authenticated and their user ID must match `game.AdminUserId`. Any other caller
receives `401 Unauthorized` (unauthenticated) or `403 Forbidden` (authenticated
but not the game admin). The target user must be a member of the game; otherwise
the endpoint returns `404 Not Found`.

The admin cannot generate a link for themselves (returns `400 Bad Request`).

## API

### `POST /api/games/{gameId}/players/{userId}/password-reset-link`

Generates a password reset token for the target player, stores the hash in the
database (same mechanism as the regular forgot-password flow), and returns the
full reset URL. **No e-mail is sent.**

**Auth:** Game admin only (see above).

**URL parameters:**
| Parameter | Description |
|-----------|-------------|
| `gameId`  | ID of the game the admin manages |
| `userId`  | ID of the player whose password should be reset |

**Request body:** none.

**Response (200 OK):**
```json
{ "resetUrl": "https://example.com/reset-password?token=<hex>" }
```

**Error responses:**
| Status | Condition |
|--------|-----------|
| 400    | `userId` is the caller's own ID |
| 401    | Caller is not authenticated |
| 403    | Caller is authenticated but is not the game admin |
| 404    | Game not found, or target user is not a player in this game |

**Token behaviour:**
- Uses the same 32-byte random hex token and SHA-256 hash mechanism as the
  regular forgot-password flow.
- The token is valid for **24 hours**.
- Calling the endpoint a second time for the same user invalidates the previous
  token (the new hash overwrites the old one in the database).
- Once the player uses the link to set a new password, the token is cleared as
  normal.

## Frontend

The "Groep" panel in `GroupMembers` (visible on the game page) gains a
**"Reset wachtwoord"** button per player row, visible only to the game admin.

### Interaction flow

1. Admin expands a player row inside the "Groep" panel.
2. A **"Reset wachtwoord"** button appears at the bottom of the expanded row
   (not shown for the admin's own row).
3. Clicking the button calls the API; while in-flight the button shows a spinner
   and is disabled.
4. On success, the button is replaced by a read-only text input containing the
   full reset URL plus a **"Kopieer"** button.
5. Clicking **"Kopieer"** writes the URL to the clipboard; the button label
   briefly changes to **"Gekopieerd!"** as confirmation.
6. On API error, a small error message is shown beneath the button.
7. The generated link is ephemeral — it is not persisted in component state
   across collapsing and re-expanding the player row.

## Tests

### Backend
- Happy path: game admin generates link for a player → 200 with `resetUrl`.
- Idempotency: calling twice returns a new (different) URL; old token is invalid.
- 400 when admin tries to generate a link for themselves.
- 403 when caller is not the game admin.
- 404 when target user is not a player in the game.
- 401 when unauthenticated.

### Frontend
- Button is shown for each non-admin player when the current user is the game admin.
- Button is hidden for the admin's own row.
- Button is hidden entirely when the current user is not the game admin.
- Clicking the button shows a loading state.
- On success, the reset URL input and copy button appear.
- Clicking copy triggers `navigator.clipboard.writeText` and shows confirmation.
- On error, an error message is displayed.

## Coverage

New backend and frontend code must maintain the project's 80 % line / function /
branch / statement threshold.
