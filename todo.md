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
| 1 | Scaffold React + TypeScript SPA | ⬜ | Vite, React 18, TypeScript |
| 2 | Scaffold Azure Functions (.NET 8) backend | ⬜ | C# isolated worker |
| 3 | Configure Azure Static Web Apps config | ⬜ | staticwebapp.config.json, auth routes |
| 4 | Set up GitHub Actions CI/CD | ⬜ | Build + test + deploy |
| 5 | Set up unit test frameworks | ⬜ | Vitest (frontend), xUnit (backend) |

## Phase 2: Azure Resources
| # | Task | Status | Notes |
|---|------|--------|-------|
| 6 | Create Azure Static Web App | ⬜ | Free tier |
| 7 | Create Azure Cosmos DB account | ⬜ | Free tier, NoSQL API |
| 8 | Configure connection strings / secrets | ⬜ | GitHub secrets + SWA env vars |

## Phase 3: Authentication
| # | Task | Status | Notes |
|---|------|--------|-------|
| 9 | Wire up SWA built-in auth (GitHub + Microsoft) | ⬜ | /.auth/login routes |
| 10 | Create auth context in React | ⬜ | useAuth hook, user state |
| 11 | Get user identity in Azure Functions | ⬜ | Parse x-ms-client-principal header |

## Phase 4: Core API
| # | Task | Status | Notes |
|---|------|--------|-------|
| 12 | Cosmos DB repository layer | ⬜ | Generic CRUD, partition keys |
| 13 | Game management endpoints | ⬜ | Create, get, join game |
| 14 | Episode management endpoints | ⬜ | Open episode, mark elimination |
| 15 | Ranking submission endpoint | ⬜ | Submit/update, deadline enforcement |
| 16 | Leaderboard/scoring endpoint | ⬜ | What-if + final scoring |

## Phase 5: Frontend UI
| # | Task | Status | Notes |
|---|------|--------|-------|
| 17 | Home / game lobby page | ⬜ | Create or join a game |
| 18 | Drag-and-drop ranking interface | ⬜ | Mobile-friendly, contestant photos |
| 19 | Leaderboard / what-if view | ⬜ | During season + final results |
| 20 | Admin panel | ⬜ | Manage episodes, reveal mole |

## Phase 6: Polish
| # | Task | Status | Notes |
|---|------|--------|-------|
| 21 | De Mol visual theming | ⬜ | Dark theme, green accents |
| 22 | Responsive design (mobile-first) | ⬜ | |
| 23 | Contestant photos integration | ⬜ | From play.tv |
| 24 | Error handling & loading states | ⬜ | |
