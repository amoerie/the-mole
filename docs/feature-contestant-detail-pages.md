# Feature: Contestant Detail Pages

## Overview

Each contestant in a game has a dedicated detail page showing their high-resolution profile photo and bio. Clicking a contestant card on the game page navigates to that detail page.

## Goal

Give players richer context about who they are voting for. The small circular thumbnails on the game page are enough to identify contestants, but players may want to read a contestant's background before submitting their suspicion ranking.

## Behaviour

- Every `ContestantCard` on the game page is wrapped in a link. Clicking any card navigates to `/game/:gameId/contestant/:contestantId`.
- The detail page shows:
  - The contestant's high-resolution photo (`highResPhotoUrl` if set, otherwise falls back to `photoUrl`).
  - The contestant's name and age.
  - The contestant's bio (omitted when the field is empty).
- A "Terug" back button links to the parent game page.
- Auth: the same as `GET /api/games/{gameId}` — the viewer must be a player or admin of the game.

## Data model changes

Two new optional fields are added to the `Contestant` model:

| Field | Type | Description |
|---|---|---|
| `HighResPhotoUrl` | `string?` | URL of the large profile photo (external CDN or local) |
| `Bio` | `string?` | A short bio paragraph |

These fields are stored in the existing JSON column (`Contestants`) alongside the existing `Id`, `Name`, `Age`, `PhotoUrl`, and `EliminatedInEpisode` fields. No new table or column is needed.

## Database migration

Migration `AddContestantDetails` adds `Bio` and `HighResPhotoUrl` to the EF model snapshot (no schema change required — the data lives in the JSON column already).

The migration also includes a data migration that backfills `Bio` and `HighResPhotoUrl` for all Season 14 contestants already in the database, matched by their `Name` field. This covers all existing games created with the "Seizoen 14 laden" button.

## Season 14 hardcoded data

The `SEASON_14_CONTESTANTS` constant in `AdminContestantManager.tsx` is updated to include `bio` and `highResPhotoUrl` for all 12 contestants. New games created after this update get the rich data immediately.

## API

No new API endpoints. The detail page reuses `GET /api/games/{gameId}` to fetch the game (and thus all contestant data including `bio` and `highResPhotoUrl`).

## Frontend

### Route

`/game/:gameId/contestant/:contestantId`

### Page: `ContestantDetailPage`

- Calls `api.getGame(gameId)` on mount.
- Finds the contestant by `contestantId` in `game.contestants`.
- Shows loading skeleton, error alert, and "not found" alert as appropriate.
- Displays high-res photo, name, age, and bio.

### Navigation

`ContestantCard` components in the Kandidaten grid on `GamePage` are wrapped in `<Link>` elements pointing to the contestant detail page. Cards in the leaderboard are not linked.

## Tests

- **Frontend:** Vitest + Testing Library tests for `ContestantDetailPage`:
  - Loading skeleton shown initially.
  - Contestant name and age rendered after load.
  - Bio rendered when present; omitted when absent.
  - `highResPhotoUrl` used as image source when present; falls back to `photoUrl` when absent.
  - "Niet gevonden" shown when contestant ID has no match.
  - Error alert shown when API call fails.
  - Back button links to the game page.
- **Mappers:** `mapContestant` tests updated to cover `bio` and `highResPhotoUrl` pass-through.

## Coverage

Both backend and frontend new code must maintain the project's 80% line/function/branch/statement threshold.
