# Password Migration Plan

Replace Passwordless.dev passkeys with simple email+password auth. Add password reset via
MailerSend email. Add full game deletion. Add rate limiting to login and invite-code endpoints.

---

## Tasks

### 1. Backend — AppUser model & migration
- [x] Add `PasswordHash` (string), `PasswordResetToken` (string?), `PasswordResetTokenExpiry` (DateTimeOffset?) to `AppUser`
- [x] Create EF Core migration: `AddPasswordToAppUser`

### 2. Backend — NuGet packages
- [x] Remove `Passwordless` package from `api/Api.csproj`
- [x] Add `MailerSend` NuGet package (official MailerSend .NET SDK, free tier: 3,000 emails/month)

### 3. Backend — Email service
- [x] Create `Api/Services/IEmailService.cs` (interface: `SendPasswordResetAsync(email, resetUrl)`)
- [x] Create `Api/Services/MailerSendEmailService.cs` (calls MailerSend API via SDK)
- [x] Register `IEmailService` in `Program.cs`

### 4. Backend — Rewrite AuthRoutes.cs
- [x] `POST /api/auth/register` — email + displayName + password + inviteCode → hash password, create user, sign in
- [x] `POST /api/auth/login` — email + password → verify hash → cookie session (rate limited)
- [x] `POST /api/auth/forgot-password` — email → generate token (24h expiry) → send reset link via IEmailService
- [x] `POST /api/auth/reset-password` — token + newPassword → validate token, update hash, clear token
- [x] Remove: `/api/auth/verify`, `/api/auth/reset-passkey`, `/api/auth/recover`
- [x] Keep unchanged: `GET /api/auth/logout`, `GET /api/me`, `PATCH /api/me`

### 5. Backend — Rate limiting (built-in ASP.NET Core, no extra package)
- [x] Add `builder.Services.AddRateLimiter()` in `Program.cs`
- [x] "login" policy: fixed window, 10 requests / 1 minute / IP (keyed on `X-Forwarded-For` or `RemoteIpAddress`)
- [x] "inviteCode" policy: fixed window, 20 requests / 1 minute / IP
- [x] Apply `RequireRateLimiting("login")` to `POST /api/auth/login`
- [x] Apply `RequireRateLimiting("inviteCode")` to `GET /api/games/by-invite/{inviteCode}`
- [x] Add `app.UseRateLimiter()` to middleware pipeline (before `UseAuthentication`)

### 6. Backend — Delete game endpoint
- [x] Add `DELETE /api/games/{gameId}` in `GameRoutes.cs`
  - Must be authenticated + game admin
  - Delete all `Rankings` for this game
  - Delete all `Players` for this game
  - Delete the `Game`
  - Return 204 NoContent

### 7. Backend — Program.cs cleanup
- [x] Remove `builder.Services.AddPasswordlessSdk(...)` and `using Passwordless;`
- [x] Register email service + rate limiter
- [x] Add `app.UseRateLimiter()` to pipeline

### 8. Frontend — Replace auth pages
- [x] `LoginPage.tsx` — email + password fields; remove all passkey/passwordless logic
- [x] `RegisterPage.tsx` — email + displayName + password + confirmPassword; remove passkey
- [x] Delete `RecoveryPage.tsx` and `MagicLinkPage.tsx`
- [x] Add `ForgotPasswordPage.tsx` — email input → POST `/api/auth/forgot-password`
- [x] Add `ResetPasswordPage.tsx` — reads `?token=` from URL → new password form → POST `/api/auth/reset-password`
- [x] Delete `client/src/lib/passwordless.ts`
- [x] Update router (`App.tsx`): swap `/recover` → `/forgot-password`, `/magic-link` → `/reset-password`, remove unused routes

### 9. Frontend — API client
- [x] Remove `verifyPasskey`, `resetPasskey` methods
- [x] Add `login(email, password)`, `register(email, displayName, password, inviteCode?)`, `forgotPassword(email)`, `resetPassword(token, newPassword)` methods in `client/src/api/client.ts`

### 10. Frontend — package.json
- [x] Remove `@passwordlessdev/passwordless-client` dependency

### 11. Tests — Backend
- [x] Update `CustomWebApplicationFactory.cs`: remove IPasswordlessClient mock; add fake IEmailService
- [x] Remove `Helpers/FakePasswordlessClient.cs`
- [x] Remove `Passwordless` package reference from `api.tests/Api.Tests.csproj`
- [x] Rewrite `AuthRoutesTests.cs`: test register-with-password, login success/fail, forgot-password (both known/unknown email), reset-password (valid/expired/invalid token), logout, GetMe, UpdateProfile
- [x] Add to `GameRoutesTests.cs`: `DeleteGame_AsAdmin_Returns204`, `DeleteGame_AsNonAdmin_Returns403`, `DeleteGame_NotFound_Returns404`, `DeleteGame_CascadesPlayersAndRankings`

### 12. Tests — Frontend
- [x] Update `LoginPage.test.tsx` — remove passkey tests, test email+password form
- [x] Update `RegisterPage.test.tsx` — remove passkey tests, test password fields
- [x] Delete `RecoveryPage.test.tsx` and `MagicLinkPage.test.tsx`
- [x] Add `ForgotPasswordPage.test.tsx`
- [x] Add `ResetPasswordPage.test.tsx`

### 13. Config & docs
- [x] Update `appsettings.json`: remove `Passwordless` section, add `MailerSend` section (`ApiKey`, `FromEmail`, `FromName`)
- [x] Update `appsettings.Development.json`: add placeholder MailerSend config
- [x] Update `DEPLOYMENT.md`: replace GitHub OAuth / Passwordless secrets with password-auth secrets
- [x] Update `fly.toml` env if needed

---

## Decisions

| Topic | Decision |
|-------|----------|
| Password hashing | `Rfc2898DeriveBytes.Pbkdf2` — built into .NET, no extra package |
| Email provider | MailerSend (3,000 free emails/month, official .NET SDK) |
| Password reset token | Cryptographically random 32-byte token, stored hashed, 24h expiry |
| Rate limiting | Built-in `Microsoft.AspNetCore.RateLimiting` (ASP.NET Core 7+, no extra NuGet) |
| Register flow | Admin email: no invite code needed. Others: must supply valid invite code |
| Existing users | Migration adds nullable `PasswordHash` — existing users must re-register |
