# Feature: Suspect Charts

## Overview

A charts page showing which contestant is ranked most and least suspicious per episode, aggregated across all players in a game. Only visible to authenticated game participants.

## Goal

Give players a visual overview of the group's collective suspicion, revealing which contestants are broadly considered the mole and which are largely trusted.

## API

### `GET /api/games/{gameId}/suspect-stats`

Returns aggregated ranking data per episode for all past-deadline episodes.

**Auth:** Authenticated player of the game.

**Response:**
```json
[
  {
    "episodeNumber": 1,
    "stats": [
      {
        "contestantId": "abc",
        "name": "Alice",
        "avgRank": 1.4,
        "rankingCount": 5
      }
    ]
  }
]
```

- `avgRank`: average rank position across all players (1 = most suspect, N = least suspect).
- `rankingCount`: number of players who submitted a ranking for this episode.
- Episodes before the deadline are excluded.
- Contestants are sorted by `avgRank` ascending (most suspect first).

## Frontend

### Route

`/game/:gameId/suspect-charts`

### Page: `SuspectChartsPage`

- One bar chart per episode (using **recharts** `BarChart`).
- X-axis: contestant names.
- Y-axis: average rank (lower = more suspect); y-axis inverted so most suspect is tallest bar.
- Bars are coloured by suspicion level (red = most suspect, green = least suspect).
- Empty state when no episodes have passed their deadline.
- Link back to the game page.

### Navigation

A "Grafieken" link is added to `GamePage` pointing to the charts page.

## Tests

- **Backend:** Integration tests covering happy path, auth guard, non-player returns 401, no past-deadline episodes returns empty array.
- **Frontend:** Vitest + Testing Library tests for loading state, empty state, error state, and rendered chart data.

## Coverage

Both backend and frontend new code must maintain the project's 80% line/function/branch/statement threshold.
