# De Mol Ranking Game — TODO Tracker

## Status Legend
- ⬜ Not started
- 🔨 In progress
- ✅ Done
- 🚫 Blocked

---

## Phase 1: Project Foundation
| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Scaffold React + TypeScript SPA | ✅ | Vite, React 19, TypeScript |
| 2 | Scaffold backend | ✅ | ASP.NET Core Minimal API (migrated from Azure Functions) |
| 3 | Set up GitHub Actions CI/CD | ✅ | Build + test + deploy pipeline |
| 4 | Set up unit test frameworks | ✅ | Vitest (27 tests), xUnit (20 tests) |
| 5 | Configure Dependabot | ✅ | GitHub Actions, NuGet, npm — weekly |
| 6 | Strict .NET analysis + CSharpier + Prettier | ✅ | TreatWarningsAsErrors, AnalysisMode=Recommended |

## Phase 2: Architecture Migration (Azure Functions → ASP.NET Core + SQLite)
| # | Task | Status | Notes |
|---|------|--------|-------|
| 7 | Rewrite API as ASP.NET Core Minimal API + SQLite/EF Core | 🔨 | Replaces Azure Functions + Cosmos DB |
| 8 | Add GitHub OAuth authentication | ⬜ | AspNet.Security.OAuth.GitHub |
| 9 | Update api.tests to WebApplicationFactory | ⬜ | |
| 10 | Update frontend: Vite proxy + auth URLs | ⬜ | /.auth/* → /auth/* |
| 11 | Create multi-stage Dockerfile | ⬜ | node build → dotnet publish → aspnet runtime |
| 12 | Create fly.toml + DEPLOYMENT.md | ⬜ | Fly.io, Amsterdam region |
| 13 | Update CI: Docker build + Fly.io deploy | ⬜ | ghcr.io → flyctl deploy |
| 14 | Rewrite start-local.cmd | ⬜ | dotnet watch + npm dev (no SWA/Functions tools) |
| 15 | Remove Azure-specific files | ⬜ | staticwebapp.config.json, swa-cli.config.json etc. |

## Phase 3: Polish
| # | Task | Status | Notes |
|---|------|--------|-------|
| 16 | Responsive design + De Mol theming | ⬜ | |

