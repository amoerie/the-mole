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
| 4 | Set up unit test frameworks | ✅ | Vitest (27 tests), xUnit (17 tests) |
| 5 | Configure Dependabot | ✅ | GitHub Actions, NuGet, npm — weekly |
| 6 | Strict .NET analysis + CSharpier + Prettier | ✅ | TreatWarningsAsErrors, AnalysisMode=Recommended |

## Phase 2: Architecture Migration (Azure Functions → ASP.NET Core + SQLite)
| # | Task | Status | Notes |
|---|------|--------|-------|
| 7 | Rewrite API as ASP.NET Core Minimal API + SQLite/EF Core | ✅ | EF Core 9, JSON columns, Migrations |
| 8 | Add GitHub OAuth authentication | ✅ | AspNet.Security.OAuth.GitHub, cookie sessions |
| 9 | Update api.tests to WebApplicationFactory | ✅ | 17 tests pass (ClaimsPrincipal-based auth tests) |
| 10 | Update frontend: Vite proxy + auth URLs | ✅ | /auth/login/github, proxy /api+/auth → :5000 |
| 11 | Create multi-stage Dockerfile | ✅ | node build → dotnet publish → aspnet runtime |
| 12 | Create fly.toml + DEPLOYMENT.md | ✅ | Fly.io Amsterdam, 1GB SQLite volume |
| 13 | Update CI: Docker build + Fly.io deploy | ✅ | GHCR push → flyctl deploy |
| 14 | Rewrite start-local.cmd | ✅ | dotnet watch + npm dev (50 lines, no SWA/Functions) |
| 15 | Remove Azure-specific files | ✅ | staticwebapp.config.json, swa-cli.config.json, AZURE_DEPLOYMENT.md deleted |

## Phase 3: Auth Migration (GitHub OAuth → Passwordless.dev)
| # | Task | Status | Notes |
|---|------|--------|-------|
| 17 | Remove GitHub OAuth, add Passwordless.AspNetCore + MailerSend NuGet | ⬜ | |
| 18 | Add AppUser entity + EF Core migration | ⬜ | Id, Email, DisplayName |
| 19 | Rewrite AuthRoutes: register, login, magic-link recovery | ⬜ | |
| 20 | Update AuthHelper to use internal AppUser IDs | ⬜ | |
| 21 | Update Player join logic to use AppUser IDs | ⬜ | |
| 22 | Frontend: registration page (email + name + passkey) | ⬜ | |
| 23 | Frontend: login page (email + passkey) | ⬜ | |
| 24 | Frontend: "can't login" magic-link recovery flow | ⬜ | |
| 25 | Remove all GitHub login links/buttons from frontend | ⬜ | |

## Phase 4: Test Coverage
| # | Task | Status | Notes |
|---|------|--------|-------|
| 26 | Integration tests: GameRoutes (create, get, join, by-invite, my-games, add-contestants) | ⬜ | |
| 27 | Integration tests: EpisodeRoutes (create, update, reveal-mole) | ⬜ | |
| 28 | Integration tests: RankingRoutes (submit, get mine, get all) | ⬜ | |
| 29 | Integration tests: LeaderboardRoutes (final, what-if) | ⬜ | |
| 30 | CI: add 80% line coverage gate for .NET (coverlet threshold) | ⬜ | |
| 31 | CI: add 80% coverage gate for frontend (Vitest v8) | ⬜ | |

## Phase 5: Polish
| # | Task | Status | Notes |
|---|------|--------|-------|
| 32 | Responsive design + De Mol theming | ⬜ | Dark theme, green accents |

