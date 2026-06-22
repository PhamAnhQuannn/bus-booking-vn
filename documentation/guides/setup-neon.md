# Neon PostgreSQL — Setup Guide

Provision PostgreSQL 16 database on Neon (Singapore region). Built-in connection pooler replaces PgBouncer. Code integration: `prisma/schema.prisma`, `lib/core/db/client.ts`. Env vars: `DATABASE_URL`, `DIRECT_URL`.

---

## Step 1: Create Neon Account

1. Go to **https://console.neon.tech/signup**
2. Sign up with GitHub, Google, or email
3. Verify email if using email signup

---

## Step 2: Create Project

1. Click **"New Project"** on dashboard
2. Configure:

| Setting | Value |
|---------|-------|
| Project name | `busmap-prod` |
| Postgres version | `16` |
| Region | **Asia Pacific (Singapore) — `ap-southeast-1`** |
| Compute size | Start with **0.25 CU** (autoscales) |

3. Click **"Create Project"**

Why `ap-southeast-1`: same region as Vercel functions (`sin1`) — sub-1ms network latency. Data stays in Singapore for CDTIA compliance.

---

## Step 3: Copy Connection Strings

After project creation, Neon shows connection details. You need TWO strings:

### Pooled Connection (for app runtime)

1. In Neon dashboard → **Connection Details**
2. Connection type: **"Pooled"** (toggle ON)
3. Copy the connection string — format:
   ```
   postgresql://user:pass@ep-xxx-123456.ap-southeast-1.aws.neon.tech/bbvn_prod?sslmode=require
   ```
4. This is your `DATABASE_URL`

### Direct Connection (for migrations)

1. Toggle **"Pooled"** OFF in Connection Details
2. Copy the direct string — format:
   ```
   postgresql://user:pass@ep-xxx-123456.ap-southeast-1.aws.neon.tech/bbvn_prod?sslmode=require
   ```
   Note: hostname differs slightly (no `-pooler` suffix)
3. This is your `DIRECT_URL`

### Why two URLs?

| URL | Used By | Protocol |
|-----|---------|----------|
| `DATABASE_URL` (pooled) | App runtime, Prisma queries | PgBouncer transaction mode |
| `DIRECT_URL` (direct) | `prisma migrate deploy`, `prisma db seed` | Direct TCP to Postgres |

Prisma migrations require direct connections because they run DDL statements that PgBouncer transaction-mode can't handle (prepared statements, advisory locks).

---

## Step 4: Create Database

The default database is `neondb`. Rename or create `bbvn_prod`:

1. In Neon dashboard → **Databases** tab
2. Click **"New Database"**
3. Name: `bbvn_prod`
4. Owner: default role (usually your project name)
5. Update both connection strings to use `/bbvn_prod` instead of `/neondb`

---

## Step 5: Run Migrations

From your local machine (with the repo cloned):

```bash
# Set production connection strings
export DATABASE_URL="postgresql://user:pass@ep-xxx-pooler.ap-southeast-1.aws.neon.tech/bbvn_prod?sslmode=require"
export DIRECT_URL="postgresql://user:pass@ep-xxx.ap-southeast-1.aws.neon.tech/bbvn_prod?sslmode=require"

# Run all migrations
pnpm prisma migrate deploy

# Seed initial data (routes, admin user, etc.)
pnpm prisma db seed
```

Migration runs against `DIRECT_URL` (Prisma uses it automatically for migrations when set).

---

## Step 6: Configure in Vercel

1. Go to Vercel → **Project Settings → Environment Variables**
2. Add:

```env
DATABASE_URL="postgresql://user:pass@ep-xxx-pooler.ap-southeast-1.aws.neon.tech/bbvn_prod?sslmode=require"
DIRECT_URL="postgresql://user:pass@ep-xxx.ap-southeast-1.aws.neon.tech/bbvn_prod?sslmode=require"
```

3. Scope: **Production**
4. Redeploy to pick up new vars

---

## Step 7: Verify Connection

```bash
# From local machine with psql installed
psql "postgresql://user:pass@ep-xxx.ap-southeast-1.aws.neon.tech/bbvn_prod?sslmode=require"

# Check tables exist
\dt

# Check seed data
SELECT count(*) FROM "Route";
SELECT count(*) FROM "AdminUser";
```

From deployed app:
```bash
curl -s https://yourdomain.com/api/health | jq .
# Should return { "status": "ok", "db": "connected", ... }
```

---

## Step 8: Staging Branch (for Preview Deployments)

Neon branching lets you create isolated DB copies for staging/preview:

1. In Neon dashboard → **Branches** tab
2. Click **"New Branch"**
3. Name: `staging`
4. Parent: `main` (copies all data at branch point)
5. Copy the branch's pooled + direct connection strings
6. Add to Vercel env vars with **Preview** scope

Branch benefits:
- Isolated from production data
- Can reset by deleting and re-branching from `main`
- Shares compute with parent (no extra cost)

---

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| `FATAL: password authentication failed` | Wrong password in connection string | Re-copy from Neon dashboard |
| `connection refused` | Using pooled URL for migrations | Use `DIRECT_URL` for `prisma migrate deploy` |
| `prepared statement already exists` | Pooled connection + Prisma interactive transactions | Ensure `prisma/schema.prisma` has `directUrl = env("DIRECT_URL")` |
| `SSL required` | Missing `?sslmode=require` | Append to connection string |
| `relation "Route" does not exist` | Migrations not run | Run `pnpm prisma migrate deploy` |
| Slow queries | Compute suspended (cold start) | First query after idle takes ~0.5-1s; subsequent queries fast |

---

## Pricing

| Tier | Cost | Includes |
|------|------|----------|
| Free | $0/mo | 0.5 GB storage, 1 project, 10 branches |
| Launch | $19/mo | 10 GB storage, 100 branches, autoscaling to 4 CU |
| Scale | $69/mo | 50 GB storage, 500 branches, autoscaling to 8 CU |

Launch tier sufficient for initial production. Autoscaling compute handles traffic spikes without manual intervention.

---

## Backup & Recovery

Neon provides automatic point-in-time recovery (PITR):

1. Go to **Restore** tab in dashboard
2. Select any timestamp within retention window (7 days on Launch, 30 days on Scale)
3. Restore creates a new branch — does NOT overwrite production
4. Verify restored data, then swap connection strings if needed

No manual backup configuration required — PITR is always-on.
