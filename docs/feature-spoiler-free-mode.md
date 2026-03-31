# Feature: Spoiler-Free Mode

## Overview

Spoiler-free mode prevents the game page from visually revealing which contestant was eliminated in the most recent episode. This protects players who have not yet watched the latest episode from being spoiled when they visit the site.

## Motivation

Players complained that visiting the game page before watching the latest episode would immediately reveal who was eliminated, because that contestant's card appears faded (40% opacity). Spoiler-free mode is enabled by default so no action is needed for visitors who want to avoid spoilers.

## Behaviour

- **Default state:** spoiler-free mode is **on**.
- When on, contestants eliminated in the most recent episode are displayed normally — indistinguishable from still-active contestants. Contestants eliminated in earlier episodes continue to appear faded, as those results are already public knowledge.
- A **toggle button** ("Spoilervrij" / "Spoilers zichtbaar") is shown in the Kandidaten card header, but only when the latest episode has at least one elimination to hide.
- The eliminated count in the card description also excludes the latest episode's eliminations while spoiler-free mode is on.
- **Disabling spoiler-free mode** reveals all eliminations and stores the preference in `localStorage` so the choice survives a page refresh.
- **Auto-reset:** the preference is stored alongside the episode count at the time the user disabled it. When a new episode is added (the count increases), the stored preference is considered stale and spoiler-free mode automatically re-enables for the new episode.

## Storage

`localStorage` key: `spoilerFree_<gameId>`

Value shape:
```json
{ "disabledForEpisodeCount": 2 }
```

The key is absent when spoiler-free mode is enabled. It is removed when the user explicitly re-enables the mode.

## Scope

This is a purely frontend, per-browser preference. It does not affect the ranking board, active contestant calculation, or any backend logic.

## Tests

Frontend Vitest tests cover:
- Toggle button visibility (shown only when latest episode has eliminations)
- Default spoiler-free state hides latest elimination from display
- Disabling reveals all eliminations and updates the count
- `localStorage` is written on disable and cleared on re-enable
- Stored preference is restored correctly on page load
- Auto-reset when a new episode has been added since the preference was saved
