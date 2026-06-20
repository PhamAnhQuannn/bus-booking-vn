# ADR-020: Deployment & Infrastructure

## Status
ACCEPTED — HOSTING PIVOT 2026-06-19

## Date
2026-06-19 (hosting pivot to FPT Cloud; original 2026-06-17)

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

### D2: Hosting Provider — FPT Cloud (Primary), Vercel (Alternative)

> **2026-06-19 Pivot**: Vercel sin1 demoted from primary to zero-ops alternative. FPT Cloud VM promoted to primary hosting to eliminate CDTIA obligation entirely.

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A. Vercel sin1 | Serverless, auto-scaling, edge middleware | Zero-ops; auto-scaling; preview deploys per PR; built-in CDN; edge middleware for auth/rate-limiting | Singapore = cross-border transfer → CDTIA required; vendor lock-in (cron, serverless semantics); no persistent process; cold starts ~200ms |
| **B. FPT Cloud VPS (Docker Compose)** ✅ | Self-hosted Docker on Vietnam VPS | All data in Vietnam → zero CDTIA; full control; persistent process for future workers; cheapest at scale; PCI DSS L1 + ISO 27001 certified DCs | Requires DevOps (Docker, Nginx, SSL); manual scaling; no preview deploys; no built-in edge CDN |
| C. AWS ap-southeast-1 (Singapore) | EC2/ECS/EKS | Broadest service catalog; mature DevOps tooling; auto-scaling | Singapore = cross-border transfer → CDTIA; higher cost at small scale; more complex than VPS |
| D. Railway/Render | Managed container hosting | Persistent process; simpler background workers | Less Next.js integration; no edge middleware; overseas hosting → CDTIA |

**Choice**: Option B primary (FPT Cloud), with Option A retained as zero-ops alternative for staging/preview.

**Rationale**: CDTIA elimination is the decisive factor. Vietnam data residency removes the entire cross-border transfer regulatory burden (PDPL 2025 Art. 25, Decree 356/2025). FPT Cloud provides managed PostgreSQL, managed Redis, and S3-compatible storage — matching the full stack need. The provider-agnostic Docker contract (D8) ensures switching to AWS/Vercel/bare-metal later is a DNS + connection-string change, not a rewrite. Cloudflare CDN in front of FPT origin provides edge caching without CDTIA concern (static assets only; PII stays on origin).

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

> **IMPLEMENTATION STATUS** (2026-06-18)
> - **Documented**: Zod `superRefine` rejects production deployment with sandbox credentials.
> - **Actual**: `env.ts` Zod schema exists and validates at boot. Sandbox sentinel detection implemented for VNPay/MoMo. However, not all secrets are in `superRefine` production enforcement list (e.g., `HOLD_SECRET` minimum length not enforced in production guard).
> - **Status**: `PARTIALLY_IMPLEMENTED`
> - **Tracking**: Audit `superRefine` guards for completeness before Issue 094 go-live.

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

### D7: Vietnam-Hosted Cloud (FPT Cloud) — CHOSEN Primary Host

For full data residency compliance that **eliminates CDTIA filing entirely**, the platform can deploy on FPT Cloud with all compute and data in Vietnam. No cross-border transfer = no Decree 13/2023 impact assessment required.

#### FPT Cloud Service Mapping

| Stack Need | FPT Service | Notes |
|------------|-------------|-------|
| Compute | FPT Cloud Server (Standard / High Performance) | 2-16 vCPU, 4-32GB RAM, 40-500GB SSD; includes L4 Firewall + Basic LB; Docker on Ubuntu; FPT Autoscale for horizontal VM cloning |
| PostgreSQL | FPT Database Engine for PostgreSQL | Managed DBaaS: HA with auto-failover, automated backup/restore, vertical scaling; DBProxy (connection proxy, PgBouncer-like) available on VMware platform; **PG16 version unconfirmed publicly — verify in Console** |
| Redis | FPT Database Engine for Redis | Managed: backup/restore, failover, hot-add resource expansion; **Redis 7 version unconfirmed publicly — verify in Console**; cluster vs sentinel topology undisclosed |
| Object Storage | FPT Object Storage (S3-compatible, **MinIO-based**) | `@aws-sdk/client-s3` works with `forcePathStyle: true` (REQUIRED — MinIO uses path-style addressing); 2 regions (HN + HCM) with auto cross-region sync; pre-signed URLs supported (MinIO foundation); endpoint URL format likely `hn01.vstorage.fptcloud.com` — verify in Console |
| Kubernetes | FPT Kubernetes Engine (FKE) | Managed FKE or Dedicated D-FKE; auto-scaling workers; Stage 2+ only |
| Container Registry | FPT Container Registry | **16,000,000 VND/month (~$640) — prohibitively expensive for startup. SKIP. Use GitHub Container Registry (GHCR) instead (free).** Self-hosted Harbor on FPT VM is the cost-optimized VN-resident alternative |
| Monitoring | FPT Cloud Monitoring | Basic metrics/logs/traces; **no confirmed Prometheus/Grafana integration or API access**; do NOT rely as primary — use BetterStack + Sentry (external, already decided in ADR-007) |
| WAF | FPT Cloud WAF (CyRadar-based) | 7,900,000-16,000,000 VND/month ($316-640); **SKIP for Stage 0 — use Cloudflare WAF (Pro tier, $20/mo) instead**; evaluate FPT WAF at Stage 2 if Cloudflare coverage insufficient |
| DDoS | Via Cloudflare (FPT is Cloudflare's sole VN/Laos/Cambodia distributor) | Cloudflare Magic Transit available through FPT Cloud Hub; use Cloudflare direct or via FPT reseller |
| VPC / Networking | FPT VPC (OpenStack-based) | Isolated tenant networks with subnetting; security groups; Floating IP (elastic IP); VPN Site-to-Site (IPSec); all Terraform-managed |
| IaC | Terraform provider `fpt-corp/fptcloud` | **v0.3.51, 58 releases, actively maintained**; covers: VPC, subnet, security group, instance, floating IP, load balancer v2, database, object storage, managed K8s (MFKE), SSH keys, images. Gaps: WAF, monitoring, backup/DR not yet in provider |

#### FPT Cloud Compliance Certifications

| Certification | Status |
|---------------|--------|
| PCI DSS Level 1 (v4.0.1) | Certified (Secure Vectors, April 2022) |
| SOC 2 | Issued July 2023 (verify Type I vs Type II with FPT) |
| ISO 27001 | Held |
| ISO 27017 (cloud security) | Held |
| ISO 27018 (PII in cloud) | Held |
| ISO 9001:2015 | Held |
| VMware Cloud Verified | Held |

#### Object Storage Pricing (only publicly listed pricing)

| Tier | Capacity | Price/month |
|------|----------|-------------|
| 1 | 2 TB | 3,500,000 VND (~$140 USD) |
| 2 | 5 TB | 6,000,000 VND (~$240 USD) |
| 3 | 10 TB | 10,000,000 VND (~$400 USD) |

All other services (compute, managed databases) require custom sales quotation — no self-service pricing published.

#### Data Centers

| Facility | Location | Certification |
|----------|----------|---------------|
| FPT Fornix HN01 | Hanoi | Tier III (Uptime Institute) |
| FPT Fornix HN02 | Hanoi | ANSI/TIA-942-B (valid through 12/2027) |
| FPT Fornix HCM01 | Ho Chi Minh City | Tier III |
| FPT Fornix HCM02 | Ho Chi Minh City | Tier III; 10,000 m², 3,600 racks |

Platform certifications: PCI DSS Level 1 (v4.0.1), ISO 27001, ISO 27017, ISO 27018. Certification scope is facility- and entity-specific — customer's own PCI scope requires separate evaluation.

#### Staged Architecture on FPT Cloud

**Stage 0 (1 operator, ~200 bookings/day):**
```
Cloudflare (CDN + DNS + SSL) → FPT Cloud Server (4vCPU/8GB) → Next.js standalone (PM2)
                                       ├── FPT Managed PostgreSQL
                                       ├── FPT Managed Redis
                                       └── FPT Object Storage (2TB)
```
Estimated ~5-8M VND/month ($200-320 USD). Single VPS, no K8s overhead.

**Stage 1 (10-30 operators):**
```
Cloudflare → FPT Load Balancer → 2x FPT Cloud Server (Next.js)
                                       ├── FPT Managed PG (HA)
                                       ├── FPT Managed Redis (HA)
                                       ├── FPT Object Storage (5TB)
                                       └── FPT Cloud Server (BullMQ worker)
```

**Stage 2 (100+ operators):**
```
Cloudflare → FPT Kubernetes Engine (FKE)
               ├── Next.js pods (auto-scale)
               ├── Worker pods (BullMQ)
               └── Cron pods
                    ├── FPT Managed PG (HA + read replica)
                    ├── FPT Managed Redis cluster
                    ├── FPT Object Storage (10TB)
                    └── FPT Managed Kafka (if event-driven needed)
```

#### Gap Services (not available or recommended external on FPT Cloud)

| Need | FPT Offering | Recommendation |
|------|-------------|----------------|
| CDN | Cloudflare reseller (FPT is sole VN distributor) | Cloudflare direct or via FPT Cloud Hub (edge caching only; origin stays in VN; cached static assets ≠ PII transfer) |
| DNS | No managed public DNS service | Cloudflare DNS (free tier) — set A records to FPT Floating IPs |
| SSL/TLS | Only bundled with WAF packages | Let's Encrypt via certbot + nginx (D10); or Cloudflare Origin CA for full-proxy mode |
| WAF | FPT Cloud WAF (CyRadar, 7.9M+ VND/mo) | Cloudflare WAF (Pro $20/mo) for Stage 0-1; evaluate FPT WAF at Stage 2 |
| Container Registry | FPT CR (16M VND/mo — expensive) | **GitHub Container Registry (GHCR)** — free, already using GitHub for source |
| Email sending | No transactional email API | Resend (already coded, `EMAIL_PROVIDER=resend`); future: AWS SES or Brevo |
| SMS (OTP) | FPT SMS API exists (limited) | eSMS (already coded, `NOTIFY_STUB` gate); widest VN carrier coverage; brandname OTP template registration required (5-10 business days) |
| Job queue | BullMQ on FPT Managed Redis | BullMQ requires `ioredis` (TCP, not Upstash HTTP REST); FPT Managed Redis or self-hosted |
| Secrets management | None (no KMS/Vault equivalent) | Env vars on VM + Zod validation at boot (D4); self-host HashiCorp Vault on FPT VM if needed later |
| Serverless | Not available | Use Docker on VPS (Stage 0) or FKE K8s pods (Stage 2) |
| Terraform | `fpt-corp/fptcloud` provider (v0.3.51) | Use from Day 1 for all provisioning; WAF + monitoring still portal-only |

#### Comparison: FPT Cloud vs Alternatives

| | FPT Cloud | Viettel IDC | CMC Cloud |
|---|-----------|-------------|-----------|
| Managed PG | Yes | Yes (VDB) | Yes |
| Managed Redis | Yes | Unknown | Unknown |
| S3 storage | Yes | Yes | Yes |
| Managed K8s | Yes (FKE) | Yes (VKS) | Unknown |
| Pricing transparency | Storage only | More transparent | More transparent |
| VN DC market share | ~23% | ~24% | ~10% |

FPT + Viettel + VNPT = ~70% of Vietnam data center market (GlobeNewsWire 2024).

**Rationale**: FPT Cloud is the broadest managed-service catalog among Vietnamese providers. All data stays physically in Vietnam → zero CDTIA obligation under Decree 13/2023 and PDPL 2025. Docker self-hosted (D3) is the deployment method on FPT VPS. Vercel sin1 (D2) is retained as a zero-ops alternative for staging/preview environments only.

> **2026-06-19**: FPT Cloud promoted from "elimination path" to **CHOSEN primary host**. See D8 (deployment contract) and D9 (cron sidecar) for the provider-agnostic infrastructure that makes future migration to AWS/Vercel/bare-metal a connection-string + DNS change.

> **Research basis** (2026-06-19): 105 claims extracted from 22 sources, 25 adversarially verified (3-vote), 20 confirmed, 5 killed. Key sources: fptcloud.com product pages, docs.fptcloud.com, Uptime Institute registry, TIA Online certifications, GlobeNewsWire Vietnam DC market report.

---

### D8: Provider-Agnostic Deployment Contract

The application defines a **deployment contract** — the minimum infrastructure any hosting provider must supply. Any provider meeting this contract can run the platform with zero application code changes.

| Requirement | Specification | Notes |
|-------------|--------------|-------|
| **Compute** | Linux VM or container runtime (Docker 24+) | Node.js 20 Alpine; Next.js standalone output; port 3000 |
| **PostgreSQL** | 16+ with PgBouncer (transaction mode) | Managed or self-hosted; `DATABASE_URL` (pooled :6432) + `DIRECT_URL` (direct :5432 for migrations) |
| **Redis** | 7+ (or in-memory for single-instance) | `REDIS_PROVIDER=ioredis` + `REDIS_URL` for self-hosted; `memory` for single-node |
| **Cron trigger** | HTTP caller on schedule | Hits `/api/cron/*` with `Authorization: Bearer <CRON_SECRET>`; see D9 |
| **Reverse proxy** | TLS termination + HTTP/2 | Nginx, Caddy, or cloud LB; see D10 |
| **DNS** | A/CNAME record pointing to reverse proxy | Cloudflare recommended for edge caching |
| **Outbound HTTPS** | Unrestricted egress on port 443 | PSP callbacks (MoMo, VNPay), eSMS, Resend, MISA |
| **Object storage** | S3-compatible API (deferred) | `STORAGE_ENDPOINT`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`; stub mode until Wave-9 |

**Provider mapping:**

| Need | FPT Cloud (chosen) | AWS | Vercel | Bare Metal |
|------|-------------------|-----|--------|------------|
| Compute | FPT Cloud Server | EC2 / ECS / EKS | Serverless Functions | Docker on any VPS |
| PostgreSQL | FPT Managed PG | RDS | External (Neon/Supabase) | Self-hosted PG + PgBouncer |
| Redis | FPT Managed Redis | ElastiCache | Upstash | Self-hosted Redis |
| Cron | Sidecar container (D9) | EventBridge + Lambda / ECS Scheduled Task | Vercel Cron (`vercel.json`) | Sidecar / host crontab |
| SSL | Let's Encrypt / Cloudflare | ACM + ALB | Built-in | Let's Encrypt / Cloudflare |
| CDN | Cloudflare | CloudFront | Built-in | Cloudflare |
| Object Storage | FPT Object Storage (S3-compat) | S3 | Vercel Blob / S3 | MinIO |

**Migration effort estimate:** switching providers = change DNS records + update connection strings (PG, Redis) + deploy Docker image to new host. Estimated 2-4 hours for experienced DevOps. Zero application code changes.

**Rationale**: Vendor lock-in is the primary risk for a startup that may need to optimize cost, comply with new regulations, or scale to different infrastructure. The deployment contract ensures the application is a portable artifact — not a Vercel app or an AWS app, but a Docker container that runs anywhere.

---

### D9: Cron Sidecar Container

Background jobs are triggered by HTTP calls to `/api/cron/*` endpoints authenticated with `CRON_SECRET` (see DS-006). The cron **trigger** is decoupled from the job **logic** — any scheduler that can make HTTP requests on a schedule works.

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| **A. Sidecar container (supercronic)** ✅ | Lightweight container running crontab, `curl`s app endpoints on schedule | Portable (runs on any Docker host); same container stack; health-checkable; logs to stdout | Extra container in compose; no built-in retry on HTTP failure |
| B. Host-level crontab | Linux crontab on VPS directly | Simplest; no extra container | Ties cron to specific VM; not containerized; harder to version-control; lost on VM rebuild |
| C. Platform-specific (Vercel Cron) | `vercel.json` declarations | Zero-config on Vercel; Vercel-injected auth | Vercel-only; not portable |
| D. Ofelia (Docker label-based) | Reads cron config from container labels | Docker-native scheduling | Less mature than supercronic; label-based config harder to review |

**Choice**: Option A (supercronic sidecar) for self-hosted. Option C retained in `vercel.json` for Vercel-based staging.

**Cron sidecar contract:**

```
Container: aptible/supercronic (or ghcr.io/aptible/supercronic)
Crontab:   /etc/supercronic/crontab (mounted volume)
Network:   Same Docker bridge as app container (http://app:3000)
Auth:      Authorization: Bearer ${CRON_SECRET}
Health:    supercronic process running + last-run timestamps
```

**Dual-config maintenance:** `vercel.json` cron definitions and the sidecar `crontab` file must declare identical schedules for the same 11 endpoints. The source of truth is the cron catalog in DS-006 §4.1. When adding/removing a cron job, update both files.

**Missed-cron detection:** `JobRunLog` table records every cron invocation with `startedAt` timestamp. An admin dashboard query can detect gaps: `SELECT jobName FROM JobRunLog GROUP BY jobName HAVING MAX(startedAt) < NOW() - INTERVAL '2x schedule'`. P4 alert (daily digest) per ADR-007 D5.

**Rationale**: Supercronic is a purpose-built cron replacement for containers — no syslog dependency, no PID files, proper signal handling, stdout/stderr logging compatible with Docker log drivers. The sidecar approach keeps cron in the same Docker Compose stack as the app, making the entire deployment portable as a unit.

---

### D10: Reverse Proxy & SSL Termination

Self-hosted deployment requires a reverse proxy in front of the Next.js application for TLS termination, HTTP/2, and domain routing.

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| **A. Nginx + Let's Encrypt (certbot)** ✅ | Industry-standard reverse proxy | Most Vietnamese DevOps teams know Nginx; battle-tested; huge documentation; fine-grained config | Manual certbot setup; config is verbose; no auto-TLS |
| B. Caddy | Modern reverse proxy with automatic HTTPS | Auto-TLS (ACME built-in); minimal config; HTTP/3 support | Less familiar to Vietnamese DevOps teams; smaller community; newer |
| C. Cloudflare Tunnel | Zero-config tunnel to origin | No public IP needed; DDoS protection; auto-TLS at edge | Adds dependency on Cloudflare; latency through tunnel; traffic transits overseas edge nodes |
| D. Traefik | Docker-native reverse proxy | Auto-discovers containers; auto-TLS; dashboard | Complex config for simple setups; heavier resource use |

**Choice**: Option A (Nginx + Let's Encrypt) for production. Cloudflare CDN in front for static asset caching and DDoS protection (does NOT replace origin Nginx).

**Architecture:**

```
Internet → Cloudflare (CDN + DNS + DDoS) → FPT Cloud Server public IP
  → Nginx (:443 TLS termination, :80 → 301 HTTPS)
    → Next.js app (http://localhost:3000)
```

**SSL strategy:**
- **Production**: Let's Encrypt via certbot with auto-renewal cron (`certbot renew --nginx`)
- **Alternative**: Cloudflare Origin CA certificates (15-year validity, Cloudflare-trusted only) — simpler if full-proxy mode is used
- **Staging**: Self-signed or Let's Encrypt staging

**Rationale**: Nginx is the lowest-risk choice for Vietnam-based hosting. Every Vietnamese hosting provider and DevOps engineer has Nginx experience. Let's Encrypt provides free, automated TLS certificates. Cloudflare in front adds edge caching for static assets (JS, CSS, images) without routing PII through overseas servers — origin responses (API routes, SSR pages) go directly from FPT Cloud to the client via Cloudflare's Vietnamese PoPs (Ho Chi Minh City, Hanoi).

---

## Consequences

### Positive

- **CDTIA eliminated** — all data in Vietnam; zero cross-border transfer obligation under PDPL 2025 (D7)
- **Provider-agnostic** — deployment contract (D8) ensures any Docker host works; migration = DNS + connection strings
- **Terraform IaC available** — `fpt-corp/fptcloud` provider (v0.3.51) covers core infra (VPC, instances, DB, storage, K8s); infra is documented and reproducible from Day 1
- **Persistent process available** — VPS hosting supports future BullMQ workers without platform constraints (Stage 1)
- **No cold starts** — long-running Node.js process; consistent latency
- **Fail-fast** — missing credentials caught at boot, not at runtime (D4)
- **Dev parity** — stub mode provides identical interfaces without external dependencies (D5)
- **Mechanical scaling** — evolution stages defined; triggers measurable (D6)
- **Cloudflare CDN** — edge caching for static assets without CDTIA concern; Vietnamese PoPs (HCM, Hanoi) for low latency
- **S3-compatible storage** — FPT Object Storage (MinIO-based) works with standard `@aws-sdk/client-s3`; swap to AWS S3/R2/Azure Blob = env var change

### Negative

- **DevOps overhead** — Docker, Nginx, SSL, and cron sidecar require setup and maintenance (vs Vercel zero-ops). Mitigated by Terraform IaC
- **No preview deploys** — Vercel's per-PR preview environments not available on self-hosted; Vercel staging retained for this
- **Dual cron config** — `vercel.json` + sidecar `crontab` must stay in sync if Vercel staging retained
- **FPT pricing opacity** — compute and managed database pricing require sales quotation; cost modeling blocked until quotes obtained
- **FPT Container Registry too expensive** — 16M VND/mo ($640) for image storage; GHCR (free) recommended instead; images transit international network on pull but this is deploy-time only, not user-facing
- **FPT engine versions unconfirmed** — PostgreSQL 16 and Redis 7 availability not publicly documented; must verify in Console before committing
- **No FPT secrets management** — no KMS/Vault equivalent; env vars + Zod validation is the only option until self-hosted Vault
- **No auto-scaling at Stage 0** — VPS requires manual vertical scaling; FPT Autoscale (VM cloning) available but adds complexity. Acceptable at ~200 bookings/day
- **PgBouncer still mandatory** — even with persistent process, connection pooling needed for concurrent request handling
