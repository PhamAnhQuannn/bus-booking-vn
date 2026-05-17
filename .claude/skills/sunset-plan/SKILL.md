---
name: sunset-plan
description: Ordered shutdown plan for sunsetting a product or feature — data-export window, customer-comms timeline, infra teardown order, regulatory retention split, certificate of shutdown. Use when user says "sunset", "EOL", "shutdown plan", "decommission", "wind down", "/sunset-plan", or when `/kill-criteria-doc` / `/golden-path-design` / `/platform-as-product` / `/project-status` chains here.
output_size:
  XS: skip
  S: 1h
  M: 2h
  L: 4h
  XL: 6h
---

# /sunset-plan — Ordered Product / Feature Shutdown

## Why you'd care

Three failure modes hide inside any shutdown without a written plan:

- **No comms timeline** — customers learn the product is dead from the 500 error, not the email. Refunds + chargebacks + Trustpilot one-star reviews land before the engineering team finishes the teardown.
- **Data deleted before export window closed** — customer requests their data at T+1 day; backups already purged; you owe statutory damages (GDPR Art. 17 + Art. 20 portability conflict).
- **Infra torn down in wrong order** — DNS records dropped before the read-only archive served its last byte; auth provider revoked before customers could log in to fetch exports; backups deleted before regulator retention window cleared.

One pre-written plan, authored before the announcement ships, sequences the levers so the customer-facing window closes cleanly, the regulatory-retention slice survives, and the infra cost stops bleeding on a known date. Pairs tight with `/data-purge-runbook` (the destruction half) and `/kill-criteria-doc` (the why).

Invoke as `/sunset-plan`. Author it before any customer email goes out.

## When This Skill Applies

Triggers (user phrases):
- "sunset", "EOL", "end of life", "shutdown plan", "decommission", "wind down", "deprecate the product"
- "/sunset-plan"
- "kill the feature", "retire <product>", "shut it down"

Auto-invoke (chained FROM):
- **`/kill-criteria-doc`** — when written kill-criteria are met (revenue threshold breached, usage cliff sustained N quarters, strategic deprioritization).
- **`/golden-path-design`** — when a primary golden path is being deprecated in favor of a replacement product.
- **`/platform-as-product`** — when an internal platform / capability is being decommissioned.
- **`/project-status`** — when project class flips to "Sunset" stage in `/project-classify` output.
- **`/api-versioning`** — when a deprecated API version has reached its sunset date (per RFC 8594 `Sunset:` header).

## Pre-flight

1. **Authority confirmed.** Who signed off? Product lead / CEO / Board / Compliance? Sunset decisions get reversed in week 6 when a tier-1 customer threatens to churn — write the authority chain BEFORE comms ship so the reversal cost is visible.
2. **Kill-criteria reference exists.** Cross-ref `/kill-criteria-doc` output. Missing doc → this skill flags as P1: sunsets without written criteria turn political ("can we save it?") and slip 6+ months.
3. **Retention policy known.** Read `docs/compliance/retention-policy.md` (or `/retention-policy` skill output). Each regulated data class (financial / health / employment / audit) has a separate retention clock that survives teardown.
4. **Data-export prereq.** Customer self-serve export must exist BEFORE the announcement (per `/data-export` skill). If absent → build first, then announce; do not announce-and-build.
5. **Audit-log infra in place.** Each sunset milestone must write an audit-log entry (announcement, read-only cutover, write-disabled cutover, final purge, certificate). `/audit-log-design` skill output must exist.
6. **Backup posture.** Latest snapshot + PITR window documented. Some regulators (HIPAA, SOX, financial) require backups survive the customer-visible teardown by N years.

## Inputs

- **Scope** — `product | feature | tier | api-version`. Determines comms surface + teardown breadth.
- **Trigger reason** — `kill-criteria-met | strategic | regulatory | acquisition | cost-cut`. Drives messaging tone.
- **Retention exceptions** — list of data classes that survive teardown (audit logs, financial records, regulator artifacts) with retention end-date each.
- **Comms window length** — default 90 days (T-90 → T-0). Enterprise tiers may negotiate 180+.
- **Customer count tier** — `<100 | 100-10k | 10k+`. Drives comms channel mix (1:1 email vs in-app banner vs status-page).
- **Replacement path** — `none | migration to <product> | refund | export-only`. Affects every comms touchpoint.

## Process

1. **Confirm sunset authority + trigger.** Write the one-line trigger: "Killing <product> because <criteria>; decision authority <name>; ratification date <date>." If trigger is fuzzy ("not enough revenue") → bounce back to `/kill-criteria-doc` to harden it.

2. **Scope inventory.** Catalog everything that exists in the sunset surface:

   | Slice | Where it lives | Owner | Teardown action |
   |---|---|---|---|
   | Product UI / app shells | Vercel / Netlify / S3+CDN | Frontend | DNS swap to archive page (T-0), domain release (T+retention) |
   | API endpoints | Backend service | Backend | Read-only at T-30, write-disabled at T-7, 410 Gone at T-0, code delete T+retention |
   | Worker / cron / queue | Celery / Sidekiq / Temporal | Backend | Pause at T-7, code delete T+retention |
   | Database | Postgres / Mongo / DynamoDB | Backend / DBA | Snapshot at T-0, retention-split (regulated vs ephemeral), purge per `/data-purge-runbook` at T+retention |
   | Backups | S3 / cross-region replica | DBA / SRE | Retention-policy honored; final purge at retention end |
   | Customer data exports | S3 + signed URLs | Backend | Generation at T-90 ready; URLs live until T+30 post-shutdown |
   | Auth / SSO config | Auth0 / Clerk / Okta / Cognito | Backend | Disable signups T-30, revoke sessions T-0, delete tenants T+retention |
   | Third-party processors | Stripe / Twilio / Segment / Intercom / Datadog | Various | Vendor-specific offboarding fan-out (step 8) |
   | DNS records | Route53 / Cloudflare | SRE | Replace prod A/AAAA with archive page T-0; release zone T+90 |
   | Observability | Datadog / Sentry / Honeycomb | SRE | Stop new ingest T-0, retention-trim per platform policy |
   | Status page / docs | Statuspage / GitBook | DevRel / Support | Archived banner T-0, takedown T+90 |
   | Customer contracts | Legal / CRM | Legal / CS | Termination notices T-90, refund/credit calc T-30 |
   | Regulatory artifacts | Audit-log store, compliance vault | Compliance | Survives teardown by N years per retention policy |

   Missing rows → halt; the plan is incomplete. The "where it lives" column drives the teardown order in step 7.

3. **Customer comms timeline.** Build the cadence by tier. Default 90-day window (extend to 180+ for enterprise):

   | T-marker | Channel | Audience | Message focus |
   |---|---|---|---|
   | T-90 | Email + in-app banner + status page + blog | All customers + public | Announcement, replacement path, export-window dates, refund policy |
   | T-60 | Email reminder (only customers active in last 90d) | Active customers | "Time to export — here's how" + 1:1 office hours for enterprise |
   | T-30 | Email + dashboard modal | All customers | "30 days left — write-disable at T-7" — surface unmigrated data |
   | T-7 | Email + in-app sticky modal + SMS for enterprise | All customers | "Write-disable in 7 days — last call for export" |
   | T-0 | Email + status-page incident + final blog post | All customers + public | "Service ended today. Archive read-only for 30 days. Exports available at <URL> until <date>." |
   | T+30 | Email | Customers who exported in last 30d | "Final reminder — exports purged at T+30." |
   | T+retention-end | Internal only | Compliance | Audit-log entry: final purge complete, certificate issued |

   Each row = a pre-written template stored in `docs/comms/sunset-<slug>/<t-marker>.md`. Do NOT send any without legal review for B2B / regulated tiers.

4. **Data-export window + final-export deadline.**
   - Export feature lives at T-90 minimum (verify pre-flight #4).
   - Default formats: JSON (machine), CSV (spreadsheet), PDF (human archival). Skip formats with explicit user opt-out.
   - Per-customer signed URL valid 7 days; regenerable until T+30.
   - Final-export deadline = T+30 by default. After: 410 Gone + email saying "purged per retention policy".
   - High-tier customers (enterprise / regulated) may negotiate extended export to T+90; document per-contract.

5. **Read-only mode + write-disable cutover.**
   - Read-only at T-30 (or T-7 for fast-track): UI banner "Read-only — service ending <date>". API returns 403 on `POST/PUT/PATCH/DELETE` with `X-Sunset: <date>` header.
   - Write-disabled at T-7: hard cutover. New auth sessions refused. Existing sessions can read until T-0.
   - At T-0: 410 Gone on all endpoints with retry-after pointing to export URL + replacement product (if any).
   - Cross-ref `/api-versioning` for `Sunset:` (RFC 8594) + `Deprecation:` (RFC 9745) response headers wired throughout.

6. **Regulatory-artifact retention split.** Separate what survives teardown from what dies with it:

   | Class | Retention | Storage post-teardown | Purge trigger |
   |---|---|---|---|
   | Financial transactions / invoices | 7 years (SOX / IRS) | Cold S3 + encryption | `/data-purge-runbook` at retention-end |
   | Audit logs (auth, admin, compliance) | 6 years (HIPAA) or per policy | Tamper-evident vault | `/data-purge-runbook` at retention-end |
   | PHI (if healthcare) | Per BAA + state law | Encrypted cold store | `/data-purge-runbook` at retention-end |
   | Employment records (if HRIS adjacent) | 4–7 years per jurisdiction | HR vault | `/data-purge-runbook` at retention-end |
   | Ephemeral customer content | None — purge with teardown | n/a | `/data-purge-runbook` at T+30 |
   | PII not in retained class | None — purge with teardown | n/a | `/data-purge-runbook` at T+30 |

   The retained-classes rows survive infra teardown. The runbook must list which AWS accounts / vendor accounts retain access for retention compliance.

7. **Infra teardown order.** Tear front-to-back so customers never hit a half-dead surface:

   ```
   T-0 cutover sequence (hour-by-hour on shutdown day):
   1. Status-page incident posted ("Service ended").
   2. DNS A/AAAA records swapped to archive landing page (TTL ≤ 60s, set 1h prior).
   3. CDN cache purge (front-door layer).
   4. API gateway → 410 Gone routes mounted.
   5. Frontend deploy with archive page (no React app, just static HTML + export-portal link).
   6. Worker / cron / queue paused (no new ingestion).
   7. Auth provider — revoke active sessions, disable new login.
   8. Background: export-portal stays live (separate hostname or path) until T+30.
   T+30:
   9. Export portal disabled (return 410 + final email batch).
   10. DB snapshot final + start retention-window storage (cold S3).
   11. Worker / cron / queue code deleted from monorepo.
   T+retention-end (per class):
   12. /data-purge-runbook fires per regulated-data class.
   13. AWS accounts deprovisioned, DNS zone released, IaC stack destroyed.
   14. Certificate of shutdown issued (step 9).
   ```

   Customer-facing layers (DNS / CDN / frontend / API) die first so no customer sees a half-broken UI. Worker / cron / DB / IAM die later because the export portal needs them. Backups + IAM die last.

8. **Vendor offboarding fan-out.** Each third-party processor needs explicit teardown:

   | Vendor | Action | Timing | Risk if skipped |
   |---|---|---|---|
   | Stripe | Cancel all subs, refund per policy, disconnect Connect accounts, delete API keys at retention-end | T-30 cancel, T-0 disconnect | Subs keep billing after shutdown — chargebacks |
   | Auth0 / Clerk / Okta | Disable new signup T-30, revoke sessions T-0, delete tenants T+retention | T-30 / T-0 / T+ret | Login spam at archive URL |
   | Segment / Mixpanel | Stop event ingest T-0, request data deletion per privacy policy | T-0 + 30d | PII retained at processor against policy |
   | Intercom / Zendesk | Migration to read-only T-30, archive conversation export T-0, account close T+retention | T-30 / T-0 / T+ret | Support inbox keeps receiving tickets |
   | Datadog / Sentry / Honeycomb | Stop ingest T-0, archive last 30d to S3, delete account T+ret | T-0 / T+ret | Per-host billing keeps running |
   | DNS provider | Park zone at T-0, release at T+90 | T-0 / T+90 | Squatters grab the domain |
   | CDN (Cloudflare / Fastly) | Purge cache T-0, disable zone T+30 | T-0 / T+30 | Stale assets served |

   Each row = an action item with owner + due-date. Missing owner → halt.

9. **Audit-log entry + certificate of shutdown.** At each milestone (announcement, read-only, write-disabled, T-0, T+30, final-purge), write an audit-log entry:
   ```
   ts: <ISO-8601>
   actor: <person + system>
   action: <milestone-name>
   scope: <product-or-feature-slug>
   evidence: <link-to-comms / snapshot-id / deploy-sha>
   ```

   At T+retention-end (when even regulated data purges), issue **Certificate of Shutdown**:
   ```
   Certificate of Shutdown
   Product: <slug>
   Final purge: <ISO-8601>
   Retention classes purged: <list>
   Backup snapshots destroyed: <list of snapshot IDs>
   Vendor account closures: <list of vendor + close-ts>
   Issued by: <name>, <role>
   Signature / KMS-signed: <hash>
   ```

   Stored permanently in compliance vault (does not purge — it's the proof the rest purged).

10. **Post-sunset monitoring (404 / abandoned-customer redirect).** For N months post-T-0 (default 12):
    - 404 / 410 / 301 traffic monitored. Spike at T-0 → expected. Spike at T-7 → comms missed someone, escalate.
    - Catch-all 410 handler logs source IP / referrer / requested-path → CS for abandoned-customer outreach.
    - If replacement product exists: 301 from old paths to replacement with `X-Sunset-Redirect: <slug>` header for tracking.
    - Stop monitoring at retention-end (no obligation past that).

## Output Format

Write `docs/ops/sunset-<scope-slug>.md`:

```markdown
---
scope: <product | feature | tier | api-version>
slug: <kebab-case>
trigger: <kill-criteria-met | strategic | regulatory | acquisition | cost-cut>
status: <draft | announced | in-progress | completed>
announced_at: <ISO-8601>
read_only_at: <ISO-8601>
write_disabled_at: <ISO-8601>
data_export_deadline: <ISO-8601>
final_purge_at: <ISO-8601>
retention_end_at: <ISO-8601 | per-class table below>
certificate_id: <uuid | null until T+retention-end>
authority: <name + role>
companion_docs:
  kill_criteria: <link>
  data_purge_runbook: <link>
  data_export: <link>
  retention_policy: <link>
---

# Sunset Plan — <product / feature>

## Authority + trigger
<one-line trigger + decision-maker + ratification date>

## Scope inventory
[paste scope-inventory table from step 2]

## Customer comms timeline
[paste timeline table from step 3]
- T-90 template: `docs/comms/sunset-<slug>/t-90.md`
- T-60 template: `docs/comms/sunset-<slug>/t-60.md`
- ... (all milestones)

## Data-export window
- Export portal lives at: `<URL>`
- Formats: JSON / CSV / PDF
- Per-customer URL TTL: 7 days, regenerable until <T+30>
- Final-export deadline: <ISO-8601>

## Read-only + write-disable cutover
- Read-only at <T-30 ISO>
- Write-disabled at <T-7 ISO>
- 410 Gone at <T-0 ISO>
- API headers: `Sunset: <T-0>`, `Deprecation: <T-90>` (RFC 8594 / 9745)

## Retention split
[paste regulatory-artifact retention table from step 6]

## Infra teardown order
[paste T-0 sequence from step 7]

## Vendor offboarding
[paste vendor table from step 8]
- Owners assigned: <list>

## Audit-log + certificate
- Milestone audit entries: <link to audit store>
- Certificate of shutdown: issued at <T+retention-end>, stored at <vault link>

## Post-sunset monitoring
- 404 / 410 dashboard: <link>
- Abandoned-customer outreach owner: <CS lead>
- Monitor end-date: <T-0 + 12mo>

## Companion docs
- `/kill-criteria-doc`: <link>
- `/data-purge-runbook`: <link>
- `/data-export`: <link>
- `/customer-offboarding-comms`: <link>
- `/vendor-offboarding`: <link>
- `/retention-policy`: <link>
- `/audit-log-design`: <link>
- `/api-versioning` (if API version sunset): <link>
```

## Multi-vertical worked examples

### SaaS product EOL — collaborative-whiteboard tool, 18k customers
- **Trigger**: kill-criteria met (revenue growth < 5% YoY for 3 quarters, NPS −8).
- **Replacement path**: migration export to Figma + 6-month 50%-off promo.
- **Comms window**: 120 days (enterprise tier contractually owed 90d minimum + buffer).
- **Retention exceptions**: invoicing 7y (SOX), audit logs 4y, customer PII purged at T+30.
- **Infra**: Vercel frontend → archive page; Render API → 410; Postgres → final snapshot T-0 → cold S3 for 7y → purge.
- **Vendors**: Stripe (cancel 18k subs, T-30 announce, T-0 disconnect Connect), Auth0 (tenant delete T+30), Segment (deletion request T-0), Datadog (account close T+30).
- **Post-sunset**: 12mo 404 monitoring; 38% of T-7 logins came from 2 enterprise accounts → CS outreach saved $90k ARR migration to enterprise replacement product.

### Single-feature deprecation — "AI summary" inside main product, kept the rest
- **Trigger**: strategic — vendor API price hike + utilization < 4% MAU.
- **Replacement path**: none; in-product banner "feature retired".
- **Comms window**: 30 days (single feature, no replacement, low usage).
- **Retention**: cached summaries purged at T-0 (no regulatory class).
- **Infra**: feature-flag flip to 0% T-0, code removal at T+30, vendor (OpenAI) API key revoked T-0.
- **Comms**: 1 email + in-app banner T-30; no T-60 / T-7 (single feature; cadence collapsed).
- **Post-sunset**: 0 customer complaints; vendor offboarding saved $11k/month.

### Marketplace shutdown — two-sided platform, 4 years live, acquired-then-shuttered
- **Trigger**: acquisition (acquirer killed product to fold customers into theirs).
- **Replacement path**: migration to acquirer's platform with full data transfer.
- **Comms window**: 180 days (enterprise + dual-sided audience needs longer).
- **Retention**: financial 7y, dispute-resolution-related comms 4y, KYC docs per regulator (varies by country: BSP 5y, MAS 5y, FCA 5y).
- **Infra**: dual-stack window — old marketplace read-only at T-90 while migration tooling ran; T-0 = full 410 + redirect to acquirer URL.
- **Vendors**: Stripe Connect (multi-party — both sides notified separately), KYC vendor (Persona — data export to acquirer's account), Twilio (SMS/voice account close T+30).
- **Audit + certificate**: critical given regulatory exposure; certificate issued at T+5y for KYC purge, T+7y for financial.

## Boundaries

- **Not the same as `/data-purge-runbook`.** That skill destroys data; this skill schedules WHEN destruction fires and WHAT customer-facing comms surround it. Sunset plan calls `/data-purge-runbook` at T+30 (ephemeral) + T+retention-end (regulated).
- **Not the same as `/kill-criteria-doc`.** That skill writes the IF (revenue / usage / strategic thresholds that mean "kill it"). This skill writes the HOW after IF triggers.
- **Not the same as `/api-versioning` sunset.** API-version sunset is a scope-restricted instance of this skill — same shape, smaller surface (no infra teardown, just an endpoint going 410). Use `/api-versioning` for that; this skill for full product / feature.
- **Does not negotiate retention policy.** Reads `/retention-policy` output; if missing, refuses and bounces.
- **Does not draft legal termination notices.** Surfaces the requirement; legal team owns the wording.
- **Does not handle acquisition data-migration.** That's a parallel migration project — this skill writes the sunset half; migration team writes the migration half.

## Re-run Behavior

- One plan per sunset scope. Re-running on same slug overwrites if status = `draft`; locks if status = `announced` (writes to `sunset-<slug>-v2.md` with `supersedes:` frontmatter).
- Once status = `in-progress`, plan edits are scope-additive only (cannot reduce retention, cannot accelerate write-disable without comms-impact assessment).
- After status = `completed` + certificate issued → file is archival; do not modify.
- Cumulative log: `docs/ops/sunset-lineage.md` maintained across all sunset events (one-line entry per product / feature with announcement-date + completion-date + certificate-id).

## Auto-chain

- **Fires (downstream):**
  - `/data-purge-runbook` — at T+30 (ephemeral classes) AND T+retention-end (regulated classes). Sunset plan provides scope inventory; purge runbook executes.
  - `/customer-offboarding-comms` — for each T-marker; sunset plan provides timeline + audience, comms skill renders templates.
  - `/data-export` — must exist BEFORE T-90 (pre-flight); plan references it.
  - `/vendor-offboarding` — per row in vendor table; one offboarding flow per processor.
  - `/audit-log-design` — milestone entries logged via audit-log infra.
  - `/post-mortem` — at T+30 if customer-visible shutdown caused SEV1/2 (rare but happens when comms missed enterprise tier).
- **Reads (upstream):**
  - `/kill-criteria-doc` — provides trigger justification.
  - `/retention-policy` — provides regulated-class retention windows.
  - `/backup-restore` — provides backup posture for retention storage.
  - `/api-versioning` — provides sunset/deprecation header policy (if API-version scope).
- **Pairs with:**
  - `/release-notes` — final-shutdown announcement is a release-notes entry on the deprecation channel.
  - `/customer-incident-comms` — if anything goes wrong during cutover, escalation path is incident-comms not sunset-plan.

## Verification

1. `docs/ops/sunset-<slug>.md` exists with frontmatter populated (scope, slug, trigger, status, announced_at, write_disabled_at, final_purge_at, retention_end_at, authority).
2. Scope inventory table has ≥ 1 row per slice present in the product (no slice = "not applicable" allowed, but missing-by-omission = halt).
3. Comms timeline has ≥ 5 T-markers (T-90 / T-60 / T-30 / T-7 / T-0) for any product-scope sunset; minimum 2 for feature-scope.
4. Each retention class in retention-split table has both retention duration AND post-teardown storage location.
5. Vendor offboarding table has owner + due-date per row.
6. Companion docs (`/kill-criteria-doc`, `/data-purge-runbook`, `/retention-policy`, `/data-export`) all resolve to existing files. Missing → fail.
7. Certificate-of-shutdown template included even if certificate_id is null (until T+retention-end).
8. Cross-references in `## Auto-chain` resolve to existing skill files in `.claude/skills/`.

## Example Trigger

User: "we're killing the AI-summary feature — usage too low, vendor cost too high"

→ `/sunset-plan` runs for feature scope:
- Trigger row: "kill-criteria met (utilization < 4% MAU for 6mo + vendor cost > $11k/mo)"; authority = product lead, ratified 2026-05-10
- Scope inventory: feature-flag entry + worker job + 3 API endpoints + cached-summary table + OpenAI API key
- Comms timeline collapsed (single feature, no replacement): T-30 in-app banner + email; T-0 flag flip + final email
- Data-export window: none (cached summaries are derivative, not customer-authored)
- Retention split: none — cached data purges with feature
- Infra teardown: flag flip T-0 → code removal T+30 → OpenAI key revoked T-0
- Vendor: OpenAI offboarding only — revoke API key, cancel monthly commit
- Certificate: not required (no regulated data)
- Auto-chain fires `/customer-offboarding-comms` for T-30 + T-0 templates, `/audit-log-design` for milestone entries
- Output: `docs/ops/sunset-ai-summary.md`
