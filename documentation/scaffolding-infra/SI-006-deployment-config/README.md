# SI-006: Deployment Configuration

> Status: DOCUMENTED | References: ADR-020, DS-017, ADR-002, ADR-012

## Purpose

This document consolidates the deployment architecture for the BenXe bus-booking platform. It covers the hosting provider choice (FPT Cloud Vietnam as primary), the provider-agnostic deployment contract, the Docker Compose reference stack, the cron sidecar design, reverse proxy and SSL configuration, environment validation, non-functional requirements, the three-stage infrastructure evolution path, and operational playbooks. The platform's primary hosting constraint is data residency: all user PII, booking records, and payment data must remain physically in Vietnam to eliminate the CDTIA cross-border transfer obligation under PDPL 2025 Art. 25 and Decree 356/2025.

---

## 1. Hosting Architecture

### 1.1 Primary Host -- FPT Cloud (Vietnam)

FPT Cloud is the chosen production host (ADR-020 D2, pivot 2026-06-19). All compute and data reside in Vietnam (Hanoi or Ho Chi Minh City data centres), which eliminates the CDTIA filing requirement entirely. See SI-001 §2 for the architectural rationale and PDPL 2025 data residency context.

**Stage 0 architecture on FPT Cloud:**

```
Cloudflare (CDN + DNS + WAF + DDoS)
        | HTTPS
        v
FPT Cloud Server (4 vCPU / 8 GB / 80 GB SSD)
    +-- Nginx (TLS termination, :443 / :80->301)
    +-- Next.js standalone (:3000)
    +-- Cron sidecar (aptible/supercronic)
    +-- PgBouncer (:6432)
    +-- PostgreSQL 16 (:5432)   <- self-hosted OR FPT Managed PG
    +-- Redis 7 (:6379)         <- self-hosted OR FPT Managed Redis
```

**FPT Cloud service mapping (ADR-020 D7):**

| Stack need | FPT service | Notes |
|---|---|---|
| Compute | FPT Cloud Server (Standard/High Performance) | 2-16 vCPU, 4-32 GB RAM; Docker on Ubuntu; FPT Autoscale for VM cloning at Stage 1+ |
| PostgreSQL | FPT Database Engine for PostgreSQL | Managed HA, auto-failover, automated backup; PG 16 availability must be verified in the Console |
| Redis | FPT Database Engine for Redis | Managed backup/failover, hot-add expansion; Redis 7 availability must be verified in the Console |
| Object storage | FPT Object Storage (MinIO-based, S3-compatible) | 2 TB = 3,500,000 VND/month; `forcePathStyle: true` required; HN + HCM regions |
| IaC | Terraform `fpt-corp/fptcloud` (v0.3.51) | Covers VPC, subnet, security group, instance, floating IP, LB, database, storage, managed K8s, SSH keys |
| CDN / DNS | Cloudflare (FPT is sole VN/Laos/Cambodia Cloudflare distributor) | Vietnamese PoPs in HCM and Hanoi |
| Container registry | GitHub Container Registry (GHCR) | FPT CR costs 16M VND/month -- prohibitive; GHCR is free (see SI-003 Section 5) |
| WAF | Cloudflare WAF (Pro, $20/month) for Stage 0-1 | FPT Cloud WAF (CyRadar-based) deferred to Stage 2 |
| Secrets | Environment variables + Zod boot validation | No FPT KMS equivalent; self-host Vault post-Series-A if required |

**FPT Cloud data centre certifications:** PCI DSS Level 1 (v4.0.1), ISO 27001, ISO 27017, ISO 27018, SOC 2 (July 2023, verify Type I vs II). Four Tier III facilities: HN01, HN02, HCM01, HCM02.

### 1.2 Staging / Preview -- Vercel sin1 (Singapore)

Vercel (Singapore region) is retained for staging and per-PR preview deployments only (ADR-020 D2). Singapore hosting triggers a CDTIA obligation and is therefore ineligible for production use with real customer data.

### 1.3 CDTIA Impact by Provider

| Provider | Data location | CDTIA required? |
|---|---|---|
| FPT Cloud | Vietnam (Hanoi/HCMC) | No -- all data domestic |
| Viettel IDC | Vietnam | No |
| CMC Cloud | Vietnam | No |
| AWS ap-southeast-1 | Singapore | Yes |
| Vercel sin1 | Singapore | Yes |

---

## 2. Deployment Contract

Any hosting provider that satisfies all eight requirements below can run the platform with zero application code changes (ADR-020 D8, DS-017).

| # | Requirement | Specification | Key env vars |
|---|---|---|---|
| C1 | Compute | Linux (x86_64 or arm64) with Docker 24+ or Node.js 20+ | `PORT` (default 3000), `NODE_ENV=production` |
| C2 | PostgreSQL | 16+ with PgBouncer in transaction mode | `DATABASE_URL` (pooled :6432), `DIRECT_URL` (direct :5432 for migrations only) |
| C3 | Redis | 7+ (managed or self-hosted) or in-memory for single-instance testing | `REDIS_PROVIDER`, `REDIS_URL` |
| C4 | Cron trigger | HTTP caller on schedule hitting `/api/cron/*` with `Authorization: Bearer <CRON_SECRET>` | `CRON_SECRET` |
| C5 | TLS termination | Reverse proxy with HTTPS (TLS 1.2+, HTTP/2) | Nginx/Caddy config or cloud LB |
| C6 | DNS | A/CNAME record(s) pointing to the reverse proxy | Cloudflare recommended |
| C7 | Outbound HTTPS | Unrestricted egress on port 443 | Required for MoMo, VNPay, eSMS, Resend, MISA |
| C8 | Object storage | S3-compatible API (deferred until Wave-9) | `STORAGE_ENDPOINT`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY` |

### 2.1 Contract Verification Checklist

Before declaring a new provider ready for production traffic:

- [ ] `docker compose up` starts all services (app, PG, PgBouncer, Redis, cron sidecar)
- [ ] `curl http://localhost:3000/api/health` returns HTTP 200
- [ ] Cron trigger fires and `JobRunLog` rows appear in the database
- [ ] TLS certificate valid; HTTPS accessible from the public internet
- [ ] DNS resolves to the correct IP with expected TTL
- [ ] PSP webhook callback URLs reachable from MoMo/VNPay test servers
- [ ] `pnpm prisma migrate deploy` succeeds via `DIRECT_URL`

### 2.2 PgBouncer Transaction Mode

PgBouncer is mandatory because of concurrent request handling (ADR-020 D8). The platform uses `DATABASE_URL` pointing to PgBouncer on port 6432 (transaction mode) and `DIRECT_URL` pointing to PostgreSQL directly on port 5432 for schema migrations. If FPT DBProxy only supports session mode, self-host PgBouncer in Docker with `pool_mode=transaction`.

---

## 3. Reference Docker Compose -- Stage 0

Single-server stack for FPT Cloud Stage 0. All services communicate over an internal Docker bridge network; only Nginx exposes public ports.

```
+------------------------------------------------------+
| FPT Cloud Server (4 vCPU / 8 GB RAM / 80 GB SSD)    |
|                                                       |
|  +---------+  +----------+  +--------------------+  |
|  | Nginx   |  | Cron     |  | Next.js App        |  |
|  | :443    |  | Sidecar  |--| :3000 (standalone) |  |
|  | :80->301|  |(super-   |  |                    |  |
|  +---------+  | cronic)  |  | / customer         |  |
|       |       +----------+  | /op/ operator      |  |
|       +---------------------| /admin/ admin       |  |
|                             | /api/cron/* jobs    |  |
|                             +--------------------+  |
|  +-----------+  +----------+                        |
|  | PgBouncer |  | Redis 7  |                        |
|  | :6432     |  | :6379    |                        |
|  +-----+-----+  +----------+                        |
|        |                                              |
|  +-----+-----+                                       |
|  | PG 16     |  OR  FPT Managed PG + Redis            |
|  | :5432     |                                       |
|  +-----------+                                       |
+------------------------------------------------------+
         ^ HTTPS
+-----------------+
| Cloudflare CDN  |
| DNS + WAF +     |
| DDoS protection |
+-----------------+
```

**PostgreSQL deployment choice for Stage 0:**

- **Self-hosted** (PG 16 + PgBouncer in Docker Compose): lowest cost; single point of failure; requires daily `pg_dump` to FPT Object Storage.
- **FPT Managed PG** (recommended): HA with auto-failover, automated backup; higher cost but eliminates DB-ops burden.

### 3.1 Next.js Dockerfile

Three-stage build: `deps` -> `builder` -> `runner` (`node:20-alpine`, standalone output, non-root user). See SI-003 Section 4 for the build pipeline details.

---

## 4. Cron Sidecar

### 4.1 Image and Configuration

The cron trigger is a lightweight sidecar container running `aptible/supercronic` (ADR-020 D9, DS-017). Supercronic provides proper signal handling, no syslog dependency, stdout/stderr logging compatible with Docker log drivers, and standard crontab format.

The sidecar communicates with the Next.js container over the Docker internal bridge (`http://app:3000`). No public port is exposed. All endpoints are authenticated with `Authorization: Bearer ${CRON_SECRET}`.

### 4.2 Timezone

Set `TZ=Asia/Ho_Chi_Minh` on the cron container. The sidecar crontab schedules are written in Vietnam local time. `vercel.json` schedules are in UTC -- the daily `generate-trips` job documented as `0 1 * * *` in VN time appears as `0 18 * * *` UTC in `vercel.json`.

### 4.3 Dual-Config Maintenance

Both `vercel.json` (Vercel staging) and `deploy/crontab` (FPT production sidecar) must declare identical schedules for the same endpoints (ADR-020 D9). The canonical schedule source is DS-006. When adding or removing a cron job, update both files in the same commit.

### 4.4 Health Monitoring

| Signal | Detection method | Alert level |
|---|---|---|
| Cron container down | Docker healthcheck / process monitor | P2 -- all cron jobs stop |
| Missed cron run | `JobRunLog` gap query: `MAX(startedAt) < NOW() - 2x interval` per job | P4 -- daily digest (ADR-007 D5) |
| Cron HTTP failure | `curl -sf` non-zero exit code logged to stdout by supercronic | P3 -- review in log aggregator |
| App container unhealthy | `/api/health` returns non-200 | P1 -- all traffic and cron affected |

---

## 5. Cron Job Catalog (ADR-012)

All sweepers use `FOR UPDATE SKIP LOCKED` in batches of 500 rows. Each invocation is logged to `JobRunLog`. Financial operations (`settlePayout`) run exclusively via cron for ACID semantics and auditability.

| Job | Endpoint | Schedule | Behaviour |
|---|---|---|---|
| `expireHolds` | `/api/cron/sweep-holds` | Every 1 min | `active` holds past `expiresAt` -> `expired`. Restores seat capacity. |
| `closeSales` | `/api/cron/close-sales` | Every 1 min | Trips within departure window -> `salesClosed = true`. |
| `notificationDispatch` | `/api/cron/dispatch-notifications` | Every 1 min | Sweep pending `NotificationLog` rows. Retry with exponential backoff. |
| `settlePayout` | `/api/cron/process-payouts` | Every 5 min | Two-phase: `requested` -> `processing` -> `paid`/`failed`. T+1 settlement delay. |
| `einvoiceSubmission` | `/api/cron/` (einvoice route) | Every 5 min | Pending `EInvoice` rows -> MISA meInvoice API -> `issued`/`failed`. |
| `ticketPdfGeneration` | `/api/cron/generate-ticket-pdfs` | Every 2-5 min | Paid bookings without `ticketPdfKey` -> generate PDF -> upload to object storage. |
| `autoCompleteTrips` | `/api/cron/complete-trips` | Every 15 min | Departed trips past expected completion window -> `completed`. Triggers payout creation. |
| `charterExpirySweeper` | `/api/cron/charter-expiry` | Every 15 min | Expired charter requests -> state transition. |
| `sendReminders` | `/api/cron/send-reminders` | Every 15 min | Departure-eve and day-of trip reminders. |
| `paymentReconSweeper` | `/api/cron/reconcile-payments` | Every 30 min | Optional backup for unmatched bank-transfer payments (DS-013). |
| `generateFromTemplate` | `/api/cron/generate-trips` | Daily at 01:00 VN | Auto-generate Trip rows from `RecurringTripTemplate` for 14-day horizon. |
| `piiAnonymization` | `/api/cron/retention` | Daily at 03:00 VN | Booking PII anonymisation after 5-year PDPL 2025 retention period. |

### 5.1 `after()`-Accelerated Side Effects

Latency-sensitive notifications fire immediately inside Next.js `after()`. The `notificationDispatch` cron acts as the guaranteed catch-up path for any `after()` invocation that fails silently.

| Side effect | Trigger point |
|---|---|
| Booking confirmation SMS/ZNS | Payment webhook -> `applyPaidStatusTransition` |
| Operator new-booking notification | Payment webhook -> `applyPaidStatusTransition` |
| OTP SMS dispatch | `/api/auth/otp/send` |
| Trip cancellation SMS | `cancelTrip` -> NotificationLog per affected booking |
| Operator status-change SMS + email | `transitionOperatorStatus` |
| Overpay refund | Payment webhook -> `refundOut` |

### 5.2 Idempotency Guarantee

All background operations are safe to re-run. Idempotency is enforced by: `sourceEventId` unique constraint on `LedgerEntry`; `@@unique([adapter, providerTxnId])` on `PaymentEvent`; `completedAt IS NOT NULL` early-return on trip completion; `findFirst` dedup on payout creation; `INSERT ... ON CONFLICT DO NOTHING` on booking creation (ADR-012 D4). `SKIP LOCKED` ensures concurrent sidecar invocations process different rows without contention.

---

## 6. Nginx Configuration

### 6.1 Key Decisions

- Port 80 issues a permanent 301 redirect to HTTPS.
- `/_next/static/` assets are served with `immutable` cache headers (365-day max-age). Next.js content-hashes these filenames.
- `/api/health` is proxied without access logging to avoid log noise from uptime probes.
- `/api/cron/*` is restricted to `127.0.0.1` and the Docker internal bridge network (`172.16.0.0/12`). External callers receive HTTP 403.
- Nginx is chosen over Caddy or Traefik for Vietnam DevOps familiarity (ADR-020 D10).

### 6.2 Security Headers

The Nginx config includes `X-Frame-Options DENY`, `X-Content-Type-Options nosniff`, and `Referrer-Policy strict-origin-when-cross-origin`. The full OWASP header set (including CSP with PSP-specific `connect-src` origins) must be added before go-live (ADR-008 D4).

---

## 7. SSL Strategy

| Strategy | When to use | Auto-renewal |
|---|---|---|
| Let's Encrypt (certbot) | Default for FPT Cloud self-hosted | `certbot renew --nginx` via system cron, twice daily |
| Cloudflare Origin CA | When Cloudflare full-proxy mode is in use | 15-year validity; no renewal cron needed |
| Self-signed | Local dev only | N/A |

**Recommendation:** Let's Encrypt for initial launch. Evaluate Cloudflare Origin CA if full Cloudflare proxy mode is adopted.

**FPT Cloud firewall rule:** Accept inbound on ports 80 and 443 only from Cloudflare IP ranges. Automate the IP list refresh via a scheduled task.

---

## 8. Environment Validation (ADR-020 D4)

All environment variables are defined and validated in a Zod schema with `superRefine` guards at application boot. The application fails fast on startup if required credentials are missing. Switching from stub to real mode without the corresponding credentials is a boot-time error, not a runtime error. See SI-002 Section 4 for the full variable groups and SI-002 Section 5 for stub/real mode switching details.

---

## 9. Non-Functional Requirements (ADR-002)

These targets are the measurable performance and reliability floor the deployment must sustain.

### 9.1 Availability

| Period | Target | Monthly downtime budget |
|---|---|---|
| Normal operation | 99.5% | ~3.6 hours |
| Tet 2-week window | 99.9% | ~43 minutes |

Tet escalation measures: pre-provision read replica, freeze deployments for the 2-week window, activate 2-minute detection monitoring. FPT Managed PG with HA auto-failover is the recommended single-point-of-failure mitigation.

### 9.2 Latency Targets

| Endpoint class | p95 target | Alert threshold |
|---|---|---|
| Customer pages (LCP) | <= 2.5 s | <= 4.0 s |
| Trip search API | <= 300 ms | <= 500 ms |
| Hold creation API | <= 200 ms | <= 400 ms |
| Payment webhook processing | <= 500 ms | <= 1,000 ms |
| Operator console CRUD | <= 200 ms | <= 400 ms |

No cold-start penalty on FPT VPS (long-running Node.js process). Cloudflare Vietnamese PoPs (HCM, Hanoi) serve static assets without routing through overseas nodes.

### 9.3 Throughput

**Target: 2,000 concurrent booking attempts (hold creation + payment) during Tet.** PgBouncer transaction-mode pooling is the enabling constraint; `FOR UPDATE SKIP LOCKED` avoids contention across concurrent cron invocations.

### 9.4 Monitoring Detection Target

**Target: 2-minute detection for critical service incidents.** External probe every 60 seconds; alert after 2 consecutive failures = 120-second detection window. Required tooling: BetterStack or equivalent uptime monitor (ADR-007).

---

## 10. Staged Evolution Path (ADR-020 D6)

Infrastructure scales in three defined stages, each triggered by measurable signals rather than arbitrary timelines. SI-001 §7 provides the architectural summary (booking-volume triggers); this section provides the infrastructure detail, cost estimates, and operational triggers.

### Stage 0 -- Single App (Current)

- One FPT Cloud Server (4 vCPU / 8 GB)
- Docker Compose: Next.js + PgBouncer + PostgreSQL + Redis + cron sidecar
- Estimated cost: ~8,500,000-13,000,000 VND/month (~$340-520)

**Trigger to Stage 1:** cron jobs exceed 30-second latency OR admin surface requires stronger isolation.

### Stage 1 -- Worker + Read Replica

- Admin split to `admin.busbooking.vn` subdomain (separate deploy)
- BullMQ worker process over FPT Managed Redis (requires `ioredis`, not Upstash)
- Estimated cost: ~$800-1,500/month

**Trigger to Stage 2:** single module consuming >50% CPU sustained OR search p95 exceeds 200 ms.

### Stage 2 -- Service Extraction on FKE

- FPT Kubernetes Engine (FKE) with auto-scaling pods
- Extract bottleneck domain to a separate service; the module barrel is the existing API boundary
- Evaluate FPT Cloud WAF (CyRadar) as Cloudflare WAF replacement at this scale
- Estimated cost: ~$2,000-4,000/month

---

## 11. Cost Comparison

| Component | FPT Cloud (est.) | AWS Singapore | Vercel Pro |
|---|---|---|---|
| Compute | ~$80-160/mo | t3.medium: ~$30/mo | $20/mo |
| PostgreSQL | ~$80-120/mo managed | RDS db.t3.micro: ~$15/mo | Neon Free / $19/mo Pro |
| Redis | ~$40-80/mo managed | ElastiCache t3.micro: ~$13/mo | Upstash Free / $10/mo Pro |
| Object storage | ~$140/mo for 2 TB | ~$5/mo for 50 GB | ~$0/mo (1 GB free) |
| **Stage 0 total** | **~$340-520/mo** | **~$68-168/mo** | **~$40-49/mo** |

**CDTIA compliance cost** (not in the table): estimated $2,000-5,000 one-time legal filing plus $500-1,000/year for ongoing maintenance. This cost applies to AWS Singapore and Vercel sin1 but not to FPT Cloud. The CDTIA elimination value exceeds the price premium at all stages.

---

## 12. WAF and DDoS Protection

**Stage 0-1:** Cloudflare WAF Pro ($20/month). OWASP Top 10 managed rules, DDoS protection, bot management.

**FPT Cloud firewall rule:** Accept inbound ports 80/443 only from Cloudflare IP ranges. Block all other inbound. Automate IP list refresh.

**Stage 2:** Evaluate FPT Cloud WAF (CyRadar-based, 7,900,000-16,000,000 VND/month) if Cloudflare WAF misses Vietnam-specific attack patterns.

---

## 13. Provider Migration Playbook

### 13.1 Pre-Migration (days before)

1. Provision new compute, PostgreSQL, and Redis on the target provider.
2. Verify the deployment contract checklist (Section 2.1) on the new provider.
3. Set up reverse proxy and SSL on the new provider.
4. Lower DNS TTL to 300 seconds at least 48 hours before the cutover.

### 13.2 Migration Window (~2-4 hours)

1. Optional: activate static maintenance page on Nginx origin to quiesce writes.
2. `pg_dump` from current PostgreSQL -> `pg_restore` to target PostgreSQL.
3. Verify row counts and critical table integrity.
4. Update `.env.production` on the target with new `DATABASE_URL` and `REDIS_URL`.
5. `docker compose up -d` on the target provider.
6. Verify `curl http://localhost:3000/api/health` returns HTTP 200.
7. Fire one cron job manually to verify the cron sidecar.
8. Switch DNS A record to the target provider IP.
9. Monitor for 1 hour.
10. Decommission the old provider after 48-hour DNS propagation buffer.

### 13.3 Post-Migration Checklist

- Update PSP webhook callback URLs in MoMo and VNPay dashboards.
- Update `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_BASE_URL` if the domain changed.
- Verify eSMS OTP delivery end-to-end.
- Run the Playwright e2e smoke test suite against the new deployment.

### 13.4 Rollback

DNS revert to the old provider IP (propagation 5-60 minutes at TTL 300). Keep the old provider running for the full 48-hour buffer.

---

## 14. S3-Compatible Object Storage Portability

FPT Object Storage is MinIO-based. The `@aws-sdk/client-s3` is used with a custom endpoint and `forcePathStyle: true`. Setting `STORAGE_ENDPOINT` activates path-style mode; omitting it reverts to AWS virtual-hosted style.

| Provider | `STORAGE_ENDPOINT` | `forcePathStyle` |
|---|---|---|
| FPT Object Storage | `https://hn01.vstorage.fptcloud.com` (verify in Console) | `true` |
| AWS S3 | absent (SDK default) | `false` |
| Cloudflare R2 | `https://<acct>.r2.cloudflarestorage.com` | `true` |
| MinIO (local dev) | `http://localhost:9000` | `true` |

---

## Cross-References

- **ADR-020** -- Deployment and Infrastructure: hosting pivot, Docker self-hosted, env validation, stub/real mode, staged evolution, FPT Cloud service mapping, cron sidecar, reverse proxy
- **DS-017** -- Deployment Portability Design: deployment contract C1-C8, Docker Compose reference, provider mapping, cron sidecar spec, Nginx config, migration playbook, cost comparison, WAF/DDoS, IaC, S3 portability
- **ADR-002** -- NFR Targets: availability, latency, throughput, hold TTL, financial precision, monitoring detection
- **ADR-012** -- Background Jobs: job catalog, `FOR UPDATE SKIP LOCKED` pattern, hybrid `after()` + cron trigger model, payout pipeline
- **ADR-007** -- Observability: monitoring platform status (BetterStack/Sentry); alerting levels P1-P4
- **DS-006** -- Background Jobs Design: canonical cron schedule source for dual-config maintenance
- **DS-013** -- Payment Reconciliation: SePay webhook as primary bank-transfer confirmation; `paymentReconSweeper` as backup
- **SI-001** -- Project Scaffold: stack overview, staged evolution summary, hosting summary
- **SI-002** -- Developer Environment: environment variable groups, stub/real mode switching, local cron testing
- **SI-003** -- CI/CD Pipeline: Docker build details, container registry, IaC
- **SI-005** -- Testing Strategy: real-DB mandate for integration tests, concurrency testing under `SELECT FOR UPDATE`, load test gaps for Tet-surge target

---

## Known Gaps

- **FPT PostgreSQL 16 unconfirmed:** PG 16 availability on FPT Database Engine is not publicly documented. Must be verified in the Console before committing to managed PG.
- **FPT Redis 7 unconfirmed:** Same verification requirement as PG 16.
- **FPT DBProxy transaction mode unconfirmed:** If FPT DBProxy only supports session mode, self-host PgBouncer with `pool_mode=transaction`.
- **FPT compute pricing opaque:** All FPT Cloud pricing except Object Storage requires a sales quotation. Cost estimates are market-rate approximations.
- **`superRefine` production guards incomplete:** Not all secrets have minimum-length enforcement. Full audit required before Issue 094 go-live (ADR-020 D4).
- **Missing cron routes:** `operatorLicenseAlert` and `piiAnonymization` have no implemented cron route yet. Required before go-live.
- **`paymentReconSweeper` not built:** SePay webhook (DS-013) is the sole bank-transfer confirmation path until the recon sweeper lands.
- **RPO/RTO not defined:** Recovery Point Objective and Recovery Time Objective for database failure are not documented (ADR-002 Known Gaps).
- **No load test results:** The 2,000 concurrent booking target has no load-test infrastructure or historical results.
- **No monitoring tooling deployed:** BetterStack and Sentry are referenced but not deployed (ADR-007). The 2-minute detection target has no tooling to enforce it.
- **Dual cron config drift risk:** `vercel.json` and `deploy/crontab` must be kept in sync manually with no automated parity check.
- **Payout processing stranding:** If a payout transitions to `processing` and the cron crashes before confirming `paid`/`failed`, it stays stranded with no automatic recovery timeout.
