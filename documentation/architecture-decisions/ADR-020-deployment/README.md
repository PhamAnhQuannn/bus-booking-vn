# ADR-020: Deployment & Infrastructure

## Status
ACCEPTED

## Date
2026-06-17

## Context

The platform serves three user surfaces (customer, operator, admin) from a single Next.js application. Deployment targets Vercel serverless for zero-ops scaling. Environment configuration must fail fast on missing credentials and support stub/real mode switching for payment, notification, and e-invoice integrations.

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

### D2: Hosting Provider — Vercel Pro (sin1)

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| **A. Vercel sin1** ✅ | Serverless, auto-scaling, edge middleware | Zero-ops; auto-scaling; preview deploys per PR; built-in CDN; edge middleware for auth/rate-limiting | Singapore = cross-border transfer → CDTIA required; vendor lock-in (cron, serverless semantics); no persistent process; cold starts ~200ms |
| B. AWS ap-southeast-1 (Singapore) | EC2/ECS/EKS | Broadest service catalog; mature DevOps tooling; auto-scaling | Singapore = cross-border transfer → CDTIA; higher cost at small scale; more complex than VPS |
| C. Railway/Render | Managed container hosting | Persistent process; simpler background workers | Less Next.js integration; no edge middleware; overseas hosting → CDTIA |

**Choice**: Option A (Vercel Pro sin1). The Vercel + Neon + Upstash stack provides zero-ops deployment with built-in cron, preview deploys per PR, and auto-scaling.

**Rationale**: Cost and operational simplicity are decisive at startup scale. The Vercel + Neon + Upstash stack (~$55-70/mo) eliminates all infrastructure management. Neon's built-in connection pooler handles connection pooling; Upstash's HTTP REST Redis is already wired via `REDIS_PROVIDER=upstash`; Vercel Cron handles all 11 scheduled jobs. CDTIA filing is a one-time legal process (~60 days, ~$2-5K) that does not block technical deployment. Cloudflare remains the DNS/WAF layer.

---

### D3: Environment Config Validated at Boot

All environment variables are defined and validated in `lib/config/env.ts` using a Zod schema with `superRefine` guards. The application fails fast at startup if required credentials are missing.

Switching from stub to real mode (`PAYMENTS_STUB=false`, `NOTIFY_STUB=false`, `EINVOICE_ENABLED=misa`, `EMAIL_PROVIDER=resend`) fails immediately if the required credentials for that mode are not present.

**Key variable groups**: Database (PG + PgBouncer), Redis (memory/ioredis/upstash), Auth & Signing (6 JWT/HMAC secrets), Payments (MoMo + VNPay credentials), Notifications (eSMS + Resend), E-Invoice (MISA), Storage (S3-compatible), Observability (Sentry + Cron secret).

**Rationale**: Runtime credential errors are the worst debugging experience — the app starts, serves some requests, then fails when a specific code path needs a missing secret. Fail-fast at boot makes missing credentials immediately visible.

> **IMPLEMENTATION STATUS** (2026-06-18)
> - **Documented**: Zod `superRefine` rejects production deployment with sandbox credentials.
> - **Actual**: `env.ts` Zod schema exists and validates at boot. Sandbox sentinel detection implemented for VNPay/MoMo. However, not all secrets are in `superRefine` production enforcement list (e.g., `HOLD_SECRET` minimum length not enforced in production guard).
> - **Status**: `PARTIALLY_IMPLEMENTED`
> - **Tracking**: Audit `superRefine` guards for completeness before Issue 094 go-live.

---

### D4: Stub/Real Mode Switching

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

### D5: Staged Evolution Path

| Stage | Trigger | Changes |
|-------|---------|---------|
| **Stage 0 (current)** | — | Single app; Vercel; cron-driven jobs |
| **Stage 1** | Jobs exceed 30s latency OR admin needs stronger isolation | Split admin to `admin.busbooking.vn`; add BullMQ worker process consuming same `lib/<domain>/` job handlers; add read replica |
| **Stage 2** | Single module >50% CPU OR search p95 >200ms | Extract bottleneck domain to separate service; module barrel is already the API boundary |

**Rationale**: Premature extraction to microservices adds network latency, deployment complexity, and distributed debugging pain — all for load (~200 bookings/day) that a single process handles trivially. The modular monolith structure (ADR-016) means each domain already has a defined API surface, making future extraction mechanical rather than architectural.

---

### D6: Provider-Agnostic Deployment Contract

The application defines a **deployment contract** — the minimum infrastructure any hosting provider must supply. Any provider meeting this contract can run the platform with zero application code changes.

| Requirement | Specification | Notes |
|-------------|--------------|-------|
| **Compute** | Linux VM or container runtime (Docker 24+) | Node.js 20 Alpine; Next.js standalone output; port 3000 |
| **PostgreSQL** | 16+ with connection pooler (transaction mode) | Managed or self-hosted; `DATABASE_URL` (pooled) + `DIRECT_URL` (direct for migrations) |
| **Redis** | 7+ (or in-memory for single-instance) | `REDIS_PROVIDER=ioredis` + `REDIS_URL` for self-hosted; `memory` for single-node |
| **Cron trigger** | HTTP caller on schedule | Hits `/api/cron/*` with `Authorization: Bearer <CRON_SECRET>` |
| **Reverse proxy** | TLS termination + HTTP/2 | Cloud LB, Nginx, or Caddy |
| **DNS** | A/CNAME record pointing to hosting provider | Cloudflare recommended for edge caching |
| **Outbound HTTPS** | Unrestricted egress on port 443 | PSP callbacks (MoMo, VNPay), eSMS, Resend, MISA |
| **Object storage** | S3-compatible API (deferred) | `STORAGE_ENDPOINT`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`; stub mode until Wave-9 |

**Provider mapping:**

| Need | AWS | Vercel (chosen) | Bare Metal |
|------|-----|--------|------------|
| Compute | EC2 / ECS / EKS | Serverless Functions | Docker on any VPS |
| PostgreSQL | RDS | External (Neon/Supabase) | Self-hosted PG + PgBouncer |
| Redis | ElastiCache | Upstash | Self-hosted Redis |
| Cron | EventBridge + Lambda / ECS Scheduled Task | Vercel Cron (`vercel.json`) | Host crontab |
| SSL | ACM + ALB | Built-in | Let's Encrypt / Cloudflare |
| CDN | CloudFront | Built-in | Cloudflare |
| Object Storage | S3 | Vercel Blob / S3 | MinIO |

**Migration effort estimate:** switching providers = change DNS records + update connection strings (PG, Redis) + deploy to new host. Estimated 2-4 hours for experienced DevOps. Zero application code changes.

**Rationale**: Vendor lock-in is the primary risk for a startup that may need to optimize cost, comply with new regulations, or scale to different infrastructure. The deployment contract ensures the application is a portable artifact that runs on any provider meeting the contract.

---

### D7: Vercel Production Stack

> Added 2026-06-21. This is the sole production stack.

| Component | Provider | Monthly Cost | Notes |
|-----------|----------|:------------:|-------|
| Compute | Vercel Pro (sin1) | $20 | Next.js-native; built-in CDN, cron, preview deploys |
| PostgreSQL | Neon Launch (ap-southeast-1) | $19 | Built-in pooler replaces PgBouncer; `DATABASE_URL` (pooled) + `DIRECT_URL` (unpooled) provided; branching for preview DBs |
| Redis | Upstash PAYG (ap-southeast-1) | $0-2 | HTTP REST (Edge-safe); already wired via `REDIS_PROVIDER=upstash`; fails open |
| Object Storage | Cloudflare R2 | $0-5 | S3-compatible; zero egress; `STORAGE_ENDPOINT` + `forcePathStyle: true` |
| CDN / DNS / WAF | Cloudflare Free/Pro | $0-20 | DNS, DDoS, WAF; Vercel also has built-in CDN |
| **Total** | | **~$55-70/mo** | Before SMS/email/monitoring usage costs |

**Cron**: 11 jobs defined in `vercel.json` (1-min minimum on Pro).

**Connection pooling**: Neon provides pooled + unpooled connection strings natively. PgBouncer is not needed. The `DATABASE_URL`/`DIRECT_URL` pattern in `lib/core/db/client.ts` works identically.

**Rate limiting**: `REDIS_PROVIDER=upstash` activates `@upstash/ratelimit` HTTP client. Edge middleware (`proxy.ts`) works natively on Vercel Edge with Upstash.

**Cold starts**: ~100-300ms on Node.js serverless functions. PDF generation cron (`@react-pdf/renderer`) works within Vercel Pro's 60s function timeout.

**CDTIA**: Required for Neon (Singapore) and Upstash (Singapore). One-time filing with MPS A05 (~$2-5K legal cost, 60-day process). See `documentation/guides/cdtia-data-residency-guide.md`.

---

## Consequences

### Positive

- **Provider-agnostic** — deployment contract (D6) ensures any compatible host works; migration = DNS + connection strings
- **Fail-fast** — missing credentials caught at boot, not at runtime (D3)
- **Dev parity** — stub mode provides identical interfaces without external dependencies (D4)
- **Mechanical scaling** — evolution stages defined; triggers measurable (D5)
- **Cloudflare CDN** — edge caching for static assets; Vietnamese PoPs (HCM, Hanoi) for low latency

---

## See Also

- [SI-001 Project Scaffold](../../scaffolding-infra/SI-001-project-scaffold/) — stack choices, monorepo structure, module architecture
- [SI-002 Dev Environment](../../scaffolding-infra/SI-002-dev-environment/) — local setup, stub/real mode switching, Zod boot validation, cron dev workflow
- [SI-003 CI/CD Pipeline](../../scaffolding-infra/SI-003-ci-cd-pipeline/) — pipeline stages, Docker build, migration safety in CI
- [SI-006 Deployment Config](../../scaffolding-infra/SI-006-deployment-config/) — deployment contract implementation, NFRs
