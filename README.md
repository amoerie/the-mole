# De Mol Ranking Game 🕵️

A web game for playing along with the Belgian TV show "De Mol" (The Mole). Players rank
contestants from most to least suspicious each episode. After the finale reveals the mole,
cumulative scores determine the winner.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript (Vite) |
| Backend | ASP.NET Core 10 Minimal API (C#) |
| Database | SQLite + EF Core 9 |
| Auth | Passwordless.dev passkeys (Bitwarden) |
| Hosting | Fly.io (free tier, Amsterdam) |
| CI/CD | GitHub Actions → GHCR → flyctl deploy |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 22+
- [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0)
- A [Passwordless.dev](https://admin.passwordless.dev) account (free) — needed for passkey auth

### First-time setup

```bash
# 1. Install frontend dependencies
cd client && npm install && cd ..

# 2. Restore .NET tools (CSharpier formatter)
dotnet tool restore

# 3. Enable the pre-commit formatting hook
git config core.hooksPath .githooks
```

### Local Development

```bash
start-local.cmd
```

This opens two terminals:
- `dotnet watch run` — API on http://localhost:5000
- `npm run dev` — Vite dev server on http://localhost:5173 (proxies `/api` and `/auth` to :5000)

#### Auth credentials

Add your Passwordless.dev keys to `api/appsettings.Development.json` (or .NET user secrets):

```json
{
  "Passwordless": {
    "ApiKey": "your-app:public:...",
    "ApiSecret": "your-app:secret:..."
  }
}
```

Add the public key to `client/.env.local`:

```
VITE_PASSWORDLESS_API_KEY=your-app:public:...
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

## Scoring System

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

## Project Structure

```
the-mole/
├── client/              # React + TypeScript SPA
│   ├── src/
│   │   ├── api/         # API client
│   │   ├── components/  # Reusable components
│   │   ├── hooks/       # React hooks (auth, etc.)
│   │   ├── lib/         # Shared libraries (passwordless client)
│   │   ├── pages/       # Route pages
│   │   ├── test/        # Vitest tests
│   │   └── types/       # TypeScript interfaces
│   └── package.json
├── api/                 # ASP.NET Core 10 Minimal API
│   ├── Auth/            # Auth helpers
│   ├── Data/            # EF Core DbContext + migrations
│   ├── Models/          # Data models
│   ├── Routes/          # Endpoint route handlers
│   ├── Services/        # Business logic (scoring)
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

