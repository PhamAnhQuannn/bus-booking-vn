# ADR-007: Observability Design

## Status
ACCEPTED

## Date
2026-06-17 (reviewed and confirmed)

## Context

Bus-Booking requires an observability architecture that satisfies Vietnam-specific regulatory, operational, and financial constraints while supporting a marketplace model serving three user surfaces (customer, operator, admin).

Key business constraints driving observability decisions (sourced from `documentation/business/`):

- **PII regulatory exposure (PDPL 2025 + Decree 356/2025)**: Phone is the primary customer identifier; payment records are "sensitive personal data" under PDPL 2025. Breach notification deadline is 72 hours to MPS A05 Department. Domain invariant I9: "No raw phone in notification payload." Logger redaction list must cover `otpProof` JWT. Any observability platform that ingests unredacted PII offshore constitutes a cross-border data transfer requiring CDTIA filing. (regulatory/data-privacy.md, regulatory/dpia-checklist.md, domain-model/invariants-catalog.md)
- **Append-only audit trail with DB-level immutability**: Three models enforced immutable by PostgreSQL `BEFORE UPDATE/DELETE` triggers: `AdminAuditLog`, `LedgerEntry`, `ConsentRecord`. Compliance Officer persona requires "unified PII audit log" — called out as an unmet pain point. Finance/Accounting Manager requires "ledger reconciliation view" and "MISA push status monitor." (domain-model/bounded-contexts.md, domain-model/invariants-catalog.md, personas/admin-personas.md)
- **Booking funnel and investor KPI instrumentation**: `FunnelEvent` model captures anonymous conversion steps (`search_performed`, `hold_created`, `payment_initiated`, `booking_paid`) keyed by session with no PII. `JobRunLog` tracks cron execution metadata. Investor KPIs require: conversion 8-15%, DAU/MAU 15-25%, repeat booking >40%, <20 support tickets/1K bookings, overbooking <0.1%, refund rate <2% GMV. (domain-model/bounded-contexts.md, personas/investor-kpis.md, market-research/business-model.md)
- **Payment monitoring and reconciliation risk**: VietQR reconciliation rated HIGH likelihood × HIGH impact: "money received but no ticket = worst CX." Payment webhook defense stack requires monitoring of HMAC verification, idempotency deduplication, and amount guards. PSP settlement reconciliation needed daily/weekly. (risk-matrix.md, stakeholder-map.md, domain-model/event-flows.md)
- **Tet surge (10-20x normal traffic)**: Permanent customer defection on failure. "Customers post instantly to social media." Static alert thresholds will fire constantly during Tet or miss anomalies during off-peak — dynamic thresholds required. (risk-matrix.md, market-research/user-insights.md, vietnam-market-context.md)
- **Low-tech operator and support agent audiences**: 60-70% of operators are micro segment with "very low tech literacy." Support Agent needs "booking lookup by phone number or booking reference" — implying searchable operational logs. (personas/operator-personas.md, personas/admin-personas.md)
- **Data localization constraint**: PII must reside in Vietnam (Decree 53/2022 + Law 116/2025). Logger redaction must occur BEFORE data leaves the application boundary. Encrypted PII is still PII under PDPL 2025. (regulatory/data-privacy.md, regulatory/dpia-checklist.md)

---

## Decisions

### 1. Observability Platform — BetterStack + Structured JSON Logs to PG + Sentry

| Option | Pros | Cons |
|--------|------|------|
| **Full managed APM (Datadog / New Relic)** | Rich dashboards, tracing, error tracking, anomaly detection out of the box; low operational overhead; auto-instrumentation for Next.js | Logs containing any residual PII transferred to US/EU data centers = cross-border transfer under PDPL 2025; pricing scales with data volume — Tet 10-20x traffic = 10-20x APM bill; overkill for Phase 1 (~200 bookings/day) |
| **Self-hosted open-source stack (Grafana + Loki + Tempo + Prometheus)** | Full data sovereignty — deploy on Vietnam-hosted infrastructure; zero per-ingestion cost; customizable dashboards | High operational burden for a small team where "speed to market" is an explicit constraint; requires DevOps expertise the team doesn't have; infrastructure management distracts from Series A feature velocity |
| **Vercel-native observability (Analytics + Logs + OTel)** | Zero-config for Next.js; integrated with deployment pipeline; Speed Insights for Core Web Vitals | Limited to Vercel-hosted compute; no custom metrics for business KPIs; logs retain only 1-24h on free/Pro; no alerting beyond deployment failures; data stored in Vercel infrastructure (US) = cross-border concern |
| **Minimal: BetterStack (uptime) + structured JSON logs to PG + Sentry (errors)** | External uptime probe satisfies 2-minute detection target; structured logs queryable via SQL for support agent booking lookup; Sentry captures unhandled exceptions with stack traces; all critical business data stays in Vietnam-hosted PG; cost ~$0-30/mo at Phase 1; scales linearly | No distributed tracing (acceptable — single-service monolith); no pre-built APM dashboards (mitigated by custom admin dashboard); Sentry sends error payloads to US (must redact PII before capture) |

**Choice**: Minimal: BetterStack (uptime) + structured JSON logs to PG + Sentry (errors)

**Reasons**:
- Data localization is the gate constraint. Any observability platform that ingests unredacted log lines offshore constitutes a cross-border transfer requiring CDTIA filing and explicit per-transfer consent (regulatory/data-privacy.md). Keeping structured business data in the Vietnam-hosted PG database avoids this entirely
- Phase 1 revenue is ~$220/day from ~200 bookings/day. Full APM at $100-500/mo exceeds 15-70% of daily revenue. Financial viability at Phase 1 demands minimal observability spend (market-research/business-model.md)
- The application is a single Next.js monolith, not a distributed microservice mesh. Distributed tracing provides marginal value when every request stays in-process (vietnam-market-context.md — single-corridor proof, not multi-service platform)
- FunnelEvent, AdminAuditLog, JobRunLog, PaymentEvent, and NotificationLog already live in PostgreSQL — five of the seven observability data sources are already queryable via SQL. Building dashboards on existing tables is more cost-effective than duplicating data to an external APM (domain-model/bounded-contexts.md)
- Sentry error tracking captures unhandled exceptions with source maps, grouping, and alerting. PII redaction in the Sentry `beforeSend` hook prevents phone numbers and payment data from leaving Vietnam (domain-model/invariants-catalog.md, regulatory/dpia-checklist.md)
- Upgrade path: when Phase 3 revenue justifies it (~500 bookings/day), migrate to Grafana Cloud or self-hosted Grafana stack on Vietnam infrastructure. Structured JSON log format ensures zero-rework migration — Loki/Grafana ingest the same JSON lines PG currently stores

> **FPT Cloud Monitoring Assessment** (2026-06-19): FPT Cloud Monitoring service (v1.3) collects metrics, logs, and traces with HTTP(S) endpoint monitoring and Kubernetes integration. However: no confirmed Prometheus-compatible scrape endpoints, no confirmed Grafana integration or API for programmatic access, and no published retention periods. **Recommendation: do NOT adopt FPT Cloud Monitoring as primary observability**. Use it as a secondary infrastructure-level signal (VM CPU/memory/disk) only. Primary stack remains BetterStack + Sentry + PG-based structured logs. When Phase 3 revenue justifies dedicated observability infra, self-deploy Prometheus + Grafana + Loki on a dedicated FPT VM — this stack is fully portable and runs within Vietnam data residency.

> **IMPLEMENTATION STATUS** (2026-06-18)
> - **Documented**: BetterStack (uptime monitoring) + Sentry (error tracking) + structured JSON logs to PG.
> - **Actual**: Only stdout JSON logs via `lib/core/logger.ts` are implemented. Neither Sentry SDK nor BetterStack uptime monitoring is installed. No `@sentry/nextjs` in dependencies. No BetterStack heartbeat URL configured. `/api/health` endpoint exists but does not check Redis connectivity.
> - **Status**: `NOT_IMPLEMENTED`
> - **Tracking**: Sentry + BetterStack are zero-config additions. Add before go-live for error visibility and uptime monitoring. Add Redis check to `/api/health`.

---

### 2. PII Redaction Strategy — Field-Level Redaction at Log Serialization

| Option | Pros | Cons |
|--------|------|------|
| **No redaction (rely on access control)** | Zero engineering effort; all data available for debugging | Any log export, error report, or APM ingestion leaks PII; violates PDPL 2025 sensitive data handling; violates I9 invariant; Compliance Officer "unified PII audit log" pain point becomes unfixable |
| **Redaction at log serialization (structured logger with field-level redact list)** | PII never reaches log storage in cleartext; redact list is auditable and greppable; already partially implemented (`redactPhone.ts`, logger redaction of `otpProof`); single enforcement point; works regardless of downstream destination | Debugging production issues requires looking up redacted values separately; must maintain redact list as new PII fields are added |
| **Tokenization (replace PII with reversible tokens)** | PII recoverable for authorized debugging; tokens meaningless without mapping table | High complexity — requires token-mapping service; mapping table itself becomes a high-value attack target; overkill for a startup with <100K data subjects in Year 1 |
| **Encryption at rest in log storage** | PII protected if storage is compromised; simpler than tokenization | Doesn't prevent PII exposure in dashboards, error reports, or log search results; encrypted PII is still PII under PDPL 2025 — doesn't address cross-border transfer |

**Choice**: Redaction at log serialization (structured logger with field-level redact list)

**Reasons**:
- I9 invariant explicitly prohibits raw phone in notification payload — this principle extends to all log output (domain-model/invariants-catalog.md). `AdminAuditLog` already masks phone to last-4 digits via `redactPhone.ts` (domain-model/bounded-contexts.md). `otpProof` JWT already on the logger redact list (domain-model/ubiquitous-language.md). This decision codifies and extends existing practice
- PDPL 2025 classifies phone numbers as "basic personal data" and payment records as "sensitive personal data" (regulatory/data-privacy.md, regulatory/dpia-checklist.md). Redaction at serialization ensures neither class enters log storage or crosses borders
- Compliance Officer persona's pain point is "no single-source PII audit log across all services" (personas/admin-personas.md). Redaction makes the audit question tractable: if PII never enters logs, the PII audit scope is limited to the DB models themselves (Customer, Booking, OperatorUser), not an unbounded log corpus
- The redact list must include: `phone`, `email`, `otpProof`, `customerName`, `buyerName`, `buyerPhone`, `buyerEmail`, `codeHash`, `password`, `passwordHash`, `tempPasswordPlain`, `accountNumber`, `holderName`, `taxCode`, `cccd`. Any field added to a PII-bearing model must be added to the redact list in the same commit
- Tokenization rejected: PDPL 2025 requires "appropriate security measures" — field-level redaction at serialization satisfies this for log data, and DB-level encryption at rest covers stored PII. Tokenization infrastructure exceeds what regulations require (regulatory/data-privacy.md, regulatory/dpia-checklist.md)

---

### 3. Audit Trail Architecture — Domain-Partitioned with Federated Admin Search

| Option | Pros | Cons |
|--------|------|------|
| **Unified audit table (single AdminAuditLog for all actions)** | Simple query model — one table; Compliance Officer gets "single-source audit log" | Grows unbounded (10-year e-invoice retention = millions of rows); mixes low-value operational logs with high-value compliance records; single schema limits action-type-specific fields |
| **Domain-partitioned audit (existing multi-model approach)** | Each domain's audit trail has purpose-specific schema and indexes; immutability triggers already on three critical models; Finance Manager queries LedgerEntry directly for reconciliation; no schema changes needed | No single "search everything" interface — Compliance Officer must know which table to query; cross-domain correlation requires joining multiple tables |
| **Event store (append-only event log as source of truth)** | Complete history; can replay to any point; domain events captured uniformly | Already rejected in ADR-005 Decision 5 — "bounded set of entry types with known semantics doesn't benefit from event-store infrastructure complexity"; adds infrastructure the small team cannot maintain |
| **External audit SaaS (Drata, Vanta)** | SOC 2 readiness out of the box; pre-built compliance reports | US-hosted = cross-border transfer of audit data; cost prohibitive for Phase 1; Vietnam-specific regulations (PDPL, Decree 123 e-invoice) not covered by US-focused compliance platforms |

**Choice**: Domain-partitioned audit (existing multi-model approach) + admin "audit search" view that federates across tables

**Reasons**:
- The existing architecture already has seven domain-specific audit models: AdminAuditLog, LedgerEntry, ConsentRecord, PaymentEvent, FunnelEvent, NotificationLog, JobRunLog. Three have DB-level immutability triggers. Replacing this with a unified table would require migrating existing data and losing domain-specific indexing (domain-model/bounded-contexts.md, domain-model/invariants-catalog.md)
- Finance/Accounting Manager persona requires "ledger reconciliation view" and "payout queue dashboard" — these are direct SQL queries against LedgerEntry and Payout, not queries against a generic audit log (personas/admin-personas.md)
- Compliance Officer's "no single-source PII audit log" pain point (personas/admin-personas.md) is solved by an admin search view that federates queries across AdminAuditLog, LedgerEntry, ConsentRecord, and NotificationLog. This is a read-model concern, not a storage-model concern
- 10-year archival for e-invoices (regulatory/einvoice-tax.md) and 5-year for booking/payment records (regulatory/dpia-checklist.md) require tiered retention. Domain-partitioned tables allow per-table retention policies — a single unified table makes tiered retention harder
- Event store rejected for the same reason as ADR-005 Decision 5: bounded set of entry types with known semantics doesn't benefit from event-store infrastructure complexity (domain-model/bounded-contexts.md)

---

### 4. Funnel & Business Analytics — Server-Side FunnelEvent in PG

| Option | Pros | Cons |
|--------|------|------|
| **External analytics (Google Analytics / Mixpanel / Amplitude)** | Rich funnel visualization, cohort analysis, A/B testing out of the box; industry standard; marketing tool integrations | Sends user behavior data to US servers = cross-border transfer requiring CDTIA filing + explicit consent (regulatory/data-privacy.md); cookie consent required before tracking; adds JS bundle weight on data-plan-conscious users (personas/customer-personas.md, Persona 6 "Em Quan") |
| **Server-side FunnelEvent in PG (existing model)** | No client-side JS; no cookie consent needed (server-side, no PII by design); data stays in Vietnam-hosted PG; zero additional cost; already built; sessionId is anonymous | No pre-built funnel visualization — requires custom admin dashboard; no client-side interaction tracking (scroll depth, time on page); no A/B test framework |
| **Privacy-preserving analytics (Plausible / Umami self-hosted)** | Cookie-free by design; lightweight script (<1KB); can self-host on Vietnam infrastructure; pageview + referrer + UTM tracking | Still requires hosting and maintenance; pageview-level only, not business-event-level; doesn't replace server-side FunnelEvent for business metrics |
| **Hybrid: server-side FunnelEvent + lightweight client analytics** | Server-side captures business conversion funnel; client-side captures user engagement; best of both; cookie-free client analytics avoids consent burden | Two analytics systems to maintain; data reconciliation challenges between server and client event counts |

**Choice**: Server-side FunnelEvent in PG as primary, with optional Plausible/Umami for client-side page analytics when budget permits

**Reasons**:
- FunnelEvent already captures the four conversion stages mapping directly to investor KPIs: `search_performed` → `hold_created` → `payment_initiated` → `booking_paid`. Search-to-booking conversion (8-15% target) is directly computable from these four events (domain-model/bounded-contexts.md, personas/investor-kpis.md)
- Repeat booking rate (>40% target) is computable from the Booking table directly. DAU/MAU (15-25% target) derivable from Customer session activity or FunnelEvent daily unique sessionIds. Payment abandonment (<25% target) = `(payment_initiated - booking_paid) / payment_initiated`. All investor KPIs computable without external analytics (personas/investor-kpis.md)
- FunnelEvent is keyed by anonymous `sessionId` with no PII stored (domain-model/bounded-contexts.md). This eliminates cookie consent requirements for the primary analytics pipeline — PDPL 2025 consent is required for client-side cookie tracking, not server-side anonymous instrumentation (regulatory/dpia-checklist.md)
- External analytics rejected as primary because: (a) CDTIA filing required for cross-border behavioral data transfer (regulatory/data-privacy.md); (b) explicit per-purpose consent for analytics required (regulatory/dpia-checklist.md); (c) "Em Quan" student persona is "data-plan conscious (prepaid mobile)" — heavy analytics JS hurts this segment (personas/customer-personas.md)
- Client-side Plausible/Umami is optional for page-level engagement metrics (bounce rate, referrer attribution) once the team has capacity. Self-hosted on Vietnam infrastructure avoids cross-border concerns

---

### 5. Payment Observability — Full Pipeline Monitoring (5 Vectors)

| Option | Pros | Cons |
|--------|------|------|
| **Webhook-level monitoring only (count successes/failures per PSP)** | Simple; covers the primary failure mode (webhook delivery failure); easy to build on existing PaymentEvent table | Doesn't detect amount mismatches, replay storms, or reconciliation drift; doesn't track settlement timing; doesn't alert on VietQR memo truncation |
| **Full payment pipeline monitoring (webhook + reconciliation + settlement + anomaly detection)** | Covers all five payment risk vectors: (1) webhook delivery failure, (2) HMAC verification failure (forgery attempt), (3) amount mismatch (underpay/overpay), (4) VietQR memo-match failure, (5) settlement timing drift. Each vector maps to a specific business risk with documented severity | More complex; requires monitoring across PaymentEvent, LedgerEntry, and Payout models; requires defining "normal" baselines for anomaly detection |
| **PSP-provided monitoring dashboards** | Zero build effort; PSP has full visibility into their side | No visibility into BB-side processing failures; no cross-PSP unified view; PSP dashboards don't show booking-level correlation; PSP doesn't know about VietQR memo truncation (BB-side reconciliation failure) |

**Choice**: Full payment pipeline monitoring (webhook + reconciliation + settlement + anomaly detection)

**Reasons**:
- Risk #8 (risk-matrix.md): "VietQR payment reconciliation failure (memo truncation, user mistype)" rated HIGH likelihood × HIGH impact. "Keep orderRef under 25 chars; build reconciliation dashboard in admin; recon sweeper must flag unmatched payments." Monitoring must track unmatched VietQR payments specifically
- Stakeholder map rates NAPAS/bank transfer as CRITICAL infrastructure: "Bank transfer not reconciled = money received but no ticket = worst customer experience." SePay webhook is primary confirmation (5-30s); memo truncation remains a risk for the ~5% mismatch rate. MoMo: "IPN failure codes mis-mapped = legitimate payments marked failed = revenue loss." VNPay: "Incorrect return URL handling = payment confirmed by VNPay but booking never updated = double charges on retry" (stakeholder-map.md)
- Payment anomaly detection target from ADR-002 Section I: "≤5 minutes — webhook volume drop >50% from 15-min rolling average." This requires tracking webhook volume as a time series, which webhook-level counting alone does not provide
- Finance/Accounting Manager persona daily workflow (personas/admin-personas.md): "Morning: check overnight payment settlements (VNPay T+1, MoMo T+1 reconciliation files)." Monitoring must surface settlement discrepancies proactively, not wait for manual morning review
- Specific metrics to monitor (derived from domain-model/event-flows.md, domain-model/invariants-catalog.md):
  - Webhook volume per PSP per 15-min window (anomaly detection baseline)
  - HMAC verification failure count (forgery detection)
  - P2002 duplicate count per PSP (replay volume — informational, not error)
  - Amount mismatch count (underpay rejected + overpay logged)
  - Unmatched VietQR payments (money received, no matching booking)
  - Payout failure rate per operator (>5% triggers alert)
  - Settlement timing: actual settlement date vs expected `completedAt + 1 day`

---

### 6. Alerting Hierarchy — Dynamic Severity Tiers (P1-P4) with Tet-Aware Adaptive Thresholds

| Option | Pros | Cons |
|--------|------|------|
| **Flat alerting (all alerts equal priority, single channel)** | Simplest to implement; no severity classification needed | Alert fatigue at scale; Tet surge triggers hundreds of "normal high traffic" alerts; on-call cannot distinguish "site down" from "one operator's trip has low bookings" |
| **Static severity tiers (P1-P4, fixed thresholds)** | Clear escalation path; each tier has defined SLA and notification channel; matches industry practice | Fixed thresholds break during Tet — 10x normal traffic trips all thresholds; off-peak anomalies go undetected below fixed minimum |
| **Dynamic severity tiers (P1-P4 with Tet-aware adaptive thresholds)** | Tet surge (10-20x) doesn't trip "high traffic" P3 alerts; off-peak anomalies detectable via percentage-based deviation from rolling baseline; seasonal pre-positioning documented | More complex threshold logic; initial thresholds are educated guesses until real Tet data; requires baseline calibration |
| **ML-based anomaly detection** | Automatic threshold learning; detects novel failure patterns; no manual tuning | Requires training data the platform doesn't have yet (pre-launch); black-box alerting harder to debug; small team cannot maintain ML pipeline; overkill for Phase 1 |

**Choice**: Dynamic severity tiers (P1-P4) with Tet-aware adaptive thresholds

**Reasons**:
- Tet surge is 10-20x normal traffic concentrated in 2-3 weeks (risk-matrix.md). Static thresholds set for normal traffic fire constantly during Tet (every metric exceeds normal bounds). Static thresholds set for Tet miss off-peak anomalies
- "Permanent customer defection on failure" during Tet (risk-matrix.md) and "customers post instantly to social media" (market-research/user-insights.md) mean P1 response time during Tet is more critical than during normal operations — escalation must be faster during Tet window

**Tier definitions** (sourced from business doc risk ratings):

| Tier | Criteria | Examples | Notification | Response SLA |
|------|----------|----------|-------------|-------------|
| **P1 Critical** | Service fully down OR payment pipeline halted OR data breach detected | Site unreachable (risk-matrix.md); all webhooks failing >5min (stakeholder-map.md); suspected PII breach (regulatory/dpia-checklist.md) | Immediate push + phone call | 15 min ack, 1 hr resolution |
| **P2 High** | Partial degradation OR single PSP down OR payout pipeline stalled | One PSP webhook volume drops >50% from baseline (ADR-002 Section I); payout failure rate >5%; eSMS delivery failures >10% (regulatory/telecom-sms.md) | Push notification | 30 min ack, 4 hr resolution |
| **P3 Medium** | Performance degradation OR elevated error rates | p95 latency >500ms for search API (ADR-002 Section B); hold creation >400ms; error rate >1% | Chat notification | 2 hr ack, 24 hr resolution |
| **P4 Low** | Informational / trend deviation | Conversion rate drops below 8% for 24h (personas/investor-kpis.md); daily booking volume deviates >30% from trailing 7-day average; JobRunLog shows cron missed execution | Daily digest | Next business day |

**Tet-window overrides**:
- P2 response SLA tightens to P1 levels (15 min ack)
- All deployment gates freeze
- Threshold baselines switch to Tet-calibrated values (first Tet provides calibration data; pre-Tet: use 10x multiplier on normal baselines per risk-matrix.md upper bound estimate)

---

### 7. Log Retention & Archival — 5 Regulatory-Aligned Tiers

| Option | Pros | Cons |
|--------|------|------|
| **Uniform retention (keep everything forever)** | Simplest; no data lifecycle management | Storage costs grow unbounded; violates PDPL 2025 data minimization principle; 24-month maximum for PII data after service cessation; retention of PII beyond stated purpose is a regulatory violation |
| **Single-tier retention (delete everything after N months)** | Simple lifecycle; one policy to manage | Cannot satisfy both 90-day OTP log retention (ADR-003) and 10-year e-invoice archival (regulatory/einvoice-tax.md) with a single N value |
| **Tiered retention aligned with regulatory requirements** | Each data category retained exactly as long as law requires and no longer; satisfies data minimization; audit-defensible; per-table policies map cleanly to domain-partitioned audit tables | More complex lifecycle management; requires automated sweep jobs per tier; tier boundaries must be maintained as regulations change |
| **Cold storage archival (hot/warm/cold tiers)** | Optimizes storage cost for old data; warm data queryable, cold data restorable | Adds infrastructure complexity (object storage + restore pipeline); cold data not queryable for Compliance Officer ad-hoc requests; over-engineers for Phase 1 PG database size |

**Choice**: Tiered retention aligned with regulatory requirements

**Reasons**:
- Five distinct retention periods mandated by regulation:

| Tier | Retention | Data | Regulatory Source |
|------|-----------|------|-------------------|
| T1 Security ephemeral | 90 days | OTP attempt logs, session tokens | Internal policy; codified in ADR-003 |
| T2 Operational | 24 months | Application logs, FunnelEvent, JobRunLog, NotificationLog | PDPL 2025 minimum PII retention after service cessation (regulatory/data-privacy.md) |
| T3 Financial | 5 years | Booking records, LedgerEntry, Payout, PaymentEvent | Accounting Law (regulatory/dpia-checklist.md) |
| T4 Tax / e-invoice | 10 years | EInvoice records, tax summaries, commission invoices | Decree 123/2020 + Decree 70/2025: "10-year archival in original electronic form" (regulatory/einvoice-tax.md) |
| T5 Compliance records | 5 years post-breach / indefinite during active complaints | Breach records, DSAR handling logs, ConsentRecord | PDPL 2025: "Retain breach records 5 years" (regulatory/data-privacy.md); consent audit trail for duration of consent + 1 year (regulatory/dpia-checklist.md) |

- Uniform retention violates PDPL 2025's data minimization principle: data must not be retained beyond its stated purpose and legal requirement. Retaining OTP logs for 10 years when the regulatory requirement is 90 days creates unnecessary PII exposure (regulatory/data-privacy.md)
- Domain-partitioned audit tables (Decision 3) enable per-table retention policies. Each table maps to exactly one retention tier. Sweep jobs can target individual tables without cross-table dependency
- T4 cold archival: EInvoice records older than 5 years can be migrated to compressed PostgreSQL partitions or object storage. The 10-year mandate requires "original electronic form" preservation but not real-time queryability. This is a Phase 3+ concern (regulatory/einvoice-tax.md)

---

## Consequences

### Positive
- PII never enters log storage in cleartext — structurally eliminates the category of breach that triggers 72-hour notification to MPS (regulatory/data-privacy.md, regulatory/dpia-checklist.md)
- Payment pipeline monitoring covers all five documented risk vectors (webhook failure, HMAC forgery, amount mismatch, VietQR reconciliation, settlement drift) — directly addresses Risk #8 (risk-matrix.md) and three CRITICAL stakeholder risks (stakeholder-map.md)
- Tet-aware dynamic thresholds prevent alert fatigue during 10-20x surge while still detecting anomalies during off-peak — Tet failure = permanent defection (risk-matrix.md)
- Tiered retention satisfies five distinct regulatory timelines with no over-retention — defensible in PDPL audit and GDT e-invoice inspection
- All investor KPIs (conversion, DAU/MAU, repeat rate, payment failure rate) computable from existing PG tables without external analytics dependency — Series A data room built from production DB, not third-party dashboards (personas/investor-kpis.md)
- Minimal cost at Phase 1 (~$0-30/mo for BetterStack + Sentry free tier) preserves unit economics where net margin per booking is ~16,000 VND (market-research/business-model.md)

### Negative
- No distributed tracing — debugging cross-module issues requires correlating structured log entries manually via request ID (mitigated: single Next.js monolith, not microservices; cross-module spans are function calls, not network hops)
- No pre-built APM dashboards — custom admin dashboards must be built for Finance Manager reconciliation view and Compliance Officer audit search (mitigated: these dashboards are already planned as part of admin console per personas/admin-personas.md)
- Sentry free tier limits to 5K errors/month and 10K replays — Tet surge error volume may exceed free tier (mitigated: upgrade to Team plan at $26/mo if Tet error volume warrants; Tet is also the revenue peak that funds it)
- First Tet dynamic thresholds are calibrated by estimation (10x multiplier from risk-matrix.md), not historical data — may under- or over-alert (mitigated: post-Tet retrospective recalibrates all thresholds with real data)
- Redact list maintenance burden: every new PII field added to any model must be added to the logger redact list in the same commit

### Mitigations
- No tracing: add request-scoped `correlationId` to all log entries, enabling grep-based trace reconstruction. When Phase 3 traffic justifies tracing, adopt OpenTelemetry instrumentation exporting to Grafana Tempo on Vietnam infrastructure
- No APM dashboards: admin console "System Health" page queries FunnelEvent, PaymentEvent, NotificationLog, JobRunLog directly. Finance Manager "Reconciliation" page queries LedgerEntry + Payout. Both are planned features, not net-new infrastructure (personas/admin-personas.md)
- Sentry overflow: configure sampling rate to 50% during Tet; error grouping ensures unique issues are captured even if individual occurrences are sampled
- Threshold calibration: pre-Tet load test at 2,000 concurrent (risk-matrix.md target) establishes baseline metrics. Post-Tet retrospective recalibrates all thresholds with real data
- Redact list drift: add a `pii-redact-check` CI step that compares Prisma schema PII-annotated fields (tagged with `/// @pii` comment) against the logger redact config. Schema fields tagged `@pii` must appear in the redact list

---

## References

All decisions sourced exclusively from `documentation/business/`:

| Document | Cited In |
|----------|----------|
| risk-matrix.md | D1, D5, D6 |
| regulatory/data-privacy.md | D1, D2, D4, D7 |
| regulatory/dpia-checklist.md | D1, D2, D4, D7 |
| regulatory/einvoice-tax.md | D3, D7 |
| regulatory/telecom-sms.md | D6 |
| domain-model/bounded-contexts.md | D1, D2, D3, D4 |
| domain-model/invariants-catalog.md | D1, D2, D5 |
| domain-model/ubiquitous-language.md | D2 |
| domain-model/event-flows.md | D5 |
| personas/admin-personas.md | D2, D3, D5, Consequences |
| personas/investor-kpis.md | D4, D6, Consequences |
| personas/operator-personas.md | Context |
| personas/customer-personas.md | D4, D6 |
| market-research/business-model.md | D1, Consequences |
| market-research/user-insights.md | D6 |
| stakeholder-map.md | D5 |
| vietnam-market-context.md | Context, D1 |
