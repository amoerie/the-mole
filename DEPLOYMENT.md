# Deployment Guide

De Mol Ranking Game is deployed as a single Docker container on **Fly.io** (free tier).

## Architecture

- **Single container**: ASP.NET Core 10 serves both the API and the React SPA
- **Database**: SQLite stored on a Fly.io persistent volume at `/data/themole.db`
- **Auth**: Email + password (cookie-based sessions), password reset via MailerSend
- **CI/CD**: GitHub Actions builds the Docker image, pushes to GitHub Container Registry (GHCR), then deploys to Fly.io

## Prerequisites

- [Fly.io account](https://fly.io/app/sign-up) (free)
- [flyctl CLI](https://fly.io/docs/hands-on/install-flyctl/)
- A [MailerSend account](https://www.mailersend.com/) (free tier: 3,000 emails/month) with a verified sending domain

## First-time Setup

### 1. Create the Fly.io app

```sh
flyctl auth login
flyctl apps create the-mole
flyctl volumes create the_mole_data --region ams --size 1
```

### 2. Set secrets

```sh
flyctl secrets set AdminEmail=you@yourdomain.com
flyctl secrets set MailerSend__ApiKey=<your-mailersend-api-key>
flyctl secrets set MailerSend__FromEmail=noreply@yourdomain.com
flyctl secrets set MailerSend__FromName="De Mol"
```

### 3. Add GitHub Actions secrets

In your GitHub repository settings → Secrets and variables → Actions:

| Secret | Value |
|--------|-------|
| `FLY_API_TOKEN` | From `flyctl auth token` |

The `GITHUB_TOKEN` is automatically available in Actions for pushing to GHCR.

### 4. Deploy

Push to `main` — GitHub Actions will:
1. Build & test the API (.NET) and client (React)
2. Build the Docker image and push to `ghcr.io/<owner>/the-mole`
3. Deploy the image to Fly.io

### 5. Custom domain (optional)

```sh
flyctl certs create your-domain.com
```

Then add a CNAME record at your registrar: `your-domain.com → the-mole.fly.dev`

## Local Development

Run `start-local.cmd` — it starts:
- **API** (`dotnet watch run`): `http://localhost:5000`
- **Frontend** (Vite dev server): `http://localhost:5173`

Vite proxies `/api` requests to the .NET API automatically.

### Local dev configuration

Add to `api/appsettings.Development.json`:

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

Or use [.NET user secrets](https://learn.microsoft.com/en-us/aspnet/core/security/app-secrets):

```sh
cd api
dotnet user-secrets set "MailerSend:ApiKey" "your-api-key"
dotnet user-secrets set "MailerSend:FromEmail" "noreply@yourdomain.com"
```
