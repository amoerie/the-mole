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

### Q2: Recommended Architecture (100% free)

**Azure Static Web Apps (free tier)** is the sweet spot for a .NET developer:

| Component | Service | Cost |
|-----------|---------|------|
| Frontend | React + TypeScript SPA | Free (hosted by SWA) |
| Backend API | Azure Functions (C# / .NET 8) | Free (integrated with SWA) |
| Database | Azure Cosmos DB (NoSQL API, free tier) | Free (1000 RU/s, 25 GB forever) |
| Hosting | Azure Static Web Apps (free tier) | Free (100 GB bandwidth/mo) |
| Auth | SWA built-in auth | Free (GitHub + Microsoft login) |
| CI/CD | GitHub Actions | Free (auto-configured by SWA) |

**Total monthly cost: $0**

### Q3: Authentication

The SWA free tier includes **built-in authentication** with:
- **GitHub login** ✅ (no config needed)
- **Microsoft account login** ✅ (no config needed)
- Google/Facebook/custom OAuth ❌ (requires Standard plan, ~$9/month)

Since this is for friends/colleagues, GitHub or Microsoft login should work fine. If you
really need Google login, the Standard plan is the only option.

**Simpler alternative:** Skip social login entirely. Use an invite-link system where each
player gets a unique URL token (e.g., `?token=abc123`). Stored in localStorage. No passwords,
no OAuth. Works on GitHub Pages too. Less secure but perfectly fine for a friend group.

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
3. **Join:** Players authenticate (GitHub/Microsoft) and join the game
4. **Weekly cycle (per episode):**
   a. Admin opens a new episode round (marks eliminated contestant from last episode)
   b. Players drag-and-drop rank the remaining contestants before the next episode airs
   c. Submission deadline = next episode air time (Sunday evening)
   d. Late/missing submissions → 0 points for that episode
5. **Finale:** Admin reveals who the mole is → all scores calculated → winner announced

---

## Data Model (Cosmos DB)

```
Game {
  id: string
  name: string ("De Mol 2026")
  adminUserId: string
  contestants: [{ id, name, age, photoUrl, eliminatedInEpisode? }]
  episodes: [{ number, deadline, eliminatedContestantId? }]
  moleContestantId?: string  // set after finale
  inviteCode: string
}

Player {
  id: string
  gameId: string
  userId: string
  displayName: string
  joinedAt: datetime
}

Ranking {
  id: string
  gameId: string
  episodeNumber: number
  userId: string
  rankings: [contestantId, contestantId, ...]  // ordered most→least suspect
  submittedAt: datetime
}
```

---

## Progress

### ✅ Phase 1: Project Foundation (COMPLETE)
- React + TypeScript SPA (Vite, React 19)
- Azure Functions .NET 8 isolated worker backend
- Cosmos DB service, scoring engine, auth helper
- 47 tests (20 xUnit + 27 Vitest) — all passing
- GitHub Actions CI: build + test on push to main & PRs
- SWA CLI config for local dev
- Docker Compose for Cosmos DB emulator (Podman-compatible)
- Azure deployment guide (AZURE_DEPLOYMENT.md)

### ⬜ Phase 2: Azure Resources (MANUAL — see AZURE_DEPLOYMENT.md)
### ⬜ Phase 3–6: Remaining work in todo.md

## Local Development

- **Cosmos DB Emulator**: Runs via Podman/Docker container (`docker-compose.yml`)
- **SWA CLI**: Proxies frontend + backend, simulates auth (`swa-cli.config.json`)
- **Testcontainers**: Integration tests spin up Cosmos DB emulator automatically
- **Frontend**: Vite dev server with hot reload + Vitest for tests
- **Backend**: Azure Functions Core Tools (`func start`) + xUnit tests

## Implementation Todos

1. **Scaffold project** — Create React + TypeScript SPA with Azure Functions (.NET 8) backend
2. **Set up Azure resources** — Static Web App + Cosmos DB (free tier)
3. **Implement auth** — SWA built-in auth (GitHub/Microsoft), get user identity in API
4. **Game management API** — CRUD for games, episodes, contestants (admin only)
5. **Ranking submission UI** — Drag-and-drop ranking interface (mobile-friendly!)
6. **Ranking API** — Submit/update rankings, enforce deadlines
7. **Leaderboard/results** — "What-if" view during season, final results after reveal
8. **Admin panel** — Mark eliminations, set deadlines, reveal mole
9. **Polish** — Contestant photos, responsive design, De Mol theming
