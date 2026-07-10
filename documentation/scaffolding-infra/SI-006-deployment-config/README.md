# SI-006: Deployment Configuration

> Status: DOCUMENTED | References: ADR-020, DS-017, ADR-002, ADR-012

## Purpose

This document consolidates the deployment architecture for the BenXe bus-booking platform. It covers the hosting provider choice (Vercel Pro sin1), the deployment contract, environment validation, non-functional requirements, the staged infrastructure evolution path, and operational playbooks. CDTIA filing is accepted for Singapore-hosted services (Vercel, Neon, Upstash).

---

## 1. Hosting Architecture

### 1.1 Primary Host -- Vercel Pro + Neon + Upstash

Vercel Pro (Singapore, sin1) is the primary production host (ADR-020 D11). Database is Neon serverless PostgreSQL (ap-southeast-1), Redis is Upstash (ap-southeast-1), storage is Cloudflare R2. CDTIA filing accepted for Singapore-hosted services.

**Stage 0 architecture on Vercel:**

```
Vercel Edge Network (CDN + Edge Middleware)
        |
        v
Vercel Serverless Functions (sin1)
    +-- Next.js App (Node.js runtime)
    +-- Vercel Cron (11 jobs via vercel.json)
        |
        +-- Neon PostgreSQL (ap-southeast-1)
        |   (built-in pooler replaces PgBouncer)
        +-- Upstash Redis (ap-southeast-1)
        |   (HTTP REST, REDIS_PROVIDER=upstash)
        +-- Cloudflare R2 (object storage)
```

### 1.2 Vercel Environments

Vercel serves both production and staging/preview. Per-PR preview deploys use Neon database branching (instant copy-on-write) for isolated preview databases.

### 1.3 CDTIA Impact

With the Vercel-first stack, CDTIA filing is required and accepted for Singapore-hosted services (PDPL 2025 Art. 25).

---

## 2. Deployment Contract

Any hosting provider that satisfies all eight requirements below can run the platform with zero application code changes (ADR-020 D8, DS-017).

| # | Requirement | Specification | Key env vars |
|---|---|---|---|
| C1 | Compute | Linux (x86_64 or arm64) with Node.js 20+ | `PORT` (default 3000), `NODE_ENV=production` |
| C2 | PostgreSQL | 16+ with connection pooling in transaction mode | `DATABASE_URL` (pooled), `DIRECT_URL` (direct for migrations only) |
| C3 | Redis | 7+ (managed or self-hosted) or in-memory for single-instance testing | `REDIS_PROVIDER`, `REDIS_URL` |
| C4 | Cron trigger | HTTP caller on schedule hitting `/api/cron/*` with `Authorization: Bearer <CRON_SECRET>` | `CRON_SECRET` |
| C5 | TLS termination | HTTPS (TLS 1.2+, HTTP/2) | Cloud provider or reverse proxy |
| C6 | DNS | A/CNAME record(s) pointing to the hosting provider | Cloudflare recommended |
| C7 | Outbound HTTPS | Unrestricted egress on port 443 | Required for MoMo, VNPay, eSMS, Resend, MISA |
| C8 | Object storage | S3-compatible API (deferred until Wave-9) | `STORAGE_ENDPOINT`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY` |

### 2.1 Contract Verification Checklist

Before declaring a new provider ready for production traffic:

- [ ] Application starts and serves traffic
- [ ] `curl https://<domain>/api/health` returns HTTP 200
- [ ] Cron trigger fires and `JobRunLog` rows appear in the database
- [ ] TLS certificate valid; HTTPS accessible from the public internet
- [ ] DNS resolves correctly with expected TTL
- [ ] PSP webhook callback URLs reachable from MoMo/VNPay test servers
- [ ] `pnpm prisma migrate deploy` succeeds via `DIRECT_URL`

### 2.2 Connection Pooling -- Transaction Mode

Connection pooling in transaction mode is mandatory because of concurrent request handling (ADR-020 D8). On Vercel, Neon's built-in connection pooler handles this. The platform uses `DATABASE_URL` pointing to the pooled connection and `DIRECT_URL` pointing to PostgreSQL directly for schema migrations.

---

## 3. Cron Job Catalog (ADR-012)

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

### 3.1 `after()`-Accelerated Side Effects

Latency-sensitive notifications fire immediately inside Next.js `after()`. The `notificationDispatch` cron acts as the guaranteed catch-up path for any `after()` invocation that fails silently.

| Side effect | Trigger point |
|---|---|
| Booking confirmation SMS/ZNS | Payment webhook -> `applyPaidStatusTransition` |
| Operator new-booking notification | Payment webhook -> `applyPaidStatusTransition` |
| OTP SMS dispatch | `/api/auth/otp/send` |
| Trip cancellation SMS | `cancelTrip` -> NotificationLog per affected booking |
| Operator status-change SMS + email | `transitionOperatorStatus` |
| Overpay refund | Payment webhook -> `refundOut` |

### 3.2 Idempotency Guarantee

All background operations are safe to re-run. Idempotency is enforced by: `sourceEventId` unique constraint on `LedgerEntry`; `@@unique([adapter, providerTxnId])` on `PaymentEvent`; `completedAt IS NOT NULL` early-return on trip completion; `findFirst` dedup on payout creation; `INSERT ... ON CONFLICT DO NOTHING` on booking creation (ADR-012 D4). `SKIP LOCKED` ensures concurrent cron invocations process different rows without contention.

---

## 4. Environment Validation (ADR-020 D4)

All environment variables are defined and validated in a Zod schema with `superRefine` guards at application boot. The application fails fast on startup if required credentials are missing. Switching from stub to real mode without the corresponding credentials is a boot-time error, not a runtime error. See SI-002 Section 4 for the full variable groups and SI-002 Section 5 for stub/real mode switching details.

---

## 5. Non-Functional Requirements (ADR-002)

These targets are the measurable performance and reliability floor the deployment must sustain.

### 5.1 Availability

| Period | Target | Monthly downtime budget |
|---|---|---|
| Normal operation | 99.5% | ~3.6 hours |
| Tet 2-week window | 99.9% | ~43 minutes |

Tet escalation measures: pre-provision read replica, freeze deployments for the 2-week window, activate 2-minute detection monitoring.

### 5.2 Latency Targets

| Endpoint class | p95 target | Alert threshold |
|---|---|---|
| Customer pages (LCP) | <= 2.5 s | <= 4.0 s |
| Trip search API | <= 300 ms | <= 500 ms |
| Hold creation API | <= 200 ms | <= 400 ms |
| Payment webhook processing | <= 500 ms | <= 1,000 ms |
| Operator console CRUD | <= 200 ms | <= 400 ms |

Cloudflare Vietnamese PoPs (HCM, Hanoi) serve static assets without routing through overseas nodes.

### 5.3 Throughput

**Target: 2,000 concurrent booking attempts (hold creation + payment) during Tet.** Connection pooling in transaction mode is the enabling constraint; `FOR UPDATE SKIP LOCKED` avoids contention across concurrent cron invocations.

### 5.4 Monitoring Detection Target

**Target: 2-minute detection for critical service incidents.** External probe every 60 seconds; alert after 2 consecutive failures = 120-second detection window. Required tooling: BetterStack or equivalent uptime monitor (ADR-007).

---

## 6. Staged Evolution Path (ADR-020 D6)

Infrastructure scales in three defined stages, each triggered by measurable signals rather than arbitrary timelines. SI-001 §7 provides the architectural summary (booking-volume triggers); this section provides the infrastructure detail, cost estimates, and operational triggers.

### Stage 0 -- Single App (Current)

- Vercel Pro (sin1) + Neon Launch + Upstash PAYG + Cloudflare R2
- Cron via `vercel.json` (11 endpoints)
- Estimated cost: ~$55-70/month (before SMS/email/monitoring)

**Trigger to Stage 1:** cron jobs exceed 30-second latency OR admin surface requires stronger isolation.

### Stage 1 -- Worker + Read Replica

- Admin split to `admin.busbooking.vn` subdomain (separate deploy)
- BullMQ worker process (requires `ioredis`, not Upstash)
- Estimated cost: ~$800-1,500/month

**Trigger to Stage 2:** single module consuming >50% CPU sustained OR search p95 exceeds 200 ms.

### Stage 2 -- Service Extraction

- Kubernetes with auto-scaling pods
- Extract bottleneck domain to a separate service; the module barrel is the existing API boundary
- Estimated cost: ~$2,000-4,000/month

---

## 7. Cost Comparison

| Component | Vercel Stack (primary) | AWS Singapore |
|---|---|---|
| Compute | $20/mo (Vercel Pro) | t3.medium: ~$30/mo |
| PostgreSQL | $19/mo (Neon Launch) | RDS db.t3.micro: ~$15/mo |
| Redis | $0-2/mo (Upstash PAYG) | ElastiCache t3.micro: ~$13/mo |
| Object storage | $0-5/mo (Cloudflare R2) | ~$5/mo for 50 GB |
| **Stage 0 total** | **~$55-70/mo** | **~$68-168/mo** |

CDTIA filing cost (~$2-5K one-time, ~$500-1K/year) applies to both Vercel and AWS stacks but is accepted as the cost of zero-ops deployment.

---

## 8. WAF and DDoS Protection

**Stage 0-1:** Cloudflare WAF Pro ($20/month). OWASP Top 10 managed rules, DDoS protection, bot management.

**Stage 2:** Evaluate dedicated WAF if Cloudflare WAF misses Vietnam-specific attack patterns.

---

## 9. Provider Migration Playbook

### 9.1 Pre-Migration (days before)

1. Provision new compute, PostgreSQL, and Redis on the target provider.
2. Verify the deployment contract checklist (Section 2.1) on the new provider.
3. Lower DNS TTL to 300 seconds at least 48 hours before the cutover.

### 9.2 Migration Window (~2-4 hours)

1. Optional: activate maintenance page to quiesce writes.
2. `pg_dump` from current PostgreSQL -> `pg_restore` to target PostgreSQL.
3. Verify row counts and critical table integrity.
4. Update environment variables on the target with new `DATABASE_URL` and `REDIS_URL`.
5. Deploy the application on the target provider.
6. Verify `/api/health` returns HTTP 200.
7. Fire one cron job manually to verify cron execution.
8. Switch DNS to the target provider.
9. Monitor for 1 hour.
10. Decommission the old provider after 48-hour DNS propagation buffer.

### 9.3 Post-Migration Checklist

- Update PSP webhook callback URLs in MoMo and VNPay dashboards.
- Update `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_BASE_URL` if the domain changed.
- Verify eSMS OTP delivery end-to-end.
- Run the Playwright e2e smoke test suite against the new deployment.

### 9.4 Rollback

DNS revert to the old provider (propagation 5-60 minutes at TTL 300). Keep the old provider running for the full 48-hour buffer.

---

## 10. S3-Compatible Object Storage Portability

The `@aws-sdk/client-s3` is used with a custom endpoint and `forcePathStyle: true` for non-AWS providers. Setting `STORAGE_ENDPOINT` activates path-style mode; omitting it reverts to AWS virtual-hosted style.

| Provider | `STORAGE_ENDPOINT` | `forcePathStyle` |
|---|---|---|
| AWS S3 | absent (SDK default) | `false` |
| Cloudflare R2 | `https://<acct>.r2.cloudflarestorage.com` | `true` |
| MinIO (local dev) | `http://localhost:9000` | `true` |

---

## Cross-References

- **ADR-020** -- Deployment and Infrastructure: hosting pivot, env validation, stub/real mode, staged evolution
- **DS-017** -- Deployment Portability Design: deployment contract C1-C8, provider mapping, cost comparison, WAF/DDoS, S3 portability
- **ADR-002** -- NFR Targets: availability, latency, throughput, hold TTL, financial precision, monitoring detection
- **ADR-012** -- Background Jobs: job catalog, `FOR UPDATE SKIP LOCKED` pattern, hybrid `after()` + cron trigger model, payout pipeline
- **ADR-007** -- Observability: monitoring platform status (BetterStack/Sentry); alerting levels P1-P4
- **DS-006** -- Background Jobs Design: canonical cron schedule source
- **DS-013** -- Payment Reconciliation: SePay webhook as primary bank-transfer confirmation; `paymentReconSweeper` as backup
- **SI-001** -- Project Scaffold: stack overview, staged evolution summary, hosting summary
- **SI-002** -- Developer Environment: environment variable groups, stub/real mode switching, local cron testing
- **SI-003** -- CI/CD Pipeline: container registry, deployment overview
- **SI-005** -- Testing Strategy: real-DB mandate for integration tests, concurrency testing under `SELECT FOR UPDATE`, load test gaps for Tet-surge target

---

## Known Gaps

- **`superRefine` production guards incomplete:** Not all secrets have minimum-length enforcement. Full audit required before go-live (ADR-020 D4).
- **Missing cron routes:** `operatorLicenseAlert` and `piiAnonymization` have no implemented cron route yet. Required before go-live.
- **`paymentReconSweeper` not built:** SePay webhook (DS-013) is the sole bank-transfer confirmation path until the recon sweeper lands.
- **RPO/RTO not defined:** Recovery Point Objective and Recovery Time Objective for database failure are not documented (ADR-002 Known Gaps).
- **No load test results:** The 2,000 concurrent booking target has no load-test infrastructure or historical results.
- **No monitoring tooling deployed:** BetterStack and Sentry are referenced but not deployed (ADR-007). The 2-minute detection target has no tooling to enforce it.
- **Payout processing stranding:** If a payout transitions to `processing` and the cron crashes before confirming `paid`/`failed`, it stays stranded with no automatic recovery timeout.
