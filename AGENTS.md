# Agent Guide (AGENTS.md)

Welcome, agent! This guide provides technical details on how to maintain, test, and evolve the codebase.

## 🏗️ Project Architecture & Functionality

The project is a web game for "De Mol" (The Mole), where players rank contestants each episode.
- **API**: A .NET 10.0 Web API using Entity Framework Core (SQLite). It handles authentication, game state, rankings, and scoring.
- **Client**: A React 19 application built with Vite, TypeScript, and Tailwind CSS. It provides the user interface for ranking, leaderboard, and admin management.

### Key Logic: Scoring
Scores are calculated after the mole is revealed. Each episode is worth 0–100 points based on how high the player ranked the actual mole.
`Score = round(((N - R) / (N - 1)) × 100, 2)` (rounded to two decimal places)

---

## 🚀 Adding a New Feature

### 1. Backend: Adding a New Endpoint

1.  **Define Model (if needed):** Add a new class in `api/Models/`.
2.  **Update DbContext:** Add a `DbSet<T>` to `api/Data/AppDbContext.cs`.
3.  **Create Route Handler:**
    - Add a new static class in `api/Routes/` (e.g., `NewFeatureRoutes.cs`).
    - Use the `WebApplication` extension method pattern: `public static void MapNewFeatureRoutes(this WebApplication app)`.
    - Register it in `api/Program.cs` using `app.MapNewFeatureRoutes()`.
4.  **Implement Logic:** Use Minimal API features (`app.MapGet`, `app.MapPost`, etc.).
    - Use `AuthHelper.GetUserInfo(ctx)` for authentication/authorization.
    - Return `Results.Ok()`, `Results.BadRequest()`, etc.
    - Use `WithName("OperationName")` and `WithTags("Tag")` for OpenAPI.

### 2. Frontend: Consuming the New Endpoint

1.  **Regenerate Client:** Run `dotnet build api/Api.csproj` then `cd client && npm run generate`.
2.  **Update Mapper (optional):** If the generated types need cleanup, update `client/src/api/mappers.ts`.
3.  **Update Client Wrapper:** Update `client/src/api/client.ts` to include the new method, calling the generated function.

### 3. Frontend: Adding a New Component/Page

1.  **Components:** Add to `client/src/components/`. Use shadcn/ui components from `client/src/components/ui/` for consistency.
2.  **Pages:** Add to `client/src/pages/`.
3.  **Routing:** Register the new page in `client/src/App.tsx`.
4.  **Hooks:** Use `useAuth()` for user session info and `useQuery` (or `useEffect` + `api`) for data fetching.

---

## 🧪 Testing

### Backend Integration Tests (`api.tests/`)
- Create a new test class with `IClassFixture<CustomWebApplicationFactory>` and hold a `TestContext` field (not `_factory` directly).
- Construct `TestContext` in the constructor: `_ctx = new TestContext(factory)`. Pass optional `userId`, `displayName`, or `roles` for non-default auth (e.g. `roles: ["authenticated"]` for non-admin tests).
- Use `_ctx.PrepareDb(seed?)` to reset the DB and optionally seed data before each test.
- Use `_ctx.CreateClient()` to get an `HttpClient`.
- Use `TestData` static helpers (`TestData.Game()`, `TestData.GameWithContestants()`, `TestData.GameWithPlayer()`, `TestData.Player()`, `TestData.User()`, `TestData.Episode()`) for common seed data instead of constructing entities inline.
- Use `_ctx.AsUnauthenticated()` or `_ctx.AsNonAdmin()` (both return `IDisposable`) in a `using` block to temporarily change auth state — no manual `TestAuthHandler` manipulation or `try/finally` needed.
- Use `_ctx.ReadDb<T>()` / `_ctx.ReadDbAsync<T>()` to inspect the database after a request instead of opening scopes manually.

### Frontend Unit/Component Tests (`client/src/test/`)
- Use **Vitest** + **React Testing Library**.
- Mock the API: `vi.mock('../api/client', ...)` to isolate component logic.
- Provide auth/context wrappers in your test setup (many tests define a local `renderWithAuth` helper in the test file to do this).
- Assert using `screen.getByText`, `expect(...).toBeInTheDocument()`, etc.
- Use `fireEvent` or `userEvent` to simulate interactions.

---

## 🛠️ Tooling & Maintenance

### 🧪 Testing & Coverage

We enforce an **80% code coverage** threshold for both the API and the Client in CI.
Before opening a pull request, run the coverage commands for both backend and frontend locally and ensure new or changed code is covered by tests; avoid lowering coverage thresholds unless there is an explicit team decision and update or add tests whenever you modify behavior.

### Backend (.NET)
- **Run tests:** `dotnet test api.tests/Api.Tests.csproj`
- **Check coverage:**
  ```powershell
  dotnet test api.tests/Api.Tests.csproj --collect:"XPlat Code Coverage" --settings coverage.runsettings
  ```

### Frontend (React/Vite)
- **Run tests:** `npm run test` (in `client/`)
- **Check coverage:** `npm run test:coverage` (in `client/`)
- **Thresholds:** Configured in `client/vite.config.ts` (80% for lines, statements, functions, and branches).
- **Exclusions:** `client/src/api/generated.ts` is excluded from coverage as it is auto-generated.

## 📖 OpenAPI & Client Generation

The frontend API client is generated from the backend's OpenAPI specification.

### 1. Regenerate OpenAPI Spec
The OpenAPI spec (`api/openapi.json`) is generated automatically when you build the API project:
```powershell
dotnet build api/Api.csproj
```
*Note: This is enabled by `OpenApiGenerateDocumentsOnBuild` in `api/Api.csproj`.*

### 2. Regenerate Frontend Client
Once `api/openapi.json` is updated, regenerate the Orval client:
```powershell
cd client
npm run generate
```
This updates `client/src/api/generated.ts`.

## 🗄️ Database Migrations

We use Entity Framework Core with SQLite.

- **Add a migration:**
  ```powershell
  dotnet ef migrations add YourMigrationName --project api/Api.csproj
  ```
- **Update database:**
  ```powershell
  dotnet ef database update --project api/Api.csproj
  ```

## 🧹 Code Quality

### Backend
- **Formatting:** We use CSharpier. Run `dotnet csharpier .` to format.
- **Linting:** Standard .NET analyzers are enabled via `AnalysisMode: Recommended`.
- **Strict Mode:** `TreatWarningsAsErrors` and `EnforceCodeStyleInBuild` are enabled in `Directory.Build.props`. Any violation or warning will fail the build.

### Frontend
- **Formatting:** We use Prettier. Run `npm run format`.
- **Linting:** We use ESLint. Run `npm run lint`.

## 🚀 CI/CD

- GitHub Actions (`.github/workflows/ci.yml`) runs on every push and PR to `main`.
- It enforces formatting, linting, build, and the 80% coverage threshold.
- Successful builds on `main` are automatically deployed to Fly.io.
