> ← [Previous](../22-charter/) | [Index](../README.md) | [Next →](../24-disaster-recovery/)

## 23. Deployment & Infrastructure

### 23.1 Serverless Deployment (Vercel)

**What "serverless" means**: You don't manage servers. You deploy code, and the hosting platform automatically:
- Provisions compute resources when requests arrive
- Scales to zero when idle (no traffic = no cost)
- Scales up under load (each request gets its own function instance)
- Handles TLS certificates, CDN, edge routing

**Why Vercel for this project**:
- Next.js is Vercel's framework (best integration)
- Zero-ops for a small team (no DevOps engineer needed)
- Edge middleware for auth/rate-limiting at the CDN level
- Automatic preview deployments for PRs

### 23.2 Single App, Three Consoles (Stage 0)

```
busbooking.vn/          → Customer web (search, book, tickets)
busbooking.vn/op/       → Operator console (fleet, trips, bookings, money)
busbooking.vn/admin/    → Admin console (approvals, finance, moderation)
```

All three share one Next.js deployment. The admin compensates for being in the same app with:
- Separate credential store (different database table)
- Separate cookie scope (different cookie name/path)
- Strict exact-match middleware allowlist
- Mandatory TOTP

### 23.3 Environment Configuration

All variables are defined and validated in `lib/config/env.ts` (Zod schema with `superRefine` guards). Switching a stub to real mode (`PAYMENTS_STUB=false`, `NOTIFY_STUB=false`, `EINVOICE_ENABLED=misa`, `EMAIL_PROVIDER=resend`) fails fast at boot if the required credentials are missing.

| Variable | Purpose | Required |
|----------|---------|----------|
| **Database** | | |
| `DATABASE_URL` | PostgreSQL connection string (via PgBouncer in prod) | Production |
| `DIRECT_URL` | Direct PostgreSQL URL bypassing PgBouncer (for migrations/DDL) | Prod when `PAYMENTS_STUB=false` |
| `DATABASE_POOL_MAX` | App-side pg Pool max connections (default 5 at runtime; PgBouncer handles real pooling) | No |
| **Redis** | | |
| `REDIS_PROVIDER` | Backend: `memory` (default), `ioredis` (self-hosted), or `upstash` (serverless) | No |
| `REDIS_URL` | Redis connection URL for ioredis provider (default `redis://localhost:6379`) | When `ioredis` |
| **Auth & Signing** | | |
| `JWT_SECRET` | HS256 key for customer session JWTs (min 32 chars) | Production |
| `JWT_OPERATOR_SECRET` | HS256 key for operator session JWTs | Production |
| `JWT_ADMIN_SECRET` | HS256 key for admin session JWTs | Production |
| `HOLD_SECRET` | HMAC-SHA256 key for hold cookies (64 hex chars) | Always |
| `TICKET_SECRET` | HS256 key for ticket QR lookup tokens (min 16 chars) | Production |
| `TOTP_ENCRYPTION_KEY` | AES-256-GCM key for admin TOTP at-rest encryption (64 hex chars) | Production |
| **Payments** | | |
| `PAYMENTS_STUB` | `true` = local stub gateway; `false` = real PSPs | No (default `false`) |
| `MOMO_PARTNER_CODE` / `MOMO_ACCESS_KEY` / `MOMO_SECRET_KEY` | MoMo gateway credentials (sandbox defaults provided) | When using MoMo |
| `MOMO_ENDPOINT` | MoMo create-order URL (default: sandbox) | No |
| `VNPAY_TMN_CODE` / `VNPAY_HASH_SECRET` | VNPay gateway credentials (sandbox defaults provided) | When `PAYMENTS_STUB=false` |
| `VNPAY_URL` | VNPay payment URL (default: sandbox) | No |
| `VNPAY_RETURN_URL` / `VNPAY_IPN_URL` | VNPay browser-return and server IPN callback URLs | When `PAYMENTS_STUB=false` |
| `STUB_PAYMENT_SECRET` | HMAC key for fake-gateway stub IPNs (dev only) | No |
| **Notifications** | | |
| `NOTIFY_STUB` | `true` = no-network stub; `false` = real SMS/email | No (default `true`) |
| `ESMS_API_KEY` / `ESMS_SECRET_KEY` / `ESMS_BRANDNAME` | eSMS.vn SMS credentials | When `NOTIFY_STUB=false` |
| `EMAIL_PROVIDER` | Email dispatch: `stub` (default) or `resend` | No |
| `RESEND_API_KEY` | Resend API key | When `EMAIL_PROVIDER=resend` |
| `EMAIL_FROM` | Sender address (default `noreply@busbookvn.com`) | No |
| **E-invoice** | | |
| `EINVOICE_ENABLED` | `stub` (log only, default) or `misa` (real MISA meInvoice API) | No |
| `MISA_API_URL` / `MISA_API_KEY` / `MISA_COMPANY_CODE` / `MISA_TEMPLATE_CODE` | MISA meInvoice credentials (HTTPS enforced) | When `EINVOICE_ENABLED=misa` |
| **Storage** | | |
| `STORAGE_STUB` | `true` = local stub URL-signer; `false` = real S3 | No (default `true`) |
| `STORAGE_BUCKET` / `STORAGE_REGION` / `STORAGE_ENDPOINT` / `STORAGE_ACCESS_KEY` / `STORAGE_SECRET_KEY` | S3-compatible storage credentials | When `STORAGE_STUB=false` |
| **Observability & Ops** | | |
| `SENTRY_DSN` | Sentry error tracking (unset = logger fallback) | No |
| `CRON_SECRET` | Bearer token for Vercel Cron authorization (min 16 chars) | Production |
| `OPS_EMAIL` | Ops team email for internal notifications | No |

All secrets stored in the hosting platform's encrypted environment variables (Vercel env vars or `.env.production` for Docker). Never committed to the repository.

### 23.4 Stage 1 — Split Admin + Worker

When the platform outgrows Stage 0:
- **Admin on a subdomain** (`admin.busbooking.vn`) — separate deployment, stronger isolation
- **Worker process** — a long-running Node.js process consuming a BullMQ queue, running the same `lib/<domain>` job handlers. Replaces cron for time-sensitive jobs.

### 23.5 Docker Self-Hosted Deployment

For cost-sensitive or data-residency-constrained deployments, the entire stack runs in Docker Compose on a single VPS.

```
┌──────────────────── VPS (e.g., DigitalOcean 4 GB) ────────────────────┐
│                                                                        │
│  ┌──────────┐    ┌───────────┐    ┌────────────┐    ┌──────────────┐  │
│  │   App    │───→│ PgBouncer │───→│ PostgreSQL │    │    Redis     │  │
│  │ (Next.js)│    │   :6432   │    │   :5432    │    │    :6379     │  │
│  │  :3000   │    │  pool=30  │    │            │    │              │  │
│  └──────────┘    └───────────┘    └────────────┘    └──────────────┘  │
│       ▲            all on internal bridge network (no external expose) │
└───────│────────────────────────────────────────────────────────────────┘
        │
  Reverse proxy (Caddy / nginx) handles TLS + public :443
```

**Key files**:
- `Dockerfile` — 3-stage build (deps → builder → runner), `node:20-alpine`, Next.js standalone output, non-root user (`nextjs:nodejs`), healthcheck via `/api/health`
- `docker-compose.prod.yml` — app + PostgreSQL 16 + PgBouncer 1.22.1 + Redis 7-alpine, internal bridge network, healthchecks on all services
- `docker-compose.dev.yml` — PostgreSQL + shadow DB (for Prisma migrations) + Redis, ports exposed for local development

**Deployment steps**:
1. Set secrets in `.env.production` (never committed — see Section 23.3 for the full variable list)
2. Run migrations: `docker compose -f docker-compose.prod.yml run --rm app pnpm prisma migrate deploy`
3. Start the stack: `docker compose -f docker-compose.prod.yml up -d`
4. Place a reverse proxy (Caddy recommended for automatic TLS) in front of port 3000

**Vercel region pin**: For the serverless path, `vercel.json` pins all functions to `sin1` (Singapore) — the closest Vercel region to Vietnam, minimizing database round-trip latency when the database is hosted in Singapore or Ho Chi Minh City.
