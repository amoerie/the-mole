# Azure Deployment Guide

This guide walks you through setting up the Azure resources needed to deploy **De Mol Ranking Game** — entirely on **free tiers**.

## Prerequisites

- An [Azure account](https://azure.microsoft.com/free/) (free account works)
- [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli) installed (`az --version`)
- You are logged in: `az login`

---

## Step 1: Create a Resource Group

```bash
az group create \
  --name rg-the-mole \
  --location westeurope
```

> **Why West Europe?** Closest region to Belgium for low latency.

---

## Step 2: Create Azure Cosmos DB (Free Tier)

⚠️ **Important:** You can only have **one free-tier Cosmos DB account per Azure subscription.** If you already have one, you'll need to use a different subscription or skip free tier.

```bash
az cosmosdb create \
  --name cosmos-the-mole \
  --resource-group rg-the-mole \
  --kind GlobalDocumentDB \
  --default-consistency-level Session \
  --locations regionName=westeurope failoverPriority=0 isZoneRedundant=false \
  --enable-free-tier true
```

This gives you **1000 RU/s** and **25 GB storage** for free, forever.

### Create the database and containers

```bash
# Create database
az cosmosdb sql database create \
  --account-name cosmos-the-mole \
  --resource-group rg-the-mole \
  --name TheMole

# Create containers
az cosmosdb sql container create \
  --account-name cosmos-the-mole \
  --resource-group rg-the-mole \
  --database-name TheMole \
  --name games \
  --partition-key-path /id \
  --throughput 400

az cosmosdb sql container create \
  --account-name cosmos-the-mole \
  --resource-group rg-the-mole \
  --database-name TheMole \
  --name players \
  --partition-key-path /gameId \
  --throughput 400

az cosmosdb sql container create \
  --account-name cosmos-the-mole \
  --resource-group rg-the-mole \
  --database-name TheMole \
  --name rankings \
  --partition-key-path /gameId \
  --throughput 400
```

> **Note:** 400 RU/s × 3 containers = 1200 RU/s total, but 1000 RU/s is free. You can lower to 400 shared throughput on the database level instead to stay within free limits:
>
> ```bash
> # Alternative: shared throughput (recommended to stay free)
> az cosmosdb sql database create \
>   --account-name cosmos-the-mole \
>   --resource-group rg-the-mole \
>   --name TheMole \
>   --throughput 1000
>
> # Then create containers WITHOUT --throughput (they share the database's 1000 RU/s)
> az cosmosdb sql container create \
>   --account-name cosmos-the-mole \
>   --resource-group rg-the-mole \
>   --database-name TheMole \
>   --name games \
>   --partition-key-path /id
>
> az cosmosdb sql container create \
>   --account-name cosmos-the-mole \
>   --resource-group rg-the-mole \
>   --database-name TheMole \
>   --name players \
>   --partition-key-path /gameId
>
> az cosmosdb sql container create \
>   --account-name cosmos-the-mole \
>   --resource-group rg-the-mole \
>   --database-name TheMole \
>   --name rankings \
>   --partition-key-path /gameId
> ```

### Get the connection string

```bash
az cosmosdb keys list \
  --name cosmos-the-mole \
  --resource-group rg-the-mole \
  --type connection-strings \
  --query "connectionStrings[0].connectionString" \
  --output tsv
```

Save this — you'll need it in Step 4.

---

## Step 3: Create Azure Static Web App (Free Tier)

### Option A: Via Azure CLI

```bash
az staticwebapp create \
  --name swa-the-mole \
  --resource-group rg-the-mole \
  --source https://github.com/amoerie/the-mole \
  --branch main \
  --app-location "client" \
  --api-location "api" \
  --output-location "dist" \
  --login-with-github
```

This will:
1. Open a browser to authenticate with GitHub
2. Automatically create a GitHub Actions workflow (you can keep the existing `ci.yml` or use the auto-generated one)
3. Set up the deployment token as a GitHub secret

### Option B: Via Azure Portal

1. Go to [Azure Portal → Create a resource → Static Web App](https://portal.azure.com/#create/Microsoft.StaticApp)
2. Fill in:
   - **Resource Group:** `rg-the-mole`
   - **Name:** `swa-the-mole`
   - **Plan:** Free
   - **Region:** West Europe
   - **Source:** GitHub
   - **Organization:** `amoerie`
   - **Repository:** `the-mole`
   - **Branch:** `main`
3. Build Details:
   - **Build Preset:** Custom
   - **App location:** `client`
   - **API location:** `api`
   - **Output location:** `dist`
4. Click **Review + Create → Create**

---

## Step 4: Configure Application Settings

The Azure Functions API needs the Cosmos DB connection string. Set it as an application setting on the Static Web App:

```bash
az staticwebapp appsettings set \
  --name swa-the-mole \
  --resource-group rg-the-mole \
  --setting-names \
    CosmosDbConnectionString="<YOUR_CONNECTION_STRING_FROM_STEP_2>" \
    DatabaseName="TheMole"
```

---

## Step 5: Set the GitHub Actions Deployment Token

If you used **Option A** above, this is already done. If you used Option B or need to update it:

```bash
# Get the deployment token
az staticwebapp secrets list \
  --name swa-the-mole \
  --resource-group rg-the-mole \
  --query "properties.apiKey" \
  --output tsv
```

Then set it as a GitHub repository secret:

```bash
gh secret set AZURE_STATIC_WEB_APPS_API_TOKEN \
  --repo amoerie/the-mole \
  --body "<THE_TOKEN_FROM_ABOVE>"
```

Or go to **GitHub → Repository → Settings → Secrets and variables → Actions → New repository secret** and add `AZURE_STATIC_WEB_APPS_API_TOKEN`.

---

## Step 6: Verify Deployment

After pushing to `main`, the GitHub Actions workflow will:
1. ✅ Build & test the API (.NET)
2. ✅ Build & test the client (React)
3. 🚀 Deploy to Azure Static Web Apps

Check the deployment:

```bash
# Get the URL
az staticwebapp show \
  --name swa-the-mole \
  --resource-group rg-the-mole \
  --query "defaultHostname" \
  --output tsv
```

Your app will be available at `https://<generated-name>.azurestaticapps.net`.

### Custom Domain (Optional)

```bash
az staticwebapp hostname set \
  --name swa-the-mole \
  --resource-group rg-the-mole \
  --hostname demol.yourdomain.com
```

You get **2 free custom domains** on the free tier. You'll need to set a CNAME record pointing to the Static Web App hostname.

---

## Architecture Overview

```
┌──────────────────────────────────────────────────┐
│              Azure Static Web Apps                │
│                  (Free Tier)                      │
│                                                   │
│  ┌─────────────────┐   ┌──────────────────────┐  │
│  │  React SPA       │   │  Azure Functions     │  │
│  │  (client/dist)   │──▸│  (.NET 8, api/)      │  │
│  │                  │   │                      │  │
│  │  - Login page    │   │  - Game CRUD         │  │
│  │  - Ranking DnD   │   │  - Rankings API      │  │
│  │  - Leaderboard   │   │  - Scoring engine    │  │
│  └─────────────────┘   └──────────┬───────────┘  │
│                                    │              │
│  Built-in Auth:                    │              │
│  /.auth/login/github               │              │
│  /.auth/login/aad                  │              │
└────────────────────────────────────┼──────────────┘
                                     │
                          ┌──────────▼───────────┐
                          │  Azure Cosmos DB      │
                          │  (Free Tier)          │
                          │                       │
                          │  - 1000 RU/s          │
                          │  - 25 GB storage      │
                          │  - 3 containers       │
                          └───────────────────────┘
```

---

## Monthly Cost Summary

| Service | Tier | Cost |
|---------|------|------|
| Azure Static Web Apps | Free | $0 |
| Azure Cosmos DB | Free (1000 RU/s, 25 GB) | $0 |
| GitHub Actions | Free (2000 min/month) | $0 |
| **Total** | | **$0/month** |

---

## Troubleshooting

### API returns 401 Unauthorized
Make sure you're logged in. The `staticwebapp.config.json` requires authentication for `/api/*` routes. Visit `/.auth/login/github` to log in.

### Cosmos DB connection fails
Verify the connection string is set correctly:
```bash
az staticwebapp appsettings list \
  --name swa-the-mole \
  --resource-group rg-the-mole
```

### Deploy job fails with missing token
Make sure the `AZURE_STATIC_WEB_APPS_API_TOKEN` secret is set in GitHub. See Step 5.

### Build fails on CI
The CI runs `dotnet build` and `dotnet test` for the API, and `npm ci && npm run lint && npm test && npm run build` for the client. Check the GitHub Actions logs for specific errors.

---

## Tear Down (if needed)

To delete everything and stop any potential charges:

```bash
az group delete --name rg-the-mole --yes --no-wait
```

This deletes the resource group and all resources inside it.
