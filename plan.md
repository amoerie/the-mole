# De Mol Ranking Game — Project Plan

## Problem Statement

Build a web game for "De Mol" (Season 14, 2026) where ~10-30 friends/colleagues rank
remaining contestants each episode from "most likely the mole" to "least likely." After the
finale reveals the actual mole, cumulative scores determine the winner.

## Key Decisions

### Q1: GitHub Pages or do I need a backend?

**GitHub Pages alone won't work.** It's static-only — no server-side storage, no auth. You'd
need every player to manually share rankings (defeats the purpose). You **need a backend** for:
- Storing each player's rankings per episode
- Authentication (know who submitted what)
- Deadline enforcement (lock submissions before episodes air)
- Leaderboard calculation

### Q2: Recommended Architecture

**ASP.NET Core Minimal API + SQLite + Docker** deployed on **Fly.io** (free tier).

> Azure SWA managed .NET functions were tried but abandoned — broken at the infrastructure
> level since Sep 2025 (9+ unresolved GitHub issues). Cosmos DB was overengineered for ~20 players.

| Component | Service | Cost |
|-----------|---------|------|
| Frontend + API | .NET 10 ASP.NET Core (serves both) | ~$0 on Fly.io free tier |
| Database | SQLite on persistent Fly.io volume | $0 |
| Auth | Passwordless.dev passkeys (Bitwarden) + MailerSend magic-link recovery | $0 |
| Hosting | Fly.io free tier (3 shared VMs, 3 GB volume) | $0 |
| CI/CD | GitHub Actions → GHCR → flyctl deploy | $0 |
| Custom domain | Any registrar (~€10/yr) + free SSL via Fly.io | ~€10/year |

### Q3: Authentication

**Passwordless.dev** (Bitwarden) passkeys via `Passwordless.AspNetCore`. Cookie-based sessions.

Registration flow:
1. New user enters **email + display name** → browser creates passkey
2. Returning user enters email → browser authenticates with passkey
3. "Can't login" → enters email → magic link sent via MailerSend → re-register passkey

Replaces GitHub OAuth entirely — no OAuth app setup needed, no GitHub account required.
Free tier: 1 admin + 10,000 users (more than sufficient for ~30 players).

For magic-link recovery emails: **MailerSend** (3,000 emails/month free, .NET SDK available).

### Q4: Could I also use GitHub Pages (no Azure at all)?

Yes, with compromises. You could use **GitHub Pages + Supabase (free tier)**:
- Supabase gives you PostgreSQL + auth + REST API for free
- But you'd write the backend logic in SQL/JS rather than C#
- This is a viable alternative if you want zero Azure involvement

---

## Scoring System

### Recommended: Normalized Borda Count (0–100 per episode)

Each episode, every player ranks the remaining N contestants. After the mole is revealed
in the finale, scores are calculated retroactively:

```
Episode Score = round(((N - R) / (N - 1)) × 100)

Where:
  N = number of remaining contestants that episode
  R = rank position the player assigned to the actual mole (1 = most suspect)
```

| Rank given to mole | 10 contestants | 5 contestants | 3 contestants |
|---------------------|---------------|---------------|---------------|
| #1 (most suspect) | 100 | 100 | 100 |
| #2 | 89 | 75 | 50 |
| #3 | 78 | 50 | 0 |
| #5 | 56 | 0 | — |
| #10 (least suspect) | 0 | — | — |

**Why this works:**
- Each episode is worth the same (0–100), regardless of how many contestants remain
- Rewards consistent correct guessing across the whole season
- No single episode is disproportionately important
- Simple to explain: "How much of your ranking was above the mole?"

**Total score** = sum of all episode scores. Max = 100 × number of episodes.

**Tiebreaker:** If two players have the same total, the one who ranked the mole higher
in the **most recent episodes** wins (later conviction = more informed).

### Alternative: Finale-Weighted Scoring

If you want the finale to matter more (keep things exciting even if someone is far ahead):
- Episodes 1–7: normal scoring (0–100 each, max 700)
- Finale (episode 8): **triple points** (0–300)
- Total max = 700 + 300 = 1000

### Important UX Note

Since the mole is only revealed in the finale, you **cannot show real scores during the
season**. Instead, show:
- Each player's ranking history (transparent)
- "What-if" scenarios: "If [contestant] is the mole, here's the leaderboard"
- After the finale: the real, definitive leaderboard

This actually adds to the fun — players can speculate about standings!

---

## Candidates (Season 14)

| # | Name | Age | Photo URL slug | Page |
|---|------|-----|----------------|------|
| 1 | Abigail | 33 | demols14500x500abigail-tcb0dt.png | /de-mol/abigail |
| 2 | Dries | 30 | demols14500x500dries-tcb0qr.png | /de-mol/dries |
| 3 | Isabel | 51 | demols14500x500isabel-tcb11c.png | /de-mol/isabel |
| 4 | Karla | 52 | demols14500x500karla-tcb19o.png | /de-mol/karla |
| 5 | Maïté | 26 | demols14500x500maite-tcb1h1.png | /de-mol/maite |
| 6 | Vincent | 51 | demols14500x500vincent-tcb1mj.png | /de-mol/vincent |
| 7 | Wout | 33 | demols14500x500wout-tcb1pm.png | /de-mol/wout |
| 8 | Maxim | 26 | demols14500x500maxim-tcb1k7.png | /de-mol/maxim |
| 9 | Julie | 26 | demols14500x500julie-tcb14l.png | /de-mol/julie |
| 10 | Kristof | 40 | demols14500x500kristof-tcb1ct.png | /de-mol/kristof |

---

## Game Flow

1. **Setup (admin):** Create the game, configure season with 10 contestants
2. **Invite:** Share a join link with friends/colleagues
3. **Join:** Players authenticate with GitHub and join the game
4. **Weekly cycle (per episode):**
   a. Admin opens a new episode round (marks eliminated contestant from last episode)
   b. Players drag-and-drop rank the remaining contestants before the next episode airs
   c. Submission deadline = next episode air time (Sunday evening)
   d. Late/missing submissions → 0 points for that episode
5. **Finale:** Admin reveals who the mole is → all scores calculated → winner announced

---

## Data Model (SQLite / EF Core)

```
Game {
  id: string (PK)
  name: string
  adminUserId: string
  contestants: JSON → [{ id, name, age, photoUrl, eliminatedInEpisode? }]
  episodes: JSON → [{ number, deadline, eliminatedContestantId? }]
  moleContestantId?: string  // set after finale
  inviteCode: string (unique index)
}

Player {
  id: string (PK)
  gameId: string
  userId: string
  displayName: string
  joinedAt: datetime
  (unique index: gameId + userId)
}

Ranking {
  id: string (PK)
  gameId: string
  episodeNumber: int
  userId: string
  contestantIds: JSON → [contestantId, ...]  // ordered most→least suspect
  submittedAt: datetime
  (unique index: gameId + episodeNumber + userId)
}
```

---

## Progress

### ✅ Phase 1: Project Foundation (COMPLETE)
- React + TypeScript SPA (Vite, React 19), xUnit + Vitest tests
- Strict .NET analysis (TreatWarningsAsErrors, AnalysisMode=Recommended), CSharpier, ESLint/Prettier
- Dependabot for GitHub Actions, NuGet, npm
- Contestant photos downloaded as local assets (`client/public/contestants/`)

### ✅ Phase 2: Architecture Migration (COMPLETE — branch `feat/migrate-to-aspnetcore-sqlite`)
- ASP.NET Core 10 Minimal API + SQLite/EF Core 9 (JSON columns, migrations)
- GitHub OAuth replacing Azure SWA built-in auth
- Multi-stage Dockerfile + `fly.toml` (Amsterdam, 1 GB SQLite volume)
- CI: Docker build → GHCR → flyctl deploy
- Simplified `start-local.cmd`: `dotnet watch run` + `npm run dev`
- Tests: 17 .NET + 27 frontend, all green

### ⬜ Pending (one-time manual setup before first deploy)
1. Sign up at passwordless.dev → create app → get ApiKey + ApiSecret
2. Sign up at MailerSend → verify domain → get API key
3. `flyctl apps create the-mole && flyctl volumes create the_mole_data --region ams --size 1`
4. `flyctl secrets set Passwordless__ApiKey=... Passwordless__ApiSecret=... MailerSend__ApiKey=...`
5. Add `FLY_API_TOKEN` to GitHub repo secrets → merge PR → CI deploys

### ⬜ Phase 3: Auth Migration (GitHub OAuth → Passwordless.dev)

Replace GitHub OAuth with passkey-based auth. No GitHub account required.

**Backend:**
- Remove `AspNet.Security.OAuth.GitHub` package + all OAuth config
- Add `Passwordless.AspNetCore` + `MailerSend` NuGet packages
- Add `AppUser` entity (Id, Email, DisplayName) + EF Core migration
- Rewrite `AuthRoutes.cs`: register, login, magic-link recovery endpoints
- Update `AuthHelper` to read from cookie/session (userId = AppUser.Id)
- Update `Player` join logic to use internal user IDs (not GitHub IDs)

**Frontend:**
- Registration page: email + display name → call `/api/auth/register` → browser passkey prompt
- Login page: email → call `/api/auth/login` → browser passkey prompt
- "Can't login" flow: email → POST `/api/auth/recover` → "check your email" message
- Remove all GitHub login links/buttons

### ⬜ Phase 4: Test Coverage

Goal: enforce 80% code coverage in CI for both .NET and frontend.

**Write missing .NET integration tests** (using `WebApplicationFactory`):
- `GameRoutes`: create, get, join, get-by-invite, my-games, add-contestants
- `EpisodeRoutes`: create episode, update episode, reveal mole
- `RankingRoutes`: submit ranking, get mine, get all
- `LeaderboardRoutes`: final leaderboard, what-if leaderboard

**Add coverage gates to CI:**
- .NET: coverlet threshold 80% (lines) — fail build if below
- Frontend: Vitest v8 coverage with 80% threshold on lines/functions/branches

### ⬜ Phase 5: Polish
- Responsive design + De Mol theming (dark theme, green accents)

## Local Development

- `start-local.cmd`: opens two windows — `dotnet watch run` (port 5000) + `npm run dev` (port 5173)
- Vite proxies `/api` and `/auth` to `localhost:5000` automatically
- GitHub OAuth credentials go in `api/appsettings.Development.json` or .NET user secrets
- SQLite DB created at `api/themole.db` on first run (migrations applied automatically)
