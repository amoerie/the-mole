# Feature: Group Members & Rankings

## Overview

A page where logged-in players can see who else is in their game group, and inspect each player's submitted ranking per episode (only after the episode deadline has passed).

## Goal

Foster social play by letting players see and compare each other's choices once an episode deadline is over.

## API

### `GET /api/games/{gameId}/players`

Returns a list of all players in the game.

**Auth:** Authenticated player or admin of the game.

**Response:**
```json
[
  {
    "id": "player-1",
    "userId": "user-abc",
    "displayName": "Alice",
    "joinedAt": "2026-03-01T10:00:00Z"
  }
]
```

The existing `GET /api/games/{gameId}/episodes/{n}/rankings` endpoint is reused on the frontend to show a specific player's ranking per episode (the response includes `userId` and `displayName`, so each player's row can be extracted client-side).

## Frontend

### Route

`/game/:gameId/group`

### Page: `GroupPage`

- Lists all players with their display name and join date.
- Each player row is expandable (accordion or similar) showing their rankings per episode.
- Rankings are fetched lazily when a player row is expanded (one request per episode that has passed its deadline).
- A player's ranking is shown as an ordered list of contestant names (most → least suspect).
- Own row is highlighted.
- Link back to the game page.

### Navigation

A "Groep" link is added to `GamePage` pointing to the group page.

## Tests

- **Backend:** Integration tests for the `/players` endpoint: happy path, auth guard, non-player returns 401.
- **Frontend:** Vitest + Testing Library tests for loading state, empty state, error state, list rendering, and expansion behaviour.

## Coverage

Both backend and frontend new code must maintain the project's 80% line/function/branch/statement threshold.
