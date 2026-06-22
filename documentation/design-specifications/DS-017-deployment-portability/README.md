# DS-017 -- Deployment Portability Design

## 1. Overview

This document defines the provider-agnostic deployment architecture for the BusBooking platform. The primary production host is Vercel Pro sin1 + Neon + Upstash (ADR-020 D11). FPT Cloud (Vietnam) is retained as a Docker self-hosted backup. The deployment contract (C1-C8) ensures migration between any provider is a DNS + connection-string change.

The core principle: **the application is a portable Docker artifact. The hosting provider is a configuration detail, not an architectural dependency.**

**Source ADRs.** ADR-020 (Deployment — D2 hosting pivot, D7 FPT Cloud, D8 deployment contract, D9 cron sidecar, D10 reverse proxy). ADR-012 (Background Jobs). ADR-007 (Observability).

**Cross-references.** DS-006 (Background Jobs) §2.1 for cron trigger modes. DS-003 (API Contract) §10 for cron endpoint table. ADR-020 D4 for env validation. `docker-compose.prod.yml` for reference stack. `vercel.json` for Vercel cron definitions.

**Regulatory driver.** PDPL 2025 Art. 25 (cross-border transfer), Decree 356/2025 (foreign cloud = cross-border), Decree 53/2022 (data localization). Vietnam-hosted infrastructure eliminates CDTIA filing requirement entirely.

---

## 2. Deployment Contract

Any hosting provider must supply the following infrastructure for the platform to operate. Meeting this contract guarantees zero application code changes on migration.

| # | Requirement | Specification | Env Vars |
|---|------------|---------------|----------|
| C1 | **Compute** | Linux (x86_64 or arm64) with Docker 24+ or Node.js 20+ | `PORT` (default 3000), `NODE_ENV=production` |
| C2 | **PostgreSQL** | 16+ with PgBouncer (transaction mode) | `DATABASE_URL` (pooled), `DIRECT_URL` (direct, migrations only) |
| C3 | **Redis** | 7+ (managed or self-hosted) OR in-memory for single-instance | `REDIS_PROVIDER` (`ioredis`\|`upstash`\|`memory`), `REDIS_URL` |
| C4 | **Cron trigger** | HTTP caller on schedule (sidecar, host crontab, or managed cron) | `CRON_SECRET` (shared secret for Bearer auth) |
| C5 | **TLS termination** | Reverse proxy with HTTPS (TLS 1.2+) | Nginx/Caddy config or cloud LB |
| C6 | **DNS** | A/CNAME record(s) pointing to reverse proxy | Domain registrar config |
| C7 | **Outbound HTTPS** | Unrestricted egress on port 443 | — |
| C8 | **Object storage** | S3-compatible API (deferred until Wave-9) | `STORAGE_ENDPOINT`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY` |

### 2.1 Contract Verification Checklist

Before declaring a new provider ready:

- [ ] `docker compose up` starts all services (app, PG, PgBouncer, Redis)
- [ ] `curl http://localhost:3000/api/health` returns 200
- [ ] Cron trigger fires and `JobRunLog` rows appear
- [ ] TLS certificate valid and HTTPS accessible
- [ ] DNS resolves to the correct IP
- [ ] PSP webhook callback URLs reachable from MoMo/VNPay test servers
- [ ] `pnpm prisma migrate deploy` succeeds via `DIRECT_URL`

---

## 3. Provider Mapping Matrix

How each potential provider satisfies the deployment contract:

> **2026-06-21 Update**: Vercel Pro + Neon + Upstash is now the primary production stack (ADR-020 D11). FPT Cloud is the backup Docker self-hosted option. The deployment contract (C1-C8) ensures migration between providers is a DNS + connection-string change.

| Contract | FPT Cloud (backup) | AWS | Vercel | Bare Metal / Other VPS |
|----------|-------------------|-----|--------|------------------------|
| C1 Compute | FPT Cloud Server (4vCPU/8GB Stage 0); Docker on Ubuntu; Autoscale available for VM cloning | EC2 (t3.medium) / ECS Fargate / EKS | Serverless Functions (no Docker) | Any Linux VPS (DigitalOcean, Linode, Hetzner) |
| C2 PostgreSQL | FPT Database Engine for PostgreSQL (managed, HA); DBProxy available (verify transaction mode); **PG16 unconfirmed — verify in Console** | RDS PostgreSQL | External: Neon or Supabase | Self-hosted PG 16 + PgBouncer in Docker |
| C3 Redis | FPT Database Engine for Redis (managed); **Redis 7 unconfirmed — verify in Console** | ElastiCache for Redis | Upstash (overseas — needs CDTIA) | Self-hosted Redis 7 in Docker |
| C4 Cron | Supercronic sidecar container | EventBridge + Lambda / ECS Scheduled Task | Vercel Cron (`vercel.json`) | Supercronic sidecar / Linux crontab |
| C5 TLS | Nginx + Let's Encrypt on VPS; or Cloudflare Origin CA | ACM + ALB (free managed certs) | Built-in (automatic) | Nginx/Caddy + Let's Encrypt |
| C6 DNS | Cloudflare DNS (FPT has no managed DNS) | Route 53 | Vercel DNS (built-in) | Cloudflare / registrar DNS |
| C7 Egress | Unrestricted (FPT network) | Unrestricted (security group config) | Unrestricted | Unrestricted |
| C8 Storage | FPT Object Storage (MinIO-based, S3-compat, `forcePathStyle: true` required, HN+HCM) | S3 | Vercel Blob / S3 | MinIO (self-hosted S3-compat) |
| WAF | Cloudflare WAF ($20/mo); FPT WAF ($316+/mo) deferred | AWS WAF | Built-in | Cloudflare WAF |
| Container Registry | GHCR (free); FPT CR ($640/mo) skipped | ECR | N/A | GHCR / self-hosted Harbor |
| IaC | Terraform `fpt-corp/fptcloud` (v0.3.51) | Terraform `hashicorp/aws` | `vercel/vercel` + vercel.json | Terraform / Ansible |
| Secrets | Env vars + Zod validation (no FPT KMS) | Secrets Manager / SSM | Encrypted env vars | Env vars / Vault |

### 3.1 CDTIA Impact by Provider

| Provider | Data Location | CDTIA Required? |
|----------|--------------|-----------------|
| **FPT Cloud** | Vietnam (Hanoi/HCMC) | **No** — all data domestic |
| AWS ap-southeast-1 | Singapore | **Yes** — cross-border transfer |
| Vercel sin1 | Singapore | **Yes** — cross-border transfer |
| Viettel IDC | Vietnam | **No** |
| CMC Cloud | Vietnam | **No** |

---

## 4. Reference Architecture — Docker Compose (Stage 0)

```
┌──────────────────────────────────────────────────────┐
│ FPT Cloud Server (4 vCPU / 8 GB RAM / 80 GB SSD)    │
│                                                       │
│  ┌─────────┐  ┌──────────┐  ┌────────────────────┐  │
│  │ Nginx   │  │ Cron     │  │ Next.js App        │  │
│  │ :443    │──│ Sidecar  │  │ :3000 (standalone) │  │
│  │ :80→301 │  │ (super-  │──│                    │  │
│  └────┬────┘  │  cronic) │  │ - Customer /       │  │
│       │       └──────────┘  │ - Operator /op/    │  │
│       │                     │ - Admin /admin/    │  │
│       └─────────────────────│ - Cron /api/cron/  │  │
│                             └────────┬───────────┘  │
│                                      │               │
│  ┌───────────┐  ┌───────────────┐    │               │
│  │ PgBouncer │  │ Redis 7       │    │               │
│  │ :6432     │──│ :6379         │────┘               │
│  └─────┬─────┘  └───────────────┘                    │
│        │                                              │
│  ┌─────┴─────┐  OR  ┌──────────────────────────┐    │
│  │ PG 16     │      │ FPT Managed PG + Redis   │    │
│  │ :5432     │      │ (external managed)        │    │
│  └───────────┘      └──────────────────────────┘    │
└──────────────────────────────────────────────────────┘
         ▲
         │ HTTPS
┌────────┴─────────┐
│ Cloudflare CDN   │
│ (DNS + edge      │
│  cache + DDoS)   │
└──────────────────┘
         ▲
         │
      Internet
```

**Two PostgreSQL options:**
- **Self-hosted** (in Docker Compose): PG 16 + PgBouncer containers on the same VPS. Cheapest. Single point of failure.
- **FPT Managed PG**: HA with auto-failover, automated backup. Higher cost but production-grade. `DATABASE_URL` points to FPT's managed endpoint; `DIRECT_URL` to direct connection for migrations.

**Recommendation for Stage 0**: Start with FPT Managed PG + FPT Managed Redis (outsource DB ops). If cost is prohibitive, fall back to self-hosted in Docker Compose with daily `pg_dump` backups to FPT Object Storage.

---

## 5. Cron Sidecar Specification

### 5.1 Image Selection

| Image | Description | Pros | Cons |
|-------|------------|------|------|
| **aptible/supercronic** ✅ | Purpose-built cron for containers | Proper signal handling; no syslog; stdout logging; crontab format; lightweight (~5MB) | No built-in HTTP retry |
| mcuadros/ofelia | Docker-native scheduler | Reads config from labels/file; Docker-aware | Heavier; label-based config harder to version-control |
| Custom (Alpine + curl + crond) | DIY cron container | Maximum control | Must handle signal propagation, logging, timezone |

**Choice**: `aptible/supercronic` — lightest, most battle-tested container cron replacement.

### 5.2 Crontab File

Single source of truth for self-hosted cron schedules. Must match `vercel.json` and DS-006 §4.1.

```crontab
# BusBooking cron jobs — must match vercel.json + DS-006 Job Catalog
# Auth: CRON_SECRET env var injected into container

# Hold & capacity management
* * * * *     curl -sf -H "Authorization: Bearer ${CRON_SECRET}" http://app:3000/api/cron/sweep-holds
* * * * *     curl -sf -H "Authorization: Bearer ${CRON_SECRET}" http://app:3000/api/cron/close-sales

# Trip lifecycle
0 1 * * *     curl -sf -H "Authorization: Bearer ${CRON_SECRET}" http://app:3000/api/cron/generate-trips
*/5 * * * *   curl -sf -H "Authorization: Bearer ${CRON_SECRET}" http://app:3000/api/cron/complete-trips

# Notifications & communications
* * * * *     curl -sf -H "Authorization: Bearer ${CRON_SECRET}" http://app:3000/api/cron/dispatch-notifications
*/15 * * * *  curl -sf -H "Authorization: Bearer ${CRON_SECRET}" http://app:3000/api/cron/send-reminders

# Financial
0 * * * *     curl -sf -H "Authorization: Bearer ${CRON_SECRET}" http://app:3000/api/cron/process-payouts
*/15 * * * *  curl -sf -H "Authorization: Bearer ${CRON_SECRET}" http://app:3000/api/cron/reconcile-payments

# Content generation
*/2 * * * *   curl -sf -H "Authorization: Bearer ${CRON_SECRET}" http://app:3000/api/cron/generate-ticket-pdfs

# Expiry & cleanup
0 * * * *     curl -sf -H "Authorization: Bearer ${CRON_SECRET}" http://app:3000/api/cron/charter-expiry
0 3 * * *     curl -sf -H "Authorization: Bearer ${CRON_SECRET}" http://app:3000/api/cron/retention
```

### 5.3 Docker Compose Addition

```yaml
# Added to docker-compose.prod.yml
cron:
  image: aptible/supercronic:latest
  restart: unless-stopped
  volumes:
    - ./deploy/crontab:/etc/supercronic/crontab:ro
  entrypoint: ["/usr/local/bin/supercronic", "/etc/supercronic/crontab"]
  environment:
    - CRON_SECRET=${CRON_SECRET}
  depends_on:
    app:
      condition: service_healthy
  networks:
    - internal
```

### 5.4 Health Monitoring

| Signal | Detection Method | Alert Level |
|--------|-----------------|-------------|
| Cron container down | Docker healthcheck / process monitor | P2 — cron jobs stop entirely |
| Missed cron run | `JobRunLog` gap query: `MAX(startedAt) < NOW() - 2x interval` per job | P4 — daily digest |
| Cron HTTP failure | `curl -sf` exit code logged by supercronic to stdout | P3 — review in log aggregator |
| App container unhealthy | `/api/health` returns non-200 | P1 — all traffic + cron affected |

### 5.5 Timezone

Supercronic uses the container's system timezone (`TZ` env var). Set `TZ=Asia/Ho_Chi_Minh` to match `generate-trips` schedule (daily 1 AM Vietnam time = `0 1 * * *` in VN timezone, currently `0 18 * * *` UTC in `vercel.json`).

**Important:** `vercel.json` schedules are in UTC. The sidecar crontab schedules should be in `Asia/Ho_Chi_Minh` with `TZ=Asia/Ho_Chi_Minh` set. Verify that daily jobs (generate-trips, retention) fire at the correct Vietnam local time.

---

## 6. Reverse Proxy Configuration

### 6.1 Decision: Nginx + Let's Encrypt

See ADR-020 D10 for the options table and rationale. Nginx chosen for Vietnam DevOps familiarity.

### 6.2 Reference Nginx Config

```nginx
# /etc/nginx/sites-available/busbooking
upstream nextjs {
    server 127.0.0.1:3000;
    keepalive 64;
}

server {
    listen 80;
    server_name busbooking.vn www.busbooking.vn;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name busbooking.vn www.busbooking.vn;

    ssl_certificate     /etc/letsencrypt/live/busbooking.vn/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/busbooking.vn/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    # Security headers
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;

    # Next.js static assets (immutable, long cache)
    location /_next/static/ {
        proxy_pass http://nextjs;
        proxy_cache_valid 200 365d;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # Health check (no logging)
    location = /api/health {
        proxy_pass http://nextjs;
        access_log off;
    }

    # Cron endpoints (internal only — block external access)
    location /api/cron/ {
        # Allow only from Docker internal network and localhost
        allow 127.0.0.1;
        allow 172.16.0.0/12;
        deny all;
        proxy_pass http://nextjs;
    }

    # All other routes
    location / {
        proxy_pass http://nextjs;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 6.3 SSL Certificate Strategy

| Strategy | When to Use | Auto-Renewal |
|----------|------------|-------------|
| **Let's Encrypt (certbot)** | Default for self-hosted | `certbot renew --nginx` cron (twice daily) |
| Cloudflare Origin CA | When using Cloudflare full-proxy mode | 15-year validity; no renewal needed |
| Custom CA cert | Enterprise / government compliance | Manual |

**Recommendation**: Let's Encrypt for initial setup. Evaluate Cloudflare Origin CA if full Cloudflare proxy mode is adopted (simpler, no renewal cron).

---

## 7. Migration Playbook

Step-by-step for switching from Provider A to Provider B.

### 7.1 Pre-Migration

1. Provision new compute, PG, and Redis on Provider B
2. Verify deployment contract checklist (§2.1) on Provider B
3. Set up reverse proxy + SSL on Provider B
4. Configure DNS with low TTL (300s) 48 hours before migration

### 7.2 Migration (Maintenance Window)

1. Set maintenance mode (optional: static maintenance page on Nginx)
2. `pg_dump` from Provider A PostgreSQL → `pg_restore` to Provider B PostgreSQL
3. Verify row counts and critical data integrity
4. Update `.env.production` on Provider B with new `DATABASE_URL`, `REDIS_URL`
5. `docker compose up -d` on Provider B
6. Verify `/api/health` returns 200
7. Run one cron job manually (`curl` sweep-holds) to verify cron sidecar
8. Switch DNS to Provider B IP
9. Monitor for 1 hour: check `JobRunLog`, error logs, PSP webhook delivery
10. Decommission Provider A after 48-hour DNS propagation buffer

### 7.3 Post-Migration

- Verify PSP webhook callback URLs point to new domain/IP (MoMo IPN URL, VNPay IPN URL)
- Update `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_BASE_URL` if domain changed
- Verify eSMS delivery (OTP flow)
- Run e2e smoke test against new deployment

### 7.4 Estimated Effort

| Task | Time |
|------|------|
| Provision infrastructure | 1-2 hours |
| Database migration | 30-60 minutes (depends on size) |
| Config + deploy | 30 minutes |
| Verification + DNS switch | 30 minutes |
| **Total** | **2-4 hours** |

### 7.5 Rollback

- DNS revert to Provider A IP (TTL-dependent, 5-60 minutes)
- Provider A kept running during 48-hour buffer
- No data written to Provider B during DNS propagation needs back-migration (read-only period optional)

---

## 8. Cost Comparison Matrix

Estimates for Stage 0 (~200 bookings/day, 1 operator, single VPS).

> **2026-06-21 Update**: With the pivot to Vercel Pro + Neon + Upstash as primary (ADR-020 D11), see SI-006 §11 for the current cost breakdown. The Vercel column below remains accurate; FPT Cloud column applies to the backup self-hosted option.

| Component | FPT Cloud (est.) | AWS (Singapore) | Vercel Pro |
|-----------|-----------------|-----------------|------------|
| Compute | ~2-4M VND/mo ($80-160) | t3.medium: ~$30/mo | $20/mo (Pro plan) |
| PostgreSQL | ~2-3M VND/mo ($80-120) managed | RDS db.t3.micro: ~$15/mo | Neon Free / $19/mo Pro |
| Redis | ~1-2M VND/mo ($40-80) managed | ElastiCache t3.micro: ~$13/mo | Upstash Free / $10/mo Pro |
| Object Storage | 3.5M VND/mo ($140) for 2TB | S3: ~$5/mo for 50GB | Vercel Blob: $0/mo (1GB free) |
| CDN/DNS | Cloudflare Free | CloudFront: ~$5/mo | Built-in (free) |
| SSL | Let's Encrypt (free) | ACM (free) | Built-in (free) |
| **Total (est.)** | **~8.5-13M VND/mo ($340-520)** | **~$68-168/mo** | **~$40-49/mo** |

**Notes:**
- FPT Cloud pricing is estimated from market rates — actual requires sales quotation
- FPT Object Storage is the only service with published pricing (2TB = 3.5M VND/mo)
- AWS and Vercel costs increase with traffic; FPT VPS is fixed-cost
- CDTIA compliance cost (legal filing, ongoing maintenance) not included in AWS/Vercel — estimated $2,000-5,000 one-time + $500-1,000/year for a Vietnamese startup

### 8.1 Cost at Scale

| Scale | FPT Cloud | AWS | Vercel |
|-------|-----------|-----|--------|
| Stage 0 (1 op, ~200 book/day) | ~$340-520/mo | ~$68-168/mo | ~$40-49/mo |
| Stage 1 (10-30 ops, ~2K book/day) | ~$800-1,500/mo (2 VMs + managed DB HA) | ~$300-600/mo (RDS Multi-AZ + 2x EC2) | ~$200-400/mo (Pro + bandwidth) |
| Stage 2 (100+ ops, ~20K book/day) | ~$2,000-4,000/mo (FKE K8s) | ~$1,000-3,000/mo (EKS + RDS + ElastiCache) | ~$500-2,000/mo (Enterprise) |

FPT Cloud is more expensive at Stage 0 but competitive at Stage 1-2 due to fixed-cost VPS vs usage-based serverless. The CDTIA elimination value exceeds the cost difference at all stages.

---

## 9. Risk Assessment by Provider

| Risk | FPT Cloud | AWS | Vercel |
|------|-----------|-----|--------|
| **CDTIA obligation** | None | Yes (Singapore) | Yes (Singapore) |
| **Vendor lock-in** | Low (Docker portable) | Medium (RDS, ECS APIs) | High (serverless, cron, Blob) |
| **Pricing transparency** | Low (sales quote only) | High (public calculator) | High (public pricing) |
| **Managed service maturity** | Medium (newer than AWS) | High (decade+ track record) | High (Next.js native) |
| **Vietnam DC availability** | 4 Tier III DCs (HN + HCM) | None (nearest: Singapore) | None (nearest: Singapore) |
| **DevOps burden** | Medium (Docker + Nginx) | Medium-High (IAM, VPC, SG) | None (zero-ops) |
| **Scaling flexibility** | Manual (VM resize / add nodes) | Automated (ASG, Fargate) | Automated (serverless) |
| **Disaster recovery** | Manual + FPT managed backups | Automated (Multi-AZ, snapshots) | Automated (Vercel + DB provider) |
| **Team familiarity** | Medium (Docker knowledge) | Low-Medium (AWS learning curve) | High (already deployed) |

### 9.1 FPT Cloud-Specific Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Pricing significantly higher than estimated | MEDIUM | MEDIUM | Get sales quote before committing; deployment contract ensures easy migration to Viettel/CMC/bare-metal |
| Managed PG/Redis service outage | LOW | HIGH | Automated backups; failover to self-hosted Docker PG + Redis on same VPS as emergency fallback |
| FPT Cloud service discontinuation | LOW | HIGH | Provider-agnostic Docker contract; data export via `pg_dump`; 30-day migration to any alternative |
| Network latency from FPT DC to Cloudflare edge | LOW | LOW | Cloudflare has Vietnamese PoPs; origin latency dominated by DB query time, not network |
| PG16/Redis 7 not available on FPT | LOW | HIGH | Engine versions unconfirmed publicly; verify in Console before committing. If unavailable, self-host PG16/Redis 7 in Docker on FPT VM |
| DBProxy not supporting transaction mode | MEDIUM | MEDIUM | Critical for Prisma; if FPT DBProxy only supports session mode, self-host PgBouncer in Docker with `pool_mode=transaction` |
| No automated provisioning for WAF/monitoring | LOW | LOW | Terraform covers core infra; WAF (Cloudflare) and monitoring (BetterStack/Sentry) are external; FPT portal-only services are secondary |
| Container images on GHCR (overseas) | LOW | LOW | Deploy-time pull only, no user-facing latency; images contain no PII; self-host Harbor on FPT VM if needed |
| No secrets management service | MEDIUM | MEDIUM | Env vars + Zod boot validation; self-host HashiCorp Vault post-Series-A if investor diligence requires it |

---

---

## 10. Infrastructure-as-Code (Terraform)

### 10.1 FPT Cloud Terraform Provider

FPT Cloud has an official Terraform provider: `fpt-corp/fptcloud` (registry.terraform.io).

| Detail | Value |
|--------|-------|
| Provider | `fpt-corp/fptcloud` |
| Version | v0.3.51 (as of 2026-06-19) |
| Releases | 58 total, actively maintained |
| License | MPL-2.0 |
| Auth | `API_URL`, `REGION`, `TENANT_NAME`, `TOKEN` env vars |
| Requirements | Go >= 1.21, Terraform >= 1.0 |

**Supported resources:**

| Resource | Terraform Type |
|----------|---------------|
| VPC | `fptcloud_vpc` |
| Subnet | `fptcloud_subnet` |
| Security Group | `fptcloud_security_group`, `fptcloud_security_group_rule` |
| VM Instance | `fptcloud_instance` |
| Floating IP | `fptcloud_floating_ip`, `fptcloud_floating_ip_association` |
| Load Balancer | `fptcloud_load_balancer_v2` |
| Managed Database | `fptcloud_database` |
| Object Storage | `fptcloud_object_storage` |
| Managed K8s | `fptcloud_mfke` |
| SSH Key | `fptcloud_ssh` |
| VM Image | `fptcloud_image` |

**Gaps (portal-only):** WAF, Monitoring, Backup/DR, DNS — not yet in the Terraform provider.

**Recommendation:** Use Terraform from Day 1 for all core infrastructure. Portal-only services (WAF, monitoring) are secondary and can be documented manually. Migration to another provider = rewrite `fptcloud_*` resource types to equivalent provider resources (e.g., `aws_*`).

### 10.2 Migration IaC Strategy

| Provider | IaC Tool | Notes |
|----------|----------|-------|
| FPT Cloud | `fpt-corp/fptcloud` Terraform provider | OpenStack API underneath |
| AWS | `hashicorp/aws` Terraform provider | Mature, full coverage |
| Azure | `hashicorp/azurerm` Terraform provider | Mature, full coverage |
| Vercel | `vercel/vercel` Terraform provider + `vercel.json` | Limited — mostly deployment config |
| Viettel IDC | OpenStack Terraform provider (if API exposed) | Unconfirmed |

---

## 11. Container Registry Strategy

| Option | Price | Pros | Cons |
|--------|-------|------|------|
| FPT Container Registry | 16,000,000 VND/mo (~$640) | Vietnam-resident; FKE integration | Cost prohibitive for startup |
| **GitHub Container Registry (GHCR)** ✅ | Free (with GitHub) | Zero cost; already using GitHub; OCI-standard | Images transit international network on pull (deploy-time only, not user-facing) |
| Self-hosted Harbor on FPT VM | ~120-250 VND/hr (STANDARD-01 VM) | Vietnam-resident; full control | Operational overhead to maintain |
| Docker Hub | Free (public) / $5/mo (private) | Ubiquitous | Rate limits on free tier; overseas |

**Choice:** GHCR for Stage 0-1. Images are OCI-standard — portable to any registry. If Vietnam data residency is required for container images (unlikely — images contain no PII), self-host Harbor on a STANDARD-01 FPT VM.

---

## 12. WAF & DDoS Protection

| Option | Price | Capability |
|--------|-------|-----------|
| **Cloudflare WAF (Pro tier)** ✅ | $20/mo | OWASP Top 10, managed rules, DDoS protection, bot management |
| FPT Cloud WAF (CyRadar) | 7,900,000-16,000,000 VND/mo ($316-640) | OWASP Top 10, SQL injection, XSS, zero-day; dedicated per-tenant |
| Cloudflare Magic Transit (via FPT Cloud Hub) | Enterprise pricing | BGP-based L3/L4 DDoS protection |

**Choice:** Cloudflare WAF (Pro) for Stage 0-1. FPT is Cloudflare's sole authorized distributor in Vietnam/Laos/Cambodia — same edge network regardless of purchase channel.

**Architecture:**
```
Internet → Cloudflare (WAF + CDN + DDoS) → FPT Cloud Server (origin)
```

**FPT Cloud firewall config:** Accept traffic on ports 80/443 ONLY from Cloudflare IP ranges (published at `cloudflare.com/ips/`). Block all other inbound. Automate IP list update via cron.

**Evaluate FPT Cloud WAF at Stage 2** if: Cloudflare WAF misses Vietnam-specific attack patterns, or compliance audit requires WAF within Vietnamese infrastructure.

---

## 13. S3-Compatible Object Storage — Provider Portability

FPT Object Storage is MinIO-based. The `@aws-sdk/client-s3` works with a custom endpoint + `forcePathStyle: true`.

### 13.1 SDK Configuration Pattern

```typescript
import { S3Client } from '@aws-sdk/client-s3';

const s3 = new S3Client({
  region: process.env.STORAGE_REGION ?? 'ap-southeast-1',
  // STORAGE_ENDPOINT present → S3-compatible (FPT, R2, MinIO)
  // STORAGE_ENDPOINT absent  → real AWS S3 (default endpoint)
  ...(process.env.STORAGE_ENDPOINT ? { endpoint: process.env.STORAGE_ENDPOINT } : {}),
  credentials: {
    accessKeyId: process.env.STORAGE_ACCESS_KEY!,
    secretAccessKey: process.env.STORAGE_SECRET_KEY!,
  },
  // REQUIRED for MinIO-based endpoints (path-style: endpoint/bucket/key)
  // AWS S3 uses virtual-hosted style (bucket.endpoint/key)
  forcePathStyle: !!process.env.STORAGE_ENDPOINT,
});
```

### 13.2 Provider Migration Table

| Provider | `STORAGE_ENDPOINT` | `forcePathStyle` | Notes |
|----------|-------------------|-----------------|-------|
| FPT Object Storage | `https://hn01.vstorage.fptcloud.com` (verify in Console) | `true` | MinIO-based; 2TB = 3.5M VND/mo |
| AWS S3 | absent (SDK default) | `false` | Virtual-hosted style |
| Cloudflare R2 | `https://<acct>.r2.cloudflarestorage.com` | `true` | S3-compatible; no egress fees |
| MinIO (local dev) | `http://localhost:9000` | `true` | Docker container for CI/dev |
| Vercel Blob | N/A — different SDK (`@vercel/blob`) | N/A | NOT S3-compatible; requires separate adapter if migrating to Vercel storage |

---

## 14. Decision Log

| # | Decision | Date | Rationale |
|---|----------|------|-----------|
| P1 | FPT Cloud as primary host over Vercel/AWS | 2026-06-19 | CDTIA elimination decisive |
| P2 | Vercel Pro sin1 restored as primary; FPT Cloud backup | 2026-06-21 | Cost savings (~$200-400/mo), zero ops; CDTIA filing accepted |
| P3 | Provider-agnostic deployment contract | 2026-06-19 | Prevents vendor lock-in; migration = config change |
| P4 | Supercronic sidecar over host crontab or Ofelia | 2026-06-19 | Container-portable; proper signal handling; stdout logging |
| P5 | Nginx + Let's Encrypt over Caddy/Traefik | 2026-06-19 | Vietnam DevOps familiarity; battle-tested; widest documentation |
| P6 | Dual cron config (vercel.json + crontab) | 2026-06-19 | Retains Vercel for staging/preview while FPT runs production |
| P7 | Cloudflare CDN in front of FPT origin | 2026-06-19 | Edge caching + DDoS protection without CDTIA; Vietnamese PoPs |
| P8 | FPT Managed PG + Redis recommended over self-hosted | 2026-06-19 | Outsource DB ops; HA + automated backup; fall back to Docker self-hosted if cost prohibitive |
| P9 | Terraform (`fpt-corp/fptcloud`) from Day 1 | 2026-06-19 | IaC for reproducible infra; 25+ resource types; migration = rewrite TF resource types |
| P10 | GHCR over FPT Container Registry | 2026-06-19 | FPT CR costs 16M VND/mo ($640) — prohibitive; GHCR is free with GitHub |
| P10 | Cloudflare WAF over FPT Cloud WAF for Stage 0-1 | 2026-06-19 | $20/mo vs $316-640/mo; same Cloudflare edge network; re-evaluate at Stage 2 |
| P11 | S3 `forcePathStyle` for FPT Object Storage | 2026-06-19 | MinIO-based storage requires path-style addressing; env var controls the flag |

---

## See Also

- [SI-006 Deployment Config](../../scaffolding-infra/SI-006-deployment-config/) — deployment contract implementation, Docker Compose reference, cron sidecar, Nginx, staged evolution path
