# De Mol Ranking Game 🕵️

A web game for playing along with the Belgian TV show "De Mol" (The Mole). Players rank
contestants from most to least suspicious each episode. After the finale reveals the mole,
cumulative scores determine the winner.

## How It Works

### Domain

| Concept | Description |
|---------|-------------|
| **Game** | The central object. One game = one season of De Mol among a group of friends. A game has contestants, episodes, and an invite code. |
| **Contestant** | A real participant from the TV show, configured by the game admin (name, age, photo). Contestants can be marked as eliminated in a given episode. |
| **Episode** | One weekly round. The admin creates it with a submission deadline. Once the deadline passes, no more rankings can be submitted and results become visible. |
| **User** | Anyone with an account. A user can participate in multiple games. |
| **Player** | A user's membership in a specific game. Created when a user joins via invite code. |
| **Ranking** | A player's ordered list of all active contestants for one episode — most suspicious to least suspicious. Can be updated until the deadline. |

### Use Cases

**As a game admin:**
1. Create a game and add contestants (name, age, photo).
2. Share the invite code with friends so they can register and join.
3. Each week: create a new episode with a deadline. Optionally mark which contestants were eliminated.
4. After the finale: reveal who the mole was — this unlocks the final leaderboard.

**As a player:**
1. Register an account and join the game with the invite code.
2. Each week: rank the remaining contestants from most to least suspicious before the deadline.
3. Browse the "what-if" leaderboard to see standings for any hypothetical mole.
4. After the finale: see the real leaderboard and your score breakdown per episode.

### Scoring

Each episode, players rank the remaining N contestants. Scores are calculated after the
mole is revealed:

```
Episode Score = round(((N - R) / (N - 1)) × 100)

N = remaining contestants that episode
R = rank position given to the actual mole (1 = most suspect)
```

- Every episode is worth 0–100 points, normalized regardless of contestant count
- Total score = sum of all episode scores
- Tiebreaker: player who ranked the mole higher in later episodes wins

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript (Vite) |
| Backend | ASP.NET Core 10 Minimal API (C#) |
| Database | SQLite + EF Core 9 |
| Auth | Email + password (cookie sessions), password reset via MailerSend |
| Hosting | Fly.io (free tier, Amsterdam) |
| CI/CD | GitHub Actions → GHCR → flyctl deploy |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 22+
- [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0)

### First-time setup

```bash
# 1. Install frontend dependencies
cd client && npm install && cd ..

# 2. Restore .NET tools (CSharpier, Husky.NET)
dotnet tool restore

# 3. Enable the pre-commit formatting hook (Husky.NET)
dotnet husky install
```

### Local Development

```bash
start-local.cmd
```

This opens two terminals:
- `dotnet watch run` — API on http://localhost:5000
- `npm run dev` — Vite dev server on http://localhost:5173 (proxies `/api` to :5000)

#### Configuration

Add to `api/appsettings.Development.json` (or use .NET user secrets):

```json
{
  "AdminEmail": "your@email.com",
  "MailerSend": {
    "ApiKey": "your-mailersend-api-key",
    "FromEmail": "noreply@yourdomain.com",
    "FromName": "De Mol"
  }
}
```

The SQLite database is created automatically at `api/themole.db` on first run.

### Running Tests

```bash
# Backend
dotnet test api.tests/Api.Tests.csproj

# Frontend
cd client && npm test

# Watch mode
cd client && npm run test:watch
```

## Project Structure

```
the-mole/
├── client/              # React + TypeScript SPA
│   ├── src/
│   │   ├── api/         # Orval-generated API client + hand-written wrapper
│   │   ├── components/  # Reusable components
│   │   ├── hooks/       # React hooks (auth context)
│   │   ├── pages/       # Route pages
│   │   ├── test/        # Vitest tests
│   │   └── types/       # TypeScript interfaces
│   └── package.json
├── api/                 # ASP.NET Core 10 Minimal API
│   ├── Auth/            # Auth helpers (cookie sign-in, password hashing)
│   ├── Data/            # EF Core DbContext + migrations
│   ├── Models/          # Data models
│   ├── Routes/          # Endpoint route handlers
│   ├── Services/        # Email service (MailerSend) + scoring
│   └── Api.csproj
├── api.tests/           # xUnit integration tests
├── .github/workflows/   # CI/CD (build → test → Docker → Fly.io)
├── .githooks/           # Git hooks (pre-commit: CSharpier + Prettier)
├── Dockerfile           # Multi-stage: node build → dotnet publish → aspnet runtime
├── fly.toml             # Fly.io deployment config
└── the-mole.slnx        # Solution file (JetBrains Rider)
```

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for full Fly.io setup instructions.

Pushes to `main` automatically build a Docker image, push it to GHCR, and deploy to Fly.io.
Required GitHub secret: `FLY_API_TOKEN`.
