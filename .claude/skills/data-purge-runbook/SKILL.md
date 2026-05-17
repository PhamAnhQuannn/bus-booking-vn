---
name: data-purge-runbook
description: Hard-delete runbook for customer offboarding / account closure / regulatory purge (GDPR Art.17 erasure, CCPA delete, HIPAA decommission). Idempotent, audit-logged, FK-aware, backup-aware, certificate-of-destruction-ready. Use when "data purge", "hard delete", "account closure cleanup", "GDPR erasure", "right to be forgotten", "/data-purge-runbook".
output_size:
  XS: skip
  S: 1h
  M: 2h
  L: 4h
  XL: 6h
---

# /data-purge-runbook — Hard-Delete Runbook

## Why you'd care

Soft-delete plus leaky backups equals a compliance fine plus brand damage. A user lodges a GDPR Art.17 erasure request, the support engineer flips `deleted_at`, and six months later a regulator audit finds the row intact in the warehouse, the search index, the Stripe metadata, last week's pg_dump on S3, and the analytics export pipeline that mirrors prod to a third-party tool. That is a multi-jurisdiction reportable event, a 20× DPA fee, and a Twitter screenshot of the warehouse query.

A documented, dry-runnable purge plan turns a panic ticket into a 30-minute checklist. It enumerates every system holding the data, orders the delete topologically, gates on legal-hold, classifies retention exceptions, decides backup-redaction policy in advance, emits an audit-log entry, and produces a signed certificate of destruction. Idempotent re-run means an interrupted purge resumes cleanly.

Invoke as `/data-purge-runbook`. Outputs `docs/ops/data-purge-<scope>.md` plus a script stub at `scripts/purge-<scope>.<ext>`.

## When This Skill Applies

Triggers:
- "data purge", "hard delete", "purge runbook", "scrub user data"
- "account closure cleanup", "tenant offboarding purge", "workspace teardown"
- "GDPR Art.17", "right to be forgotten", "right to erasure", "RTBF"
- "CCPA delete", "CPRA delete", "DSAR delete"
- "HIPAA decommission", "PHI destruction", "patient record destruction"
- "breach remediation purge", "compromised-data scrub"
- "B2B contract termination data return / destruction"
- "/data-purge-runbook"

Fires when:
- A user, customer, or tenant submits an erasure / deletion request and the controller has authority to honor it.
- A B2B contract ends and the MSA / DPA mandates data return or destruction within N days.
- A breach investigation concludes that scoped data must be destroyed (e.g. exfiltrated secrets, mis-ingested PII).
- A retention policy hits its limit and scheduled purge needs to be runnable (cross-ref `/retention-policy`).
- A regulator order (DPA, HHS OCR, FTC) requires destruction of named records.

## Pre-flight

1. **Data inventory exists.** Cross-ref `/data-inventory` or `/pii-inventory`. The runbook needs a system-by-system map of where the in-scope data lives: app DB tables, search indexes, caches, blob storage, analytics warehouse, third-party processors (Stripe, Segment, Intercom, Mixpanel), logs, backups. No inventory → stop and run inventory first.
2. **Legal-hold check defined.** Active litigation, regulatory investigation, or subpoena freezes erasure regardless of the user's request. Verify the legal-hold register exists and is consulted on every purge ticket.
3. **Backup retention policy known.** You cannot author backup-redaction without knowing backup frequency, retention duration, encryption status, and key-management surface. Cross-ref `/backup-restore` and `/retention-policy`.
4. **Audit-log infra in place.** Every purge must emit a tamper-evident audit entry. Cross-ref `/audit-log-design`. No audit infra → audit before purge.
5. **Authority verification mechanism.** Signed user request, support ticket with manager sign-off, regulator order, or legal sign-off — pick one and document it. No purge runs on a verbal request.
6. **Retention-exception register.** Financial transactions (IRS 7yr US, HMRC 6yr UK), tax records, AML/KYC records (BSA 5yr US, AMLD6 5yr EU), medical records (HIPAA 6yr, state law often longer), employment records — these survive erasure with documented legal basis.

## Inputs

- **Scope tier** — per-tenant / per-user / per-record / per-PII-class. Determines blast radius and FK topology.
- **Trigger** — user request (Art.17 / CCPA), contract end (MSA termination), regulatory order, breach remediation, scheduled retention purge.
- **Retention exceptions** — list of record classes that survive purge with legal basis (e.g. "financial transactions retained 7yr per IRS §6001").
- **Backup-redaction policy** — one of:
  - (a) **Wait-and-re-run:** purge prod now; re-run purge after each backup expires until backups roll off (simplest, slowest)
  - (b) **Restore-redact-re-backup:** restore each backup to scratch, redact, re-encrypt, replace (expensive, occasionally required)
  - (c) **Crypto-shred:** per-tenant encryption key destroyed → ciphertext on backup unreadable (cleanest where per-tenant keys exist; pairs with `/cmek-design` or `/byok-design`)
- **Notification matrix** — who must be told (data subject, joint controllers, processors per DPA, regulator if breach-driven, customer if processor purge).
- **Soft-delete window** — default 30 days. Recovery buffer for accidental triggers.
- **Idempotency expectation** — the script must re-run cleanly (no errors on already-purged rows).

## Process

1. **Verify trigger authority.** Confirm request signed by the data subject (or authorized rep), ticket approved by Privacy / Legal, or regulator order on file. Record the verifier identity in the runbook. No authority → halt, surface to Privacy team.

2. **Scope determination.** Enumerate every system + table + storage location holding in-scope data. Build the scope inventory table (see Output Format). For each row, mark: system, location, data class, FK dependencies, owner, deletion mechanism (SQL DELETE / SDK call / blob delete / index purge / processor API).

3. **Legal-hold gate.** Check the legal-hold register. If any in-scope subject / tenant / record is under hold, **halt the purge entirely**, log the halt event, and surface to Legal. Partial purge while a hold is active risks spoliation. Do not bypass.

4. **Retention-exception classification.** For each row in the scope inventory, classify as `purge-now` or `retain-with-justification`. The justification must cite legal basis and retention duration. Common retain-with-justification slots:
   - Financial transactions (IRS / HMRC / equivalent) — typically 6–7 years
   - Tax records — typically 7 years
   - AML / KYC records (fintech) — typically 5 years post account closure
   - PHI audit trails (HIPAA) — 6 years from creation or last action
   - Employment records — jurisdiction-dependent, often 3–7 years
   - Litigation hold (overrides everything until released)

5. **FK topological order.** Map foreign-key dependencies and order the delete: children before parents, or cascade where FK-safe. Auto-detect via schema introspection (Prisma `prisma db pull`, raw `information_schema.referential_constraints` query, or equivalent). Document the order in the runbook so the script and runbook agree.

6. **Soft-delete window.** Default 30 days. The first pass flips `deleted_at` / `purge_scheduled_at` and removes from user-facing surfaces (search, lists, app reads). This protects against accidental triggers — support has a window to restore. Make the window configurable per trigger type (regulator order may bypass with sign-off).

7. **Hard-delete pass — primary script.** After the soft-delete window expires:
   - Script per system, idempotent (re-runnable, no error if already gone — use `WHERE id IN (...)` not `WHERE id = ...` for batch; check existence before delete or absorb the not-found case).
   - Paginated for large sets (e.g. 1000 rows per batch, sleep between batches to avoid replication lag).
   - Wrap per-table delete in a transaction; per-system loop outside the transaction so a single processor failure doesn't roll back DB work.
   - Emit progress log per batch (count deleted, count skipped, errors).

8. **Search / cache / CDN invalidation.** Hard-delete in source-of-truth does not propagate automatically. Explicitly invalidate:
   - Search index (Elasticsearch / Algolia / Meilisearch / Typesense) — issue delete-by-query
   - Caches (Redis, Memcached, in-process LRU) — flush keys matching scope pattern
   - CDN edges (Cloudflare / Fastly / CloudFront) — purge URLs that may have cached PII (signed-URL exports, avatar paths)
   - Read replicas — verify replication lag is zero before declaring complete

9. **Backup-redaction policy execution.** Pick one of (a)/(b)/(c) at runbook authoring time, document it, and execute:
   - **(a) Wait-and-re-run:** schedule re-runs of the purge script after each backup-retention boundary until the oldest backup is younger than the purge trigger. Record dates in the runbook.
   - **(b) Restore-redact-re-backup:** for each retained backup, restore to scratch env, run redaction SQL, dump, encrypt, replace original. Costly, only required when a regulator names a specific record.
   - **(c) Crypto-shred:** destroy the per-tenant / per-subject encryption key in the KMS (AWS KMS `ScheduleKeyDeletion`, GCP KMS `destroyCryptoKeyVersion`, Azure Key Vault soft-delete + purge). Ciphertext on backups becomes unreadable. Pairs with `/cmek-design` / `/byok-design` / `/hsm-rotation-policy`. Document the key ID and destruction timestamp.

10. **Audit-log entry.** Emit one tamper-evident audit event per purge:
    - Actor (verifier identity), action (`data.purge.executed`), target (hash of subject-id / tenant-id, never the raw PII), outcome (success / partial / failed), scope summary (system count, row count by class), trigger (request-id / ticket-id), certificate-id.
    - Cross-ref `/audit-log-design` for schema.
    - **Never log raw PII in the audit entry.** The audit log will outlive the purged data; defeats the purge.

11. **Notification fan-out.** Per the notification matrix:
    - Data subject — confirmation of completion (within SLA, typically 30 days for GDPR).
    - Processors — controller-to-processor instruction to purge their copies (Stripe, Segment, Intercom, etc. — each has a vendor-specific purge endpoint).
    - Joint controllers — notify per DPA.
    - Regulator — only if the purge is breach-driven and regulator was previously notified, or if regulator ordered the purge.
    - Internal stakeholders — Privacy lead, account team, support (close ticket).

12. **Certificate of destruction.** Sign and archive:
    - Certificate ID (UUID)
    - Scope summary (counts only, no PII)
    - Trigger reference (ticket / request / order ID)
    - Authority verifier
    - Backup-redaction policy applied
    - Crypto-shred key ID (if applicable)
    - Completion timestamp
    - Signatory (Privacy lead or DPO)
    - Hash of the runbook file at execution time

## Output Format

Write `docs/ops/data-purge-<scope>.md`:

```markdown
---
scope: <tenant-offboarding | user-erasure | record-class | breach-remediation>
trigger: <user-request | contract-end | regulator-order | breach | scheduled>
status: <draft | dry-run | executed>
requested_at: <ISO-8601>
completed_at: <ISO-8601 | null>
certificate_id: <uuid | null>
verifier: <Privacy / Legal / Regulator>
---

# Data Purge Runbook — <scope-slug>

## Authority verification
- Trigger: <request | order | ticket>
- Verifier: <name + role>
- Reference: <ticket-id / request-id / order-ref>
- Signed-off: <date>

## Scope inventory
| System | Location | Data class | FK deps | Owner | Deletion mechanism |
|---|---|---|---|---|---|
| App DB | users, sessions, exports | account, PII | sessions→users | platform | SQL DELETE |
| Search | users-index | account, PII | none | platform | delete-by-query |
| Blob | s3://exports/<tenant>/ | exports | none | platform | s3 rm --recursive |
| Warehouse | analytics.users_mirror | account-mirror | downstream views | data | DELETE + view refresh |
| Stripe | customer.<id> | billing | none | finance | stripe customers.del |
| Intercom | contact.<id> | comms | none | support | intercom DELETE /contacts |
| Backups | s3://backups/<date>/ | full snapshot | none | platform | crypto-shred (per-tenant key) |

## Legal-hold gate
- Register checked: <date / verifier>
- Holds active in scope: <none | list>
- Decision: <proceed | halt-and-escalate>

## Retention exceptions
| Class | Records | Retention | Legal basis | Stored where |
|---|---|---|---|---|
| Financial transactions | invoices, charges | 7yr | IRS §6001 | finance-archive |
| AML / KYC | identity verifications | 5yr post-closure | BSA 31 USC 5311 | kyc-archive |
| PHI audit trail | access logs | 6yr | HIPAA §164.530(j) | audit-archive |

## FK topological order
1. sessions, api_keys, oauth_tokens (children of users)
2. exports, audit_events-non-retention (children of users)
3. users
4. tenant_settings (parent of users, only if per-tenant scope)
5. tenants

## Soft-delete schedule
- Soft-delete at: <date>
- Hard-delete after: <soft-date + 30d>
- Override: <regulator-order bypasses window>

## Hard-delete script
- Path: scripts/purge-<scope>.<ext>
- Idempotent: yes (existence-check per row)
- Pagination: 1000 rows/batch, 100ms sleep
- Dry-run flag: --dry-run prints affected counts only

## Search / cache / CDN
- Elasticsearch: DELETE users-index/_doc/_query
- Redis: SCAN + UNLINK tenant:<id>:*
- Cloudflare: cache purge by URL prefix
- Replica lag check: pg_stat_replication.lag < 1s before declaring done

## Backup-redaction policy
- Policy: <(a) wait-and-re-run | (b) restore-redact-re-backup | (c) crypto-shred>
- Rationale: <e.g. per-tenant CMEK in place, crypto-shred is cleanest>
- Crypto-shred key ID: <KMS key arn / null>
- Wait-and-re-run schedule: <date list / null>

## Audit-log entry template
{
  "actor": {"type": "system", "id": "purge-runbook", "verifier_hash": "..."},
  "action": "data.purge.executed",
  "target": {"type": "tenant", "id_hash": "sha256(tenant-id)"},
  "outcome": "success",
  "metadata": {
    "scope": "tenant-offboarding",
    "trigger_ref": "ticket-12345",
    "certificate_id": "<uuid>",
    "system_counts": {"db": 12, "blob": 3, "processors": 4}
  }
}

## Notification matrix
| Recipient | Channel | Timing | Template |
|---|---|---|---|
| Data subject | Email | Within 30d (GDPR) | templates/purge-confirm-subject.md |
| Stripe | API | Pre-purge | inline |
| Intercom | API | Pre-purge | inline |
| Joint controller | Email | At completion | templates/purge-joint-ctrl.md |
| Privacy lead | Slack | At completion | inline |

## Certificate of destruction
- ID: <uuid>
- Issued at: <ISO-8601>
- Signatory: <DPO / Privacy lead>
- Runbook-hash at execution: <sha256>
- Archived to: docs/ops/certs/<uuid>.md (immutable)
```

Plus the script stub `scripts/purge-<scope>.<ext>` skeleton:

```ts
// Idempotent, paginated, dry-run-capable.
// Usage: pnpm tsx scripts/purge-<scope>.ts --scope=<id> [--dry-run]
async function main() {
  const { scope, dryRun } = parseArgs()
  await verifyAuthority(scope)              // throws if no signed ticket
  await checkLegalHold(scope)               // throws if hold active
  for (const step of topologicalOrder) {
    await runStep(step, { scope, dryRun })  // existence-check + paginated batch
  }
  await invalidateCaches(scope)
  await fanoutProcessors(scope, dryRun)
  await emitAuditEntry(scope)
  await issueCertificate(scope)
}
```

**Multi-vertical worked examples:**

*SaaS B2B — tenant offboarding:*
- Scope: workspace `acme-corp` + all members + all artifacts (projects, files, comments).
- Retention exception: invoices + line-items kept 7yr per IRS (moved to `finance-archive` schema with restricted ACL, original rows deleted from workspace tables).
- Backup policy: per-tenant CMEK exists → crypto-shred. Destroy `aws/kms/key/tenant-acme-corp` after final backup completes.
- Processors fan-out: Stripe customer delete, Segment workspace delete, Intercom company delete.
- Certificate signed by Privacy lead, archived to `docs/ops/certs/<uuid>.md`.

*Fintech — account closure:*
- Scope: user `u_12345` + linked wallets + linked transfers + KYC documents.
- Retention exception: AML/KYC records retained 5yr post-closure per BSA (moved to `aml-archive` schema, encrypted with separate retention key, accessible only by Compliance role).
- Transfers <5yr old retained per AML; transfers >5yr purged with user.
- Backup policy: shared backup pool (no per-user key) → wait-and-re-run. 30-day backup retention → re-run scheduled at +30d and +60d to clear backup generations.
- Processors fan-out: Stripe Identity delete, Plaid item revoke (token + access purge).

*Healthcare — patient record decommission:*
- Scope: patient `p_67890` + all encounters + all uploaded documents.
- Retention exception: PHI audit trail (who accessed what when) kept 6yr per HIPAA §164.530(j) — the audit log itself is exempt from this purge.
- Active treatment records: minor patient records often retained until age-of-majority + state retention period (frequently 21yr+ aggregate). Verify state law before purging minor records.
- Backup policy: PHI backups encrypted with per-patient key (sub-tenant CMEK) → crypto-shred. Document key destruction in BAA-tracked register.
- Notification: subject + designated record-set holder if record-share agreement exists.

## Boundaries

This skill is a **runbook**, not a generic deletion library. It:

- Does NOT execute purge without authority verification. The runbook itself requires a signed ticket / order / request reference before the script will run.
- Does NOT skip legal-hold checks. A hold halts the purge entirely; partial purge under hold risks spoliation.
- Does NOT purge financial / tax / regulatory-required records without a documented exception ticket. Default behavior is to retain with justification; exception is opt-in with legal sign-off.
- Is ALWAYS idempotent. Re-run on already-purged data must be a no-op (no errors, no double-emit of certificate). If your script throws on missing rows, fix it before running.
- Does NOT log PII in audit entries. The audit log will outlive the purged data; any PII in metadata defeats the purge. Hash the subject-id, never log the email / name / SSN.
- Fans out to processors via their published purge endpoints. Does NOT assume processors purge automatically — the controller-to-processor instruction is explicit per DPA Art.28.
- Does NOT cover live-data export to the user (separate `/data-export` skill — typically a precondition for erasure).
- Does NOT write the privacy policy text describing the purge SLA (cross-ref `/privacy-policy`).
- Does NOT replace `/retention-policy` — that skill authors the policy; this skill operationalizes the deletion mechanic.

## Re-run Behavior

- Re-running the purge script on already-purged scope: **no-op**. Each step does an existence check or absorbs the not-found case. No errors, no duplicate certificate.
- Re-running with a different scope: **new runbook file**. Each purge gets its own `docs/ops/data-purge-<scope>.md` keyed by scope-slug. Never edit a completed runbook in place; archive and supersede.
- Regulation updated (e.g. retention period changes, new jurisdiction enacted): **diff the runbook**, bump the version field in frontmatter, re-run authority verification. Do not silently re-apply.
- Backup-redaction wait-and-re-run schedule: re-runs are pre-registered in the runbook; cron / scheduled-job triggers each iteration; each iteration emits its own audit entry referencing the parent certificate ID.
- Crypto-shred key destruction is **one-shot and irreversible**. If you need to roll back, you cannot — restore from a backup taken before the key was destroyed (which is precisely what the purge intended to prevent). Confirm authority twice before scheduling key destruction.

## Auto-chain

- **Consumed by `/customer-offboarding-comms`** — the comms skill defines the user-facing email and timeline; this skill defines the back-end purge that the comms promises.
- **Consumed by `/gdpr-erasure-runbook` / `/hipaa-decommission`** (regulation-specific wrappers) — both delegate the mechanical purge to this skill and add regulation-specific notification + documentation.
- **Triggers `/audit-log-design` entry** — every purge emits a tamper-evident audit event. If audit infra is missing, build it first.
- **Pairs with `/backup-restore`** for backup-redaction policy authoring. The two skills agree on retention windows and redaction approach.
- **Cross-refs `/cmek-design` / `/byok-design` / `/hsm-rotation-policy`** for the crypto-shred path. Crypto-shred is only viable where per-tenant or per-subject encryption keys exist.
- **Cross-refs `/retention-policy`** for the rules; this skill executes the rules.
- **Cross-refs `/data-export`** — typically a user invokes export before erasure; the export must complete (or be declined) before the purge runs.
- **Pre-flight chains `/pii-inventory` / `/data-inventory`** — no purge without inventory.
- **Post-purge chains `/breach-notification-runbook`** only if the purge is breach-remediation-driven and the breach was previously reported.

## Example Trigger

> User: "build the data purge runbook for our tenant offboarding flow"

→ `/data-purge-runbook` produces `docs/ops/data-purge-tenant-offboarding.md` with:
- Scope: workspace + members + projects + files + comments
- Retention exception: invoices + tax records → `finance-archive` schema, 7yr per IRS
- FK order: sessions → exports → memberships → projects → workspaces → tenants
- Soft-delete window: 30 days; hard-delete after
- Backup-redaction: crypto-shred (per-tenant CMEK already in place via `/cmek-design`)
- Processors fan-out: Stripe, Segment, Intercom, internal warehouse
- Audit entry: action `data.purge.executed`, target `tenant-id-hash`, certificate ID
- Notification: workspace owner email, processor APIs, Privacy lead Slack
- Certificate template signed by DPO
- Script stub: `scripts/purge-tenant.ts` with `--dry-run`, idempotent, paginated 1000 rows/batch
- Auto-chains: `/audit-log-design` entry, `/customer-offboarding-comms` for the user email
