# Feature: Persoonlijk Molboekje

## Overview

Each player gets a private "molboekje" (mole notebook) per game — a personal investigation journal to collect notes and observations as the season unfolds. Notes are organized **per episode**: one free-text entry per episode where the player records what happened in challenges and which contestants behaved suspiciously. A secondary "Verdachten" view aggregates per-episode suspicion ratings per contestant into a timeline. Contestant detail pages surface any notebook entries that mention that contestant.

## Goal

In the TV show, each candidate receives a physical notebook in a unique cover color to document their suspicions about the mole. This feature brings that prop to the web app: a private journal where players can write down challenge observations and gut feelings episode by episode.

## Design decisions

### Why per-episode, not per-contestant?

Four organizational approaches were considered:

| Approach | Verdict | Reason |
|---|---|---|
| **Per episode (chosen)** | Best fit | Matches how players actually take notes: describe a challenge, mention the relevant suspects within that narrative |
| **Per contestant** | Discarded | Forces unnatural fragmentation — you have to split a single "challenge 2" observation across multiple contestant pages |
| **Per contestant + episode sections** | Discarded | Doubles the fragmentation problem; you can't write "Yannis and Kristof both went on the boat trip" without repeating context in two places |
| **Free text per game** | Acceptable fallback | Simple but offers no structure; no suspicion overview across time |

Real-world notes (e.g. from Google Keep) confirm this: players write "Opdracht 1 — Yannis en Yana winnen. Kristof hoorde het gefluit." The episode and challenge are the natural heading; suspects appear as mentions within the narrative. Forcing that into a per-contestant structure would break the writing flow.

### Suspicion levels as a structured secondary layer

Free text notes answer "what happened?" A separate per-episode, per-contestant suspicion level (1–5) answers "how suspicious is each person right now, after this episode?" This structured layer enables a "Verdachten" view that shows each contestant's suspicion trajectory over time — something free text alone cannot provide. It also does not duplicate the weekly ranking (which captures *order*, not *intensity*).

### Contestant mentions: scan at read time, client-side

The contestant detail page can show which notebook entries mention that contestant. Two approaches were considered:

| Approach | Verdict | Reason |
|---|---|---|
| **Write-time indexing** | Discarded | Requires keeping a junction table in sync across edits; name disambiguation (first name, nickname, partial match) is an unsolved problem |
| **Read-time scan, client-side (chosen)** | Best fit | The full notebook is at most ~12 episodes × 5000 chars ≈ 60 KB per player per game — scanning it in JavaScript takes under a millisecond |

The client fetches the full notebook and filters for episodes whose `content` includes the contestant's first name (case-insensitive). No new API endpoint or schema change is needed for this feature. Known limitation: if two contestants share a first name, false positives are possible. Acceptable at this scale.

### Storage: server-side

Notes are persisted server-side (SQLite via EF Core) rather than in localStorage. Players often watch on TV and take notes on a second device; cross-device sync is essential. The existing cookie-based auth makes user-scoping straightforward.

### One note per episode, upsert semantics

There is exactly one episode note per (user, game, episode). Writing replaces the existing record in full. This keeps the UI simple (one textarea per episode) and storage bounded.

### Notebook color

Players choose a cover color from a fixed palette of eight colors — a nod to the physical prop. The color is cosmetic (Tailwind accent on the notebook page) and stored on the `Player` record.

---

## Behaviour

### Notebook page

- Accessible from `GamePage` via a "Molboekje" button (`BookText` icon from `lucide-react`), alongside the existing navigation buttons.
- Route: `/game/:gameId/molboekje`.
- Fully private: a player reads and writes only their own notes. The game admin has their own notebook but cannot read other players' notes.

### Default view: Afleveringen (episode notes)

- One card per **past episode** (deadline has passed), newest first.
- Each card shows:
  - **Header**: "Aflevering N — [deadline date]"
  - **Textarea** (max 5000 characters) for free-text notes. No imposed structure — players write however they want (per challenge, bullet points, running commentary).
  - **Suspicion row**: a compact horizontal-scroll row of contestant portrait chips, each with a 1–5 star selector below it. A contestant is shown greyed out with a strikethrough name if they were eliminated before or during this episode (`contestant.eliminatedInEpisode <= episodeNumber`). Selecting a star level immediately saves.
- Episodes without any content or suspicion data show an empty textarea with placeholder text "Schrijf hier je notities voor aflevering N…".
- Future episodes (deadline not yet passed) are hidden.
- Each card tracks its own saving state (see Frontend section).

### Secondary view: Verdachten (suspect timeline)

Toggled via a view-toggle button group in the notebook header.

- One row per contestant (active contestants first, then eliminated in order).
- Columns: one per past episode.
- Each cell shows the suspicion level for that contestant in that episode as a filled-star badge (1–5), or "–" if not set.
- Clicking a cell switches back to the Afleveringen view and scrolls to that episode's card.
- Read-only — editing happens in the Afleveringen view only.

### Auto-save

- Episode note text saves on a 500 ms debounce after the last keystroke (same pattern as `RankingBoard`).
- Suspicion level changes save immediately on click (no debounce needed — single interaction).
- Each episode card shows its own saving indicator: "Opslaan..." → "Opgeslagen" → idle.

### Notebook color

- Shown as a colored header strip with the player's display name, a color-swatch picker, a view toggle, and a back link.
- Default: derived deterministically from the player's `userId` by hashing into the palette, so each player gets a stable initial color (multiple players may share a color).
- Color-swatch picker `PATCH` fires immediately on selection (optimistic update in UI).

### Contestant detail page: "In jouw molboekje"

- On `ContestantDetailPage`, if the current user is a player of the game, `GET /api/games/{gameId}/molboekje` is fetched in parallel with the existing `getGame(gameId)` call.
- Client-side: filter episodes whose `content` contains the contestant's first name (first whitespace-delimited token of `contestant.name`, case-insensitive).
- If matching episodes exist, a "In jouw molboekje" section is rendered below the bio.
- Each match shows: episode number, deadline date, and a truncated excerpt (first 300 characters of the note content) with the matched name highlighted using `<mark>`. A "Bekijk notitie" link navigates to `/game/:gameId/molboekje` (the Afleveringen view).
- If no episodes match, or if the notebook fetch fails, the section is silently omitted (no empty state shown).

---

## Data model changes

### New table: `NotebookNotes`

One row per (user, game, episode). Suspicion levels are stored as a JSON dictionary in a single column to avoid a separate many-row table for a small, bounded set of values (max ~12 contestants × ~12 episodes). EF Core maps this column using a `HasConversion<Dictionary<string, int>, string>` value converter — the same pattern already used for `Contestants` and `Episodes` on the `Game` entity.

| Field | Type | Constraints |
|---|---|---|
| `Id` | `string` | PK, GUID-formatted string |
| `UserId` | `string` | References `AppUser` (no DB FK constraint) |
| `GameId` | `string` | References `Game` (no DB FK constraint) |
| `EpisodeNumber` | `int` | |
| `Content` | `string` | max 5000 chars, default `""` |
| `SuspicionLevels` | `string` (JSON dict) | e.g. `{"abc":4,"xyz":2}`, default `"{}"` |
| `UpdatedAt` | `DateTimeOffset` | |

Unique index on `(UserId, GameId, EpisodeNumber)`.
Index on `(GameId, UserId)` for bulk fetch.

### Modified table: `Players`

| Field | Type | Change |
|---|---|---|
| `NotebookColor` | `string?` | New nullable field |

Valid color values: `"red"`, `"orange"`, `"yellow"`, `"green"`, `"teal"`, `"blue"`, `"purple"`, `"pink"`.

### Database migration

Migration name: `AddNotebook`

- Creates `NotebookNotes` table.
- Adds nullable `NotebookColor` column to `Players`.
- No data migration needed.

---

## API

### `GET /api/games/{gameId}/molboekje`

Returns the current user's full notebook.

**Auth:** must be a player or admin of the game. Returns `401` if unauthenticated or not a member.

**Response `200`:**
```json
{
  "notebookColor": "teal",
  "notes": [
    {
      "episodeNumber": 2,
      "content": "Opdracht 1: Yannis en Yana winnen. Kristof hoorde het gefluit...",
      "suspicionLevels": { "kristof-id": 4, "yannis-id": 3 },
      "updatedAt": "2025-03-14T20:12:00Z"
    }
  ]
}
```

`notebookColor` is `null` if not yet chosen. `notes` contains only episodes the player has touched (non-empty content or at least one suspicion level set); the frontend builds empty state for the remaining episodes from the game's episode list.

---

### `PUT /api/games/{gameId}/molboekje/notes/{episodeNumber}`

Creates or fully replaces the note for a specific episode. Both `content` and `suspicionLevels` are required and treated as a full replacement — the previous values are overwritten entirely. The frontend always sends complete state, so partial-update semantics are not needed.

**Auth:** same as above.

**Request body:**
```json
{
  "content": "Opdracht 1: Yannis en Yana winnen...",
  "suspicionLevels": { "kristof-id": 4, "yannis-id": 3 }
}
```

**Validation (returns `422` on failure):**
- `episodeNumber` must match an existing episode in the game.
- `content` is required (empty string is valid); length must not exceed 5000 characters.
- `suspicionLevels` is required (empty object is valid — clears all levels).
- All keys in `suspicionLevels` must be valid contestant IDs in the game.
- All values in `suspicionLevels` must be integers 1–5.

**Returns:** `204 No Content`

---

### `PATCH /api/games/{gameId}/molboekje/color`

Updates the player's notebook cover color.

**Request body:** `{ "color": "teal" }`

**Validation:** `color` must be one of the eight valid values. Returns `422` otherwise.

**Returns:** `204 No Content`

---

## Frontend

### Route

`/game/:gameId/molboekje`

### Navigation entry point

`GamePage`: add a `<Link to={`/game/${gameId}/molboekje`}>` button with the `BookText` icon and label "Molboekje", consistent with the existing nav buttons.

---

### Page: `MolboekjePage`

On mount: parallel fetches of `api.getGame(gameId)` and `GET /api/games/{gameId}/molboekje`.

Initial note state is built from the **full episode list** (not just the API response), so every past episode has an entry. The API response is overlaid onto this empty structure — touched episodes get their persisted content and suspicion levels; untouched episodes start with empty defaults.

Top-level state:
- `notes`: `Map<number, EpisodeNoteState>` keyed by episode number.
  - `EpisodeNoteState = { content: string, suspicionLevels: Record<string, number>, savingState: 'idle' | 'saving' | 'saved' }`
- `view`: `"episodes" | "suspects"` — which panel is shown.
- `notebookColor`: `string | null`.

Renders:
1. **`NotebookCoverHeader`** — colored strip, player name, view toggle, color picker, back link.
2. **`EpisodeNotesPanel`** — shown when `view === "episodes"`.
3. **`SuspectTimelinePanel`** — shown when `view === "suspects"`.

---

### Component: `NotebookCoverHeader`

Props: `playerName: string`, `notebookColor: string | null`, `view: "episodes" | "suspects"`, `onViewChange: (view) => void`, `onColorChange: (color: string) => void`.

Renders a `div` with a static Tailwind class from a constant map (e.g. `{ red: "bg-red-200 border-red-400", ... }`) keyed by `notebookColor` (falls back to a neutral style when `null`). Contains:
- "Het molboekje van [playerName]"
- Two-button view toggle: "Afleveringen" / "Verdachten"
- `ColorPicker` dropdown (eight colored swatches as `<button>` elements); on click fires `PATCH` and calls `onColorChange` optimistically
- Back link to game page

The eight color-to-Tailwind-class mappings are defined as a module-level constant so Tailwind's static analysis can detect all class strings.

---

### Component: `EpisodeNotesPanel`

Props: `episodes` (past only), `contestants`, `notes: Map<number, EpisodeNoteState>`, `onContentChange: (episodeNumber, content) => void`, `onSuspicionChange: (episodeNumber, contestantId, level) => void`.

Renders one `EpisodeNoteCard` per past episode, newest-first.

---

### Component: `EpisodeNoteCard`

Props: `episode`, `contestants`, `noteState: EpisodeNoteState`, `onContentChange`, `onSuspicionChange`.

Renders:
- Card header: "Aflevering N — [formatted deadline date]" plus saving indicator ("Opslaan..." / "Opgeslagen" / empty) from `noteState.savingState`.
- `<textarea>` with placeholder text. `onChange` calls `onContentChange` which writes to state and enqueues the debounced `PUT`.
- **Suspicion row**: horizontal-scroll container with one `ContestantSuspicionChip` per contestant. The `eliminated` prop is derived as `contestant.eliminatedInEpisode != null && contestant.eliminatedInEpisode <= episode.number`.

---

### Component: `ContestantSuspicionChip`

Props: `contestant`, `level: number | undefined`, `eliminated: boolean`, `onChange: (level: number | undefined) => void`.

Renders:
- Small circular portrait photo (or initials fallback).
- Contestant name (truncated, one line).
- Row of five `Star` icon buttons (filled/unfilled up to `level`). Clicking the currently active star clears it (`onChange(undefined)`); clicking any other star sets it.
- When `eliminated`: greyed out, strikethrough name, star buttons disabled.

---

### Component: `SuspectTimelinePanel`

Props: `contestants`, `episodes` (past only), `notes: Map<number, EpisodeNoteState>`, `onEpisodeSelect: (episodeNumber: number) => void`.

Renders a horizontally scrollable table:
- Rows: contestants (active first, then eliminated in order of elimination).
- Columns: one per past episode, labelled "Afl. N".
- Cells: filled-star count badge (1–5) or "–". Clicking a cell calls `onEpisodeSelect(episodeNumber)`, which switches the parent to `view === "episodes"` and scrolls to that episode's card (using a DOM ref or `scrollIntoView`).

---

### Contestant detail page: `ContestantDetailPage` additions

Alongside the existing `getGame(gameId)` fetch, fire a parallel `GET /api/games/{gameId}/molboekje` call. On success, filter:

```ts
const firstName = contestant.name.split(/\s+/)[0].toLowerCase();
const mentioningNotes = notes.filter(n =>
  n.content.toLowerCase().includes(firstName)
);
```

If `mentioningNotes` is non-empty, render an "In jouw molboekje" section below the bio. Each entry shows:
- "Aflevering N — [deadline date]"
- First 300 characters of `content` with occurrences of `firstName` wrapped in `<mark>` (case-preserving replacement).
- A "Bekijk notitie →" link to `/game/:gameId/molboekje`.

If `mentioningNotes` is empty or the notebook fetch fails, the section is omitted entirely — no empty state.

---

## Tests

### Backend

- `GET` returns empty `notes` array and `null` color for a new player.
- `PUT` creates a note record when none exists for that episode.
- `PUT` fully replaces the existing record (upsert); a second `PUT` with different `suspicionLevels` overwrites the first entirely.
- `GET` after `PUT` returns the saved content and suspicion levels.
- `PUT` with `suspicionLevels: {}` saves an empty suspicion map (clears all levels).
- `PUT` returns `422` if `episodeNumber` does not match any game episode.
- `PUT` returns `422` if `content` exceeds 5000 characters.
- `PUT` returns `422` if a `suspicionLevels` key is not a valid contestant ID.
- `PUT` returns `422` if a `suspicionLevels` value is outside 1–5.
- `PATCH /color` returns `204` and persists the color.
- `PATCH /color` returns `422` for an invalid color string.
- All endpoints return `401` for unauthenticated requests.
- All endpoints return `401` for authenticated users who are not members of the game.

### Frontend: `MolboekjePage`

- Loading skeletons shown while both fetches are in-flight.
- All past episodes rendered (including untouched ones with empty defaults), not just those returned by the API.
- Episode note content and suspicion levels rendered from API response.
- Changing textarea content enqueues a debounced `PUT`; saving indicator on that card transitions correctly.
- Changing a suspicion level fires `PUT` immediately; saving indicator on that card transitions correctly.
- Color swatch click fires `PATCH` and updates header color optimistically.
- Contestants eliminated before or during an episode are greyed out with stars disabled.
- View toggle switches between Afleveringen and Verdachten panels.
- Clicking a timeline cell switches to Afleveringen view.
- Error alert shown when API calls fail.

### Frontend: `ContestantDetailPage` additions

- "In jouw molboekje" section shown when at least one episode note contains the contestant's first name.
- "In jouw molboekje" section omitted when no notes match.
- "In jouw molboekje" section omitted when the notebook fetch fails (no error shown).
- Matched name is highlighted with `<mark>` in the excerpt.
- "Bekijk notitie" link points to the molboekje page.

---

## Coverage

All new backend and frontend code must maintain the project's 80% line/function/branch/statement threshold.
