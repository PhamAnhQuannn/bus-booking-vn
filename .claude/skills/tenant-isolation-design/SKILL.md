---
name: tenant-isolation-design
description: Multi-tenant isolation strategy (shared schema + RLS vs schema-per-tenant vs DB-per-tenant) so one tenant's bug can't read or break another's data. Outputs to `docs/design/tenant-isolation.md`. Reads `/project-classify` to skip XS. Use when user says "multi-tenant", "tenant isolation", "RLS", "row-level security", "noisy neighbor", "/tenant-isolation-design", or before second paying customer.
output_size:
  XS: skip
  S: 1h
  M: 8h
  L: 8h
  XL: 8h
---

# /tenant-isolation-design — Multi-Tenant Isolation

Invoke as `/tenant-isolation-design`. The worst SaaS bug is "customer A saw customer B's data". Pick isolation model up front; retrofitting after launch is brutal.

## Why you'd care

One tenant reading another tenant's data is a single bug from being the breach disclosure that ends your enterprise pipeline. Picking RLS vs schema-per-tenant vs DB-per-tenant before customer two is what keeps the blast radius bounded.

## Pre-flight
1. Read `docs/classify/<project>.md`. XS → SKIP.
2. Tenant exists in data model (`org` / `tenant` table).
3. Anticipated customer count + sensitivity (B2C vs B2B vs regulated).

## Inputs
- Tenant count (10s, 100s, 1000s, 10,000+)
- Data sensitivity (logs vs PHI vs financial)
- Per-tenant customization (schema variants? extensions? configs?)
- Compliance regime (HIPAA / PCI / FedRAMP requires stronger isolation)

## Process

1. **Isolation model pick** — three primary patterns:

   | Model | Isolation | Cost / tenant | Ops complexity | Pick when |
   |---|---|---|---|---|
   | Shared schema + tenant_id | Logical only | very low | low | startup, <1000 tenants, low-med sensitivity |
   | Schema-per-tenant (same DB) | Stronger (separate namespace) | low | medium | mid-stage, 100-5000 tenants, want per-tenant migrations |
   | DB-per-tenant | Strong (separate DB) | high | high | regulated, BYO-DB requests, large enterprise |
   | Cluster-per-tenant | Strongest (separate VPC) | very high | very high | gov / defense / dedicated SLA |

   Default for SaaS: shared schema + tenant_id + RLS. Escalate per-tenant only for enterprise contracts that demand it.

2. **Shared schema + RLS** — the default recipe:
   - Every multi-tenant table has `tenant_id uuid NOT NULL` column
   - Foreign keys include `tenant_id` (composite) where joins cross tables
   - Postgres Row-Level Security (RLS) enabled per table
   - Connection sets `SET LOCAL app.current_tenant = <id>` at request start

   ```sql
   ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
   CREATE POLICY tenant_isolation ON orders
     USING (tenant_id = current_setting('app.current_tenant')::uuid);
   ```

   RLS is defense-in-depth. App must still filter by tenant_id explicitly — RLS is the seatbelt.

3. **Connection-pool tenancy** — set context per request:
   ```ts
   await db.$transaction(async (tx) => {
     await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant = '${tenantId}'`)
     return await handler(tx)
   })
   ```
   - Use `SET LOCAL` (per-tx) not `SET` (per-connection) — connections pool across tenants
   - Reject queries when `app.current_tenant` is unset (RLS will return zero rows; better: fail loud)
   - Tests verify cross-tenant query returns zero rows

4. **Tenant-id propagation** — every request carries it:
   - Source: `req.user.tenant_id` (from session / JWT claim)
   - Pass through: middleware sets `ctx.tenantId`, every DB call uses it
   - Background jobs: enqueue with `tenant_id`, worker sets context on dequeue
   - Cross-tenant ops (admin tools): explicit "tenant=*" with extra auth

5. **Schema-per-tenant** — when RLS isn't enough:
   - `tenant_<uuid>` schemas, identical DDL
   - Connection sets `SET search_path = tenant_<uuid>, public`
   - Migrations: apply to all schemas via script (slow at scale)
   - Pros: one bad SQL can't cross-tenant; per-tenant restore easy
   - Cons: schema count limits (Postgres soft cap ~10k); migration time

6. **DB-per-tenant** — enterprise / regulated:
   - One Postgres instance OR one cluster per tenant
   - Provision via Terraform on signup
   - Per-tenant connection string in tenant config table (encrypted)
   - Pros: total isolation, BYO region/cloud, per-tenant DR
   - Cons: 10× cost, 10× ops, slow migrations, hard analytics across tenants

7. **Noisy-neighbor mitigation** — even with shared infra:
   - Per-tenant rate limits (see `/rate-limit-design`)
   - Per-tenant query timeouts (statement_timeout)
   - Per-tenant work-queue partitions (Kafka/SQS with tenant key)
   - Per-tenant connection budget (PgBouncer max_user_connections)
   - Per-tenant CPU/IO cgroups if running compute (k8s ResourceQuota)

8. **Cross-tenant features done right**:

   | Feature | How |
   |---|---|
   | Admin "view-as-tenant" | Impersonation with audit log entry (see /audit-log-design) |
   | Cross-tenant analytics | Separate read-replica / OLAP store, no joins back |
   | Shared lookup data | `public` schema or single shared table, read-only to tenants |
   | Tenant deletion | Hard-delete tenant_id rows + soft tombstone row (compliance) |

9. **Anti-patterns**:
   - Tenant_id in WHERE only (no RLS) — one missing WHERE = leak
   - JWT contains tenant_id but app doesn't verify against URL `/orgs/:id` — IDOR
   - Tests pass without tenant context set — masks bugs
   - Migration touches one tenant's schema only — drift across tenants
   - Shared cache key without tenant prefix — cache poisoning across tenants
   - DB user has BYPASSRLS — defeats RLS

## Output

Write `docs/design/tenant-isolation.md`:

```markdown
# Tenant Isolation — <project>
**Date:** <YYYY-MM-DD> | **Owner:** <platform team>

## Model
- Primary: shared schema + tenant_id + RLS
- Reserved: schema-per-tenant on enterprise plan (BYO-isolation tier)

## Schema rules
- Every multi-tenant table has `tenant_id uuid NOT NULL`
- Composite indexes lead with `tenant_id`
- RLS enabled with `current_setting('app.current_tenant')` policy

## Request flow
1. Auth → req.user.tenant_id
2. Middleware → ctx.tenantId
3. Service → db.transaction(set local) → handler
4. RLS policy + explicit WHERE both enforce

## Cache keys
- All keys prefixed with `<tenant_id>:<...>`
- No shared keys for tenant-scoped data

## Background jobs
- Job payload includes tenant_id
- Worker sets context before processing
- Queues partitioned by tenant on hot tenants

## Noisy-neighbor
- Per-tenant rate limit (see rate-limit-<surface>.md)
- statement_timeout = 30s default, override per tenant
- Connection budget = 20 per tenant via PgBouncer

## Cross-tenant ops
- Admin impersonation logged
- Analytics in separate replica
- Tenant deletion: hard delete + compliance tombstone

## DB role
- `app_role`: NOT BYPASSRLS
- `migration_role`: BYPASSRLS (DDL only)
- Tests verify cross-tenant SELECT returns zero rows
```

## Verification
- RLS enabled on every multi-tenant table.
- App DB role does NOT have BYPASSRLS.
- `SET LOCAL` used (not `SET`) for tenant context.
- Cache keys all tenant-prefixed.
- Background jobs propagate tenant_id.
- Test: cross-tenant SELECT returns 0 rows (proves RLS).
- Migration touches all tenants (or all schemas) atomically.
