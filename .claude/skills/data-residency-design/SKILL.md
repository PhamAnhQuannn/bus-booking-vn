---
name: data-residency-design
description: Per-tenant data region pinning (EU/US/AU) so customer data stays in the legal jurisdiction they signed for. Outputs to `docs/design/data-residency.md`. Reads `/project-classify` to skip XS/S. Use when user says "data residency", "data sovereignty", "GDPR region", "EU data stays in EU", "regional pinning", "/data-residency-design", or before first EU/regulated enterprise sale.
output_size:
  XS: skip
  S: skip
  M: 8h
  L: 8h
  XL: 8h
---

# /data-residency-design — Per-Tenant Region Pinning

## Why you'd care

The first EU enterprise prospect's procurement team will ask "where is our data physically stored?" — and "currently us-east-1 but we could maybe move it" loses the deal in one sentence. Retrofitting per-tenant region pinning onto a single-region system means simultaneously re-architecting auth routing, primary storage, replicas, backups, and search indexes — typically a 6-9 month engineering project that blocks shipping anything else. Designing the region key into the tenant table at inception costs an afternoon.

Invoke as `/data-residency-design`. EU buyers, healthcare buyers, gov buyers — all require "data stays in <region>". Bolting on later means re-architecting routing, storage, and backups simultaneously.

## Pre-flight
1. Read `docs/classify/<project>.md`. XS/S → SKIP (cost too high for early stage).
2. Tenant model exists; tenant config table writable.
3. Cloud provider supports multi-region (AWS / GCP / Azure with regional service variants).

## Inputs
- Target regions at launch (EU + US is the common minimum)
- Regulatory regime per region (GDPR, UK GDPR, Australian Privacy Act, PIPEDA, LGPD)
- Cross-region admin/support model (can US support read EU customer data?)
- Latency budget (regional pinning increases round-trips for global users)

## Process

1. **Region scope** — what gets pinned, what doesn't:

   | Data class | Pinned? | Notes |
   |---|:--:|---|
   | Tenant primary data (rows, blobs) | YES | the legal core |
   | Backups + DR replicas | YES | same region or in-jurisdiction only |
   | Audit logs | YES | tenant-scoped |
   | Analytics aggregates (anonymized) | NO | cross-region OK if no PII |
   | Auth identity (email, hashed password) | optional | EU sometimes requires |
   | Billing data | NO (usually) | global Stripe; document this carve-out |
   | Operational telemetry (Sentry, DD) | scrubbed | no PII or pin telemetry stack too |

2. **Region pick table**:

   | Region tag | Cloud regions | Compliance | Notes |
   |---|---|---|---|
   | `eu` | aws-eu-west-1 / aws-eu-central-1 | GDPR, Schrems II | exclude data flows to US |
   | `us` | aws-us-east-1 / aws-us-west-2 | SOC2, CCPA | default |
   | `uk` | aws-eu-west-2 | UK GDPR | separate from EU post-Brexit |
   | `au` | aws-ap-southeast-2 | Australian Privacy Act | gov customers often require |
   | `ca` | aws-ca-central-1 | PIPEDA | finance/health |

   Start with `eu` + `us`. Add others only on signed-contract demand.

3. **Architecture pattern** — regional cells, shared control plane:
   - Global control plane: tenant directory (`tenant_id → region`), billing, marketing site
   - Regional data plane: full app stack per region (app servers, DB, blob storage, queues, search)
   - Edge router: maps request → tenant → region; redirects/proxies cross-region
   - One DNS per region (`eu.app.com`, `us.app.com`) OR single hostname with edge routing

4. **Request routing** — every request resolved to region:
   ```ts
   // edge middleware
   const tenantId = extractTenantFromHost(req) ?? extractTenantFromJWT(req)
   const region = await tenantDirectory.lookup(tenantId)  // cached
   if (region !== CURRENT_REGION) {
     return redirect(`https://${region}.app.com${req.url}`, 307)
   }
   ```
   - Tenant directory is the only globally-replicated table; everything else stays regional.
   - Cache aggressively (TTL 5min); invalidate on tenant region change (rare).
   - Login flow: collect email → look up region → redirect before password entry.

5. **Data plane isolation**:
   - Each region: own DB cluster, own object storage bucket, own queues
   - No cross-region replication of tenant data (replicas stay in-region)
   - Backups stored in same region OR explicitly-jurisdictionally-equivalent (e.g., EU → EU-elsewhere)
   - Encryption keys per region (KMS regional keys; no cross-region key access)

6. **Cross-region admin/support** — controlled exception:
   - Support tooling cannot bulk-read across regions
   - Per-incident "break-glass" read: admin requests access → tenant approves OR contractual SLA grants → audit-logged with reason + TTL
   - Cross-region writes prohibited; admin actions execute against tenant's home region
   - Document in DPA: "EU customers' data is read by US support only with explicit per-incident approval"

7. **Tenant onboarding** — region picked at signup, immutable:
   - Signup form: "Where is your data stored?" → eu / us / au
   - Default by IP geolocation (suggest, don't force)
   - Region stored in tenant config; changing requires data-migration runbook (expensive, rare)
   - Document SLA: "Region change requires 30-day notice + migration window"

8. **Data export + deletion** — region-bounded:
   - Export endpoint runs in tenant's region; returns regional URL only
   - Right-to-deletion (GDPR Art 17): regional job deletes rows + scrubs backups within retention SLA
   - No "global delete" — each region has its own deletion job

9. **Anti-patterns**:
   - Single-region DB with "tenant_id has a region column" — data physically in wrong place
   - Cross-region read replicas of tenant data — defeats the pinning
   - Centralized search index across regions — leaks tenant data to wrong jurisdiction
   - Sentry / Datadog ingesting PII from all regions to US — separate regional telemetry or scrub
   - Support tools read all regions by default — incident waiting

## Output

Write `docs/design/data-residency.md`:

```markdown
# Data Residency — <project>
**Date:** <YYYY-MM-DD> | **Owner:** <platform team>

## Regions
- `us` (aws-us-east-1) — default
- `eu` (aws-eu-west-1) — GDPR pinning
- `au` (aws-ap-southeast-2) — on demand

## Pinned data
- Tenant rows, blobs, backups, audit logs, search indexes
- Carve-outs: billing (Stripe global), anonymized analytics, marketing site

## Architecture
- Global control plane: tenant directory + billing
- Regional data plane: DB + storage + queues + search per region
- Edge routing: tenant → region lookup → redirect/proxy

## Cross-region access
- Default: deny
- Break-glass support read: per-incident approval, audit-logged, TTL ≤ 4h
- No cross-region writes

## Tenant config
- Region chosen at signup (default by IP)
- Immutable without migration runbook (30d notice)
- `tenants.region` is source of truth

## Backups
- In-region S3 with Object Lock
- DR: in-jurisdiction secondary region only

## Telemetry
- Sentry / Datadog: regional projects per region
- No PII in telemetry; verified by scrubber

## DPA language
"Customer data designated as EU resides exclusively within EU member states.
US-based support may read on per-incident approval, fully audit-logged."
```

## Verification
- Tenant directory maps tenant → region; cached at edge.
- Each region has own DB, storage, queues, search, telemetry.
- No cross-region tenant data replication.
- Support break-glass requires per-incident approval + audit entry.
- Backups in-region with Object Lock.
- Test: EU tenant request to US endpoint → 307 redirect to EU.
- DPA reflects actual technical posture.
