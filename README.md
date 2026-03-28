# De Mol Ranking Game 🕵️

A web game for playing along with the Belgian TV show "De Mol" (The Mole). Players rank
contestants from most to least suspicious each episode. After the finale reveals the mole,
cumulative scores determine the winner.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + TypeScript (Vite) |
| Backend | Azure Functions (.NET 8, C#) |
| Database | Azure Cosmos DB (NoSQL) |
| Hosting | Azure Static Web Apps (free tier) |
| Auth | Built-in SWA auth (GitHub / Microsoft) |
| CI/CD | GitHub Actions |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)
- [Azure Functions Core Tools](https://learn.microsoft.com/en-us/azure/azure-functions/functions-run-local) v4
- [SWA CLI](https://azure.github.io/static-web-apps-cli/) (`npm install -g @azure/static-web-apps-cli`)
- [Podman](https://podman.io/) or Docker (for Cosmos DB emulator)

### Local Development

1. **Start the Cosmos DB emulator:**
   ```bash
   docker-compose up -d   # or: podman-compose up -d
   ```

2. **Install dependencies:**
   ```bash
   cd client && npm install
   cd ../api && dotnet restore
   ```

3. **Run with SWA CLI** (recommended — handles auth simulation + proxying):
   ```bash
   swa start
   ```
   This starts the Vite dev server, Azure Functions, and proxies everything through
   `http://localhost:4280` with simulated authentication.

4. **Or run individually:**
   ```bash
   # Terminal 1: Frontend
   cd client && npm run dev

   # Terminal 2: Backend
   cd api && func start

   # Terminal 3: SWA proxy
   swa start http://localhost:5173 --api-location http://localhost:7071
   ```

### Running Tests

```bash
# Frontend tests
cd client && npm test

# Backend tests
cd api.tests && dotnet test

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
│   │   ├── pages/       # Route pages
│   │   ├── test/        # Test setup
│   │   └── types/       # TypeScript interfaces
│   └── package.json
├── api/                 # Azure Functions (.NET 8)
│   ├── Auth/            # Auth helpers
│   ├── Functions/       # HTTP trigger functions
│   ├── Models/          # Data models
│   ├── Services/        # Business logic
│   └── Api.csproj
├── api.tests/           # xUnit tests
├── .github/workflows/   # CI/CD
├── staticwebapp.config.json
├── docker-compose.yml   # Cosmos DB emulator
└── swa-cli.config.json  # SWA CLI config
```

## Deployment

Pushes to `main` automatically deploy via GitHub Actions to Azure Static Web Apps.
Set the `AZURE_STATIC_WEB_APPS_API_TOKEN` secret in your GitHub repository settings.
