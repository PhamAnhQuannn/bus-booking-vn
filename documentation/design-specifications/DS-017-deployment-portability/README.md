# DS-017 -- Deployment Portability Design

## 1. Overview

This document defines the provider-agnostic deployment architecture for the BusBooking platform. The primary production host is Vercel Pro sin1 + Neon + Upstash (ADR-020 D11). The deployment contract (C1-C8) ensures migration to any alternative provider is a DNS + connection-string change.

The core principle: **the application is portable. The hosting provider is a configuration detail, not an architectural dependency.**

**Source ADRs.** ADR-020 (Deployment -- D2 hosting pivot, D8 deployment contract, D11 Vercel Pro restore). ADR-012 (Background Jobs). ADR-007 (Observability).

**Cross-references.** DS-006 (Background Jobs) &sect;2.1 for cron trigger modes. DS-003 (API Contract) &sect;10 for cron endpoint table. ADR-020 D4 for env validation. `vercel.json` for Vercel cron definitions.

**Regulatory driver.** PDPL 2025 Art. 25 (cross-border transfer), Decree 356/2025 (foreign cloud = cross-border), Decree 53/2022 (data localization). Vercel sin1 (Singapore) requires CDTIA filing (accepted).

---

## 2. Deployment Contract

Any hosting provider must supply the following infrastructure for the platform to operate. Meeting this contract guarantees zero application code changes on migration.

| # | Requirement | Specification | Env Vars |
|---|------------|---------------|----------|
| C1 | **Compute** | Linux (x86_64 or arm64) with Node.js 20+ | `PORT` (default 3000), `NODE_ENV=production` |
| C2 | **PostgreSQL** | 16+ with PgBouncer (transaction mode) | `DATABASE_URL` (pooled), `DIRECT_URL` (direct, migrations only) |
| C3 | **Redis** | 7+ (managed or self-hosted) OR in-memory for single-instance | `REDIS_PROVIDER` (`ioredis`\|`upstash`\|`memory`), `REDIS_URL` |
| C4 | **Cron trigger** | HTTP caller on schedule (host crontab or managed cron) | `CRON_SECRET` (shared secret for Bearer auth) |
| C5 | **TLS termination** | HTTPS (TLS 1.2+) via cloud LB or reverse proxy | Cloud LB or Nginx/Caddy config |
| C6 | **DNS** | A/CNAME record(s) pointing to edge | Domain registrar config |
| C7 | **Outbound HTTPS** | Unrestricted egress on port 443 | -- |
| C8 | **Object storage** | S3-compatible API (deferred until Wave-9) | `STORAGE_ENDPOINT`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY` |

### 2.1 Contract Verification Checklist

Before declaring a new provider ready:

- [ ] Application starts and serves requests
- [ ] `curl https://<domain>/api/health` returns 200
- [ ] Cron trigger fires and `JobRunLog` rows appear
- [ ] TLS certificate valid and HTTPS accessible
- [ ] DNS resolves to the correct endpoint
- [ ] PSP webhook callback URLs reachable from MoMo/VNPay test servers
- [ ] `pnpm prisma migrate deploy` succeeds via `DIRECT_URL`

---

## 3. Provider Mapping Matrix

How each potential provider satisfies the deployment contract:

> **2026-06-21 Update**: Vercel Pro + Neon + Upstash is the primary production stack (ADR-020 D11). The deployment contract (C1-C8) ensures migration between providers is a DNS + connection-string change.

| Contract | AWS | Vercel | Bare Metal / Other VPS |
|----------|-----|--------|------------------------|
| C1 Compute | EC2 (t3.medium) / ECS Fargate / EKS | Serverless Functions (no Docker) | Any Linux VPS (DigitalOcean, Linode, Hetzner) |
| C2 PostgreSQL | RDS PostgreSQL | External: Neon or Supabase | Self-hosted PG 16 + PgBouncer in Docker |
| C3 Redis | ElastiCache for Redis | Upstash (overseas -- needs CDTIA) | Self-hosted Redis 7 in Docker |
| C4 Cron | EventBridge + Lambda / ECS Scheduled Task | Vercel Cron (`vercel.json`) | Linux crontab |
| C5 TLS | ACM + ALB (free managed certs) | Built-in (automatic) | Nginx/Caddy + Let's Encrypt |
| C6 DNS | Route 53 | Vercel DNS (built-in) | Cloudflare / registrar DNS |
| C7 Egress | Unrestricted (security group config) | Unrestricted | Unrestricted |
| C8 Storage | S3 | Vercel Blob / S3 | MinIO (self-hosted S3-compat) |
| WAF | AWS WAF | Built-in | Cloudflare WAF |
| IaC | Terraform `hashicorp/aws` | `vercel/vercel` + vercel.json | Terraform / Ansible |
| Secrets | Secrets Manager / SSM | Encrypted env vars | Env vars / Vault |

### 3.1 CDTIA Impact by Provider

| Provider | Data Location | CDTIA Required? |
|----------|--------------|-----------------|
| AWS ap-southeast-1 | Singapore | **Yes** -- cross-border transfer |
| **Vercel sin1** | Singapore | **Yes** -- cross-border transfer |
| Viettel IDC | Vietnam | **No** |
| CMC Cloud | Vietnam | **No** |

---

## 4. Migration Playbook

Step-by-step for switching from Provider A to Provider B.

### 4.1 Pre-Migration

1. Provision new compute, PG, and Redis on Provider B
2. Verify deployment contract checklist (&sect;2.1) on Provider B
3. Set up TLS termination on Provider B
4. Configure DNS with low TTL (300s) 48 hours before migration

### 4.2 Migration (Maintenance Window)

1. Enable maintenance mode on current provider
2. `pg_dump` from Provider A PostgreSQL -> `pg_restore` to Provider B PostgreSQL
3. Verify row counts and critical data integrity
4. Update environment variables on Provider B with new `DATABASE_URL`, `REDIS_URL`
5. Deploy application on Provider B
6. Verify `/api/health` returns 200
7. Run one cron job manually to verify cron trigger
8. Switch DNS to Provider B
9. Monitor for 1 hour: check `JobRunLog`, error logs, PSP webhook delivery
10. Decommission Provider A after 48-hour DNS propagation buffer

### 4.3 Post-Migration

- Verify PSP webhook callback URLs point to new domain/IP (MoMo IPN URL, VNPay IPN URL)
- Update `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_BASE_URL` if domain changed
- Verify eSMS delivery (OTP flow)
- Run e2e smoke test against new deployment

### 4.4 Estimated Effort

| Task | Time |
|------|------|
| Provision infrastructure | 1-2 hours |
| Database migration | 30-60 minutes (depends on size) |
| Config + deploy | 30 minutes |
| Verification + DNS switch | 30 minutes |
| **Total** | **2-4 hours** |

### 4.5 Rollback

- DNS revert to Provider A (TTL-dependent, 5-60 minutes)
- Provider A kept running during 48-hour buffer
- No data written to Provider B during DNS propagation needs back-migration (read-only period optional)

---

## 5. Cost Comparison Matrix

Estimates for Stage 0 (~200 bookings/day, 1 operator).

> **2026-06-21 Update**: With the pivot to Vercel Pro + Neon + Upstash as primary (ADR-020 D11), see SI-006 &sect;11 for the current cost breakdown.

| Component | AWS (Singapore) | Vercel Pro |
|-----------|-----------------|------------|
| Compute | t3.medium: ~$30/mo | $20/mo (Pro plan) |
| PostgreSQL | RDS db.t3.micro: ~$15/mo | Neon Free / $19/mo Pro |
| Redis | ElastiCache t3.micro: ~$13/mo | Upstash Free / $10/mo Pro |
| Object Storage | S3: ~$5/mo for 50GB | Vercel Blob: $0/mo (1GB free) |
| CDN/DNS | CloudFront: ~$5/mo | Built-in (free) |
| SSL | ACM (free) | Built-in (free) |
| **Total (est.)** | **~$68-168/mo** | **~$40-49/mo** |

**Notes:**
- AWS and Vercel costs increase with traffic
- CDTIA compliance cost (legal filing, ongoing maintenance) not included -- estimated $2,000-5,000 one-time + $500-1,000/year for a Vietnamese startup

### 5.1 Cost at Scale

| Scale | AWS | Vercel |
|-------|-----|--------|
| Stage 0 (1 op, ~200 book/day) | ~$68-168/mo | ~$40-49/mo |
| Stage 1 (10-30 ops, ~2K book/day) | ~$300-600/mo (RDS Multi-AZ + 2x EC2) | ~$200-400/mo (Pro + bandwidth) |
| Stage 2 (100+ ops, ~20K book/day) | ~$1,000-3,000/mo (EKS + RDS + ElastiCache) | ~$500-2,000/mo (Enterprise) |

---

## 6. Risk Assessment by Provider

| Risk | AWS | Vercel |
|------|-----|--------|
| **CDTIA obligation** | Yes (Singapore) | Yes (Singapore) |
| **Vendor lock-in** | Medium (RDS, ECS APIs) | High (serverless, cron, Blob) |
| **Pricing transparency** | High (public calculator) | High (public pricing) |
| **Managed service maturity** | High (decade+ track record) | High (Next.js native) |
| **Vietnam DC availability** | None (nearest: Singapore) | None (nearest: Singapore) |
| **DevOps burden** | Medium-High (IAM, VPC, SG) | None (zero-ops) |
| **Scaling flexibility** | Automated (ASG, Fargate) | Automated (serverless) |
| **Disaster recovery** | Automated (Multi-AZ, snapshots) | Automated (Vercel + DB provider) |
| **Team familiarity** | Low-Medium (AWS learning curve) | High (already deployed) |

---

## 7. WAF & DDoS Protection

| Option | Price | Capability |
|--------|-------|-----------|
| **Cloudflare WAF (Pro tier)** | $20/mo | OWASP Top 10, managed rules, DDoS protection, bot management |
| AWS WAF | Usage-based | OWASP Top 10, custom rules |

**Choice:** Cloudflare WAF (Pro) for Stage 0-1.

**Architecture:**
```
Internet -> Cloudflare (WAF + CDN + DDoS) -> Vercel (origin)
```

---

## 8. S3-Compatible Object Storage -- Provider Portability

The `@aws-sdk/client-s3` works with any S3-compatible endpoint via a custom endpoint + `forcePathStyle: true`.

### 8.1 SDK Configuration Pattern

```typescript
import { S3Client } from '@aws-sdk/client-s3';

const s3 = new S3Client({
  region: process.env.STORAGE_REGION ?? 'ap-southeast-1',
  // STORAGE_ENDPOINT present -> S3-compatible (R2, MinIO)
  // STORAGE_ENDPOINT absent  -> real AWS S3 (default endpoint)
  ...(process.env.STORAGE_ENDPOINT ? { endpoint: process.env.STORAGE_ENDPOINT } : {}),
  credentials: {
    accessKeyId: process.env.STORAGE_ACCESS_KEY!,
    secretAccessKey: process.env.STORAGE_SECRET_KEY!,
  },
  // REQUIRED for S3-compatible endpoints (path-style: endpoint/bucket/key)
  // AWS S3 uses virtual-hosted style (bucket.endpoint/key)
  forcePathStyle: !!process.env.STORAGE_ENDPOINT,
});
```

### 8.2 Provider Migration Table

| Provider | `STORAGE_ENDPOINT` | `forcePathStyle` | Notes |
|----------|-------------------|-----------------|-------|
| AWS S3 | absent (SDK default) | `false` | Virtual-hosted style |
| Cloudflare R2 | `https://<acct>.r2.cloudflarestorage.com` | `true` | S3-compatible; no egress fees |
| MinIO (local dev) | `http://localhost:9000` | `true` | Docker container for CI/dev |
| Vercel Blob | N/A -- different SDK (`@vercel/blob`) | N/A | NOT S3-compatible; requires separate adapter if migrating to Vercel storage |

---

## 9. Decision Log

| # | Decision | Date | Rationale |
|---|----------|------|-----------|
| P2 | Vercel Pro sin1 as primary production host | 2026-06-21 | Cost savings (~$200-400/mo), zero ops; CDTIA filing accepted |
| P3 | Provider-agnostic deployment contract | 2026-06-19 | Prevents vendor lock-in; migration = config change |

---

## See Also

- [SI-006 Deployment Config](../../scaffolding-infra/SI-006-deployment-config/) -- deployment contract implementation, staged evolution path
