# ADR-020: Deployment & Infrastructure

## Status
ACCEPTED

## Date
2026-06-17

## Context

The platform serves three user surfaces (customer, operator, admin) from a single Next.js application. Deployment must support both serverless (Vercel) for zero-ops scaling and Docker self-hosted for cost-sensitive or data-residency-constrained scenarios. Environment configuration must fail fast on missing credentials and support stub/real mode switching for payment, notification, and e-invoice integrations.

**Sources**: `design/23-deployment/`, `design/26-evolution/` §Three-Stage Scaling Path

---

## Decisions

### D1: Single App, Three Route Groups (Stage 0)

```
busbooking.vn/          → Customer web (search, book, tickets)
busbooking.vn/op/       → Operator console (fleet, trips, bookings, money)
busbooking.vn/admin/    → Admin console (approvals, finance, moderation)
```

All three share one Next.js deployment with separate route groups (`app/(customer)/`, `app/op/`, `app/admin/`).

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| **A. Single app, route groups** ✅ | One deploy, path-separated | Single deploy pipeline; shared `lib/` code; no cross-service networking | Admin in same app (mitigated by separate credentials, cookie scope, TOTP, exact-match middleware) |
| B. Separate apps per surface | 3 Next.js deploys | Strongest isolation | Triple deployment complexity; shared lib code must be published as package; triple CI |
| C. Monorepo with Turborepo | Multiple apps in one repo | Good isolation with shared code | Build tooling complexity; Vercel monorepo config; connection pool per app |

**Choice**: Option A for Stage 0. Stage 1 splits admin to separate subdomain (`admin.busbooking.vn`).

**Rationale**: At ~200 bookings/day with a 1-2 person team, the operational overhead of multiple deployments exceeds the isolation benefit. Admin isolation is achieved through separate credential store, separate cookie scope, mandatory TOTP, and exact-match middleware allowlist.

---

### D2: Vercel Serverless with sin1 Region Pin

Primary deployment on Vercel with all functions pinned to `sin1` (Singapore) — the closest Vercel region to Vietnam.

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| **A. Vercel sin1** ✅ | Serverless, auto-scaling, edge middleware | Zero-ops; auto-scaling; preview deploys per PR; built-in CDN; edge middleware for auth/rate-limiting | Vendor lock-in; serverless = no persistent process for background workers; cold starts ~200ms; connection pooler mandatory |
| B. Railway/Render | Managed container hosting | Persistent process; simpler background workers | Less Next.js integration; no edge middleware; manual scaling |
| C. Self-hosted VPS | DigitalOcean/Linode with Docker | Full control; cheapest at scale; Vietnam data residency | Requires DevOps; manual scaling; manual TLS; manual CDN |

**Choice**: Option A primary, with Option C as alternative (see D3).

**Rationale**: Zero-ops deployment matches team size (1-2 developers). Edge middleware handles stateless auth/CSRF at CDN level without DB hits. Cold starts (~200ms) are acceptable for API routes. PgBouncer connection pooler is mandatory from day 1 to manage serverless connection churn.

---

### D3: Docker Self-Hosted Alternative

For cost-sensitive or data-residency-constrained deployments, the entire stack runs in Docker Compose on a single VPS:

```
App (Next.js :3000) → PgBouncer (:6432) → PostgreSQL (:5432) + Redis (:6379)
```

- 3-stage Dockerfile: deps → builder → runner (`node:20-alpine`, standalone output, non-root user)
- Internal bridge network (no external port exposure except reverse proxy)
- Reverse proxy (Caddy recommended for automatic TLS) in front of port 3000
- Healthchecks on all services via `/api/health`

**Rationale**: Vietnam data residency requirements may mandate hosting on Vietnam-based infrastructure. Docker self-hosted provides an escape hatch from Vercel's Singapore region. Same codebase, same configuration — only the deployment target changes.

---

### D4: Environment Config Validated at Boot

All environment variables are defined and validated in `lib/config/env.ts` using a Zod schema with `superRefine` guards. The application fails fast at startup if required credentials are missing.

Switching from stub to real mode (`PAYMENTS_STUB=false`, `NOTIFY_STUB=false`, `EINVOICE_ENABLED=misa`, `EMAIL_PROVIDER=resend`) fails immediately if the required credentials for that mode are not present.

**Key variable groups**: Database (PG + PgBouncer), Redis (memory/ioredis/upstash), Auth & Signing (6 JWT/HMAC secrets), Payments (MoMo + VNPay credentials), Notifications (eSMS + Resend), E-Invoice (MISA), Storage (S3-compatible), Observability (Sentry + Cron secret).

**Rationale**: Runtime credential errors are the worst debugging experience — the app starts, serves some requests, then fails when a specific code path needs a missing secret. Fail-fast at boot makes missing credentials immediately visible.

---

### D5: Stub/Real Mode Switching

External integrations support two modes controlled by environment variables:

| Integration | Stub mode (dev/test) | Real mode (production) |
|-------------|---------------------|----------------------|
| Payments | `PAYMENTS_STUB=true` → local stub gateway, no real money | `PAYMENTS_STUB=false` → VNPay/MoMo live |
| Notifications | `NOTIFY_STUB=true` → logged but not sent | `NOTIFY_STUB=false` → eSMS/Resend live |
| E-Invoice | `EINVOICE_ENABLED=stub` → log only | `EINVOICE_ENABLED=misa` → MISA meInvoice API |
| Email | `EMAIL_PROVIDER=stub` → no-op | `EMAIL_PROVIDER=resend` → Resend API |
| Storage | `STORAGE_STUB=true` → local URL signer | `STORAGE_STUB=false` → S3-compatible |

**Rationale**: Development and testing must work without real PSP credentials, SMS costs, or e-invoice submissions. Stub mode provides the same interface with no-op or local implementations. The `env.ts` Zod schema ensures that switching to real mode without providing the required credentials fails at boot, not at runtime.

---

### D6: Staged Evolution Path

| Stage | Trigger | Changes |
|-------|---------|---------|
| **Stage 0 (current)** | — | Single app; Vercel or Docker; cron-driven jobs |
| **Stage 1** | Jobs exceed 30s latency OR admin needs stronger isolation | Split admin to `admin.busbooking.vn`; add BullMQ worker process consuming same `lib/<domain>/` job handlers; add read replica |
| **Stage 2** | Single module >50% CPU OR search p95 >200ms | Extract bottleneck domain to separate service; module barrel is already the API boundary |

**Rationale**: Premature extraction to microservices adds network latency, deployment complexity, and distributed debugging pain — all for load (~200 bookings/day) that a single process handles trivially. The modular monolith structure (ADR-016) means each domain already has a defined API surface, making future extraction mechanical rather than architectural.

---

## Consequences

### Positive

- **Zero-ops at current scale** — Vercel handles deployment, scaling, TLS, CDN
- **Escape hatch** — Docker self-hosted available for cost/residency constraints
- **Fail-fast** — missing credentials caught at boot, not at runtime
- **Dev parity** — stub mode provides identical interfaces without external dependencies
- **Mechanical scaling** — evolution stages are defined; triggers are measurable

### Negative

- **Vercel vendor lock-in** — edge middleware, serverless function semantics, cron integration are Vercel-specific
- **No persistent process** — background workers must use cron + DB-as-queue pattern (no long-running job processor until Stage 1)
- **Connection pool pressure** — serverless function instances each need a DB connection; PgBouncer mandatory
- **Cold starts** — first request after idle period incurs ~200ms latency
- **Dual deployment paths** — Vercel + Docker must both be maintained and tested
