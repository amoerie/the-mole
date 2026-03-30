# Feature: Game Message Board

## Overview

A simple message board scoped to each game, where players can leave public messages for each other. Messages are visible to all players of the game.

## Goal

Create a lightweight asynchronous communication channel inside each game so players can discuss their suspicions, tease each other, or just chat.

## Data Model

### `Message`

| Field       | Type             | Notes                          |
|-------------|------------------|--------------------------------|
| Id          | string (GUID)    | Primary key                    |
| GameId      | string           | Foreign key to Game            |
| UserId      | string           | Author's user ID               |
| DisplayName | string           | Denormalised from Player       |
| Content     | string           | 1–500 characters               |
| PostedAt    | DateTimeOffset   | UTC timestamp                  |

An EF Core migration is added to create the `Messages` table with an index on `GameId`.

## API

### `GET /api/games/{gameId}/messages`

Returns all messages for the game, ordered by `PostedAt` ascending.

**Auth:** Authenticated player of the game.

**Response:**
```json
[
  {
    "id": "msg-1",
    "userId": "user-abc",
    "displayName": "Alice",
    "content": "Ik denk dat het Bob is!",
    "postedAt": "2026-03-01T10:05:00Z"
  }
]
```

### `POST /api/games/{gameId}/messages`

Creates a new message.

**Auth:** Authenticated player of the game.

**Request body:**
```json
{ "content": "Ik denk dat het Bob is!" }
```

**Validation:** `content` must be 1–500 characters.

**Response:** The created message object (201 Created).

## Frontend

### Route

`/game/:gameId/messages`

### Page: `MessageBoardPage`

- Scrollable list of messages with author name and relative timestamp.
- Text area + submit button at the bottom to post a new message.
- Optimistic UI: new message appears immediately, re-fetched on success.
- Empty state when no messages exist.
- Link back to the game page.

### Navigation

A "Berichten" link is added to `GamePage` pointing to the message board.

## Tests

- **Backend:** Integration tests covering GET (happy path, empty, auth guard, non-player 401), POST (happy path, validation, auth guard, non-player 401).
- **Frontend:** Vitest + Testing Library tests for loading, empty state, error, message list rendering, form submission, and validation.

## Coverage

Both backend and frontend new code must maintain the project's 80% line/function/branch/statement threshold.
