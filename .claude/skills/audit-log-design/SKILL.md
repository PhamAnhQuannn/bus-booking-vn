---
name: audit-log-design
description: Tamper-evident, append-only audit log of every privileged action for SOC2 + incident forensics + customer requests. Outputs to `docs/design/audit-log.md` + `lib/audit.ts`. Reads `/project-classify` to skip XS. Use when user says "audit log", "audit trail", "who did what when", "tamper-evident", "SOC2 logs", "/audit-log-design", or before enterprise/compliance sale.
output_size:
  XS: skip
  S: 1h
  M: 4h
  L: 8h
  XL: 8h
---

# /audit-log-design — Tamper-Evident Audit Trail

## Why you'd care

App logs answer "what happened"; an audit log answers "who did what to whom, and prove no one rewrote the record." Without it, SOC2 stalls, HIPAA fails, every enterprise procurement bounces, and forensics during an incident reads as "we don't know."

Invoke as `/audit-log-design`. Logs answer "what happened". Audit log answers "who did what, to whom, when, and prove it wasn't tampered with". Required by SOC2, HIPAA, every enterprise contract.

## Pre-flight
1. Read `docs/classify/<project>.md`. XS → SKIP.
2. RBAC model exists (see `/rbac-model`); audit needs actor identity.
3. Storage decided: append-only table OR external service (Datadog, Cribl, AWS QLDB, Vanta).

## Inputs
- List of audit-worthy actions (privileged writes, auth events, admin ops, exports)
- Retention requirement (SOC2: 1yr min; HIPAA: 6yr; finance: 7yr)
- Tamper-evidence requirement (hash-chain in DB / external WORM / blockchain anchoring)
- Customer access requirement (do customers view their tenant's audit log?)

## Process

1. **What to log** — bias toward more, but with rules:

   | Event class | Log? | Examples |
   |---|:--:|---|
   | Auth | YES | login, logout, MFA enroll/disable, password change, SSO link |
   | Authz changes | YES | role assignment, permission grant/revoke, API key issue/revoke |
   | Privileged writes | YES | user delete, billing change, settings update, data export |
   | Reads of sensitive data | YES (PHI/PII) | viewing customer SSN, downloading PHI report |
   | Bulk operations | YES | bulk delete, mass export, admin impersonation start/stop |
   | Failed authz attempts | YES | 403s, denied actions (security signal) |
   | Routine reads | NO | feed scrolling, list views (too noisy) |
   | App errors / debug | NO | use regular logs |

2. **Event schema** — fixed shape, no free-form payloads:
   ```ts
   type AuditEvent = {
     id: string              // UUIDv7 (time-sortable)
     ts: string              // ISO-8601 UTC
     actor: {
       type: 'user' | 'system' | 'api-key' | 'support-impersonating'
       id: string            // user.id / key.id / 'system'
       impersonator_id?: string  // when support is acting as user
     }
     tenant_id: string       // org scope
     action: string          // dotted verb: 'user.delete', 'invoice.refund'
     target: {
       type: string          // 'user' / 'invoice' / 'settings'
       id: string
     }
     outcome: 'success' | 'denied' | 'error'
     metadata: Record<string, string|number|boolean>  // small, structured
     ip: string
     user_agent?: string
     request_id?: string     // correlate with logs
     prev_hash: string       // hash chain
     hash: string            // sha256(prev_hash + serialize(event))
   }
   ```

3. **Tamper-evidence via hash chain**:
   - Each event includes `prev_hash` = hash of previous event in the same tenant chain
   - `hash` = `sha256(prev_hash + canonicalize(event_without_hash))`
   - Verifier walks chain, recomputes, fails on mismatch
   - Anchor periodically: publish `latest_hash` per tenant per day to a WORM store (S3 Object Lock, transparency log) — auditor proves no historical edits

4. **Storage** — append-only, no UPDATE/DELETE:

   | Option | Pros | Cons | Use when |
   |---|---|---|---|
   | Dedicated `audit_events` Postgres table | simple, same DB | DB admin can still tamper | small product, low compliance |
   | Append-only DB (AWS QLDB, Immudb) | built-in ledger | extra system | regulated industries |
   | External SIEM (Datadog, Splunk) | turnkey retention + query | $$$, vendor dep | SOC2 fastest path |
   | DB + S3 Object Lock daily export | cheap belt-and-suspenders | restore complexity | high compliance |

   For Postgres: `CREATE TABLE audit_events (... )` + revoke UPDATE/DELETE from app role; only `INSERT` and `SELECT`.

5. **`lib/audit.ts` scaffold**:
   ```ts
   export async function audit(input: {
     actor: AuditActor; action: string;
     target: { type: string; id: string };
     outcome: 'success'|'denied'|'error';
     metadata?: Record<string, any>;
     ctx: { tenantId: string; ip: string; userAgent?: string; requestId?: string };
   }) {
     const prev = await db.auditEvents.findFirst({
       where: { tenant_id: input.ctx.tenantId },
       orderBy: { ts: 'desc' }
     })
     const event = {
       id: uuidv7(),
       ts: new Date().toISOString(),
       ...input,
       tenant_id: input.ctx.tenantId,
       prev_hash: prev?.hash ?? '0'.repeat(64),
     }
     event.hash = sha256(event.prev_hash + canonicalize(event))
     await db.auditEvents.create({ data: event })
   }
   ```
   Wrap as a middleware/decorator so privileged service methods auto-emit.

6. **Retention + archival**:

   | Class | Retention | Where |
   |---|---|---|
   | Auth events | 1 year hot, 6 years cold | hot: DB; cold: S3 Glacier |
   | Privileged writes | 7 years | DB → S3 Object Lock after 1yr |
   | Sensitive reads | 6 years (HIPAA) | as above |
   | Failed authz | 1 year | DB only |

   Daily job exports >N-day events to S3 Object Lock (immutable), then prunes from hot DB.

7. **Customer-facing access**:
   - Endpoint: `GET /api/v1/audit?since=...&action=...` — tenant-scoped, RBAC `audit:read`
   - Pagination by cursor (event.id is UUIDv7, sortable)
   - Export as CSV/JSON for compliance teams
   - Never expose `prev_hash` / `hash` unless you offer chain verification

8. **Anti-patterns**:
   - Logging into the same DB write the event records — recursive
   - Free-form `details: string` payloads — unqueryable
   - App user has UPDATE/DELETE on audit table — not tamper-evident
   - No tenant scope — cross-tenant audit leakage
   - Logging passwords / tokens / SSNs in metadata — audit log becomes PII risk
   - Audit failures swallowed — silent loss; treat audit-write failure as request failure

## Output

Write `docs/design/audit-log.md`:

```markdown
# Audit Log — <project>
**Date:** <YYYY-MM-DD> | **Owner:** <security/platform team>

## Logged events
- Auth: login/logout/mfa/sso-link
- Authz: role changes, key issue/revoke
- Privileged writes: user.delete, billing.update, invoice.refund, settings.*
- Sensitive reads: phi.view, export.*
- Failed authz: 403s
- Impersonation start/stop

## Schema
Fixed; see lib/audit.ts. Hash-chained per tenant.

## Tamper-evidence
- Per-tenant hash chain (prev_hash + event → hash)
- Daily anchor of `latest_hash` to S3 Object Lock
- Verifier script: scripts/audit-verify.ts

## Storage
- Postgres `audit_events` (INSERT + SELECT only)
- Daily export >365d to S3 Object Lock
- Retention: 1yr hot / 6-7yr cold

## Access
- API: GET /api/v1/audit (RBAC audit:read)
- Export: CSV / JSON
- Customer trust portal links to instructions

## Anti-leak
- No passwords / tokens / SSNs in metadata
- PII fields hashed if logged at all
- Audit failure = request failure (no silent loss)
```

Write `lib/audit.ts` with the scaffold from Process #5.

## Verification
- App DB role has no UPDATE/DELETE on `audit_events`.
- Every privileged service method calls `audit()`.
- Hash chain verified by external script weekly.
- Daily anchor lands in S3 Object Lock.
- Retention job tested.
- Audit-write failure aborts the request (not swallowed).
- No secrets/PII in metadata fields.
