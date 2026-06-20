# DS-004 -- API Versioning

## 1. Overview

This document defines the API versioning strategy for the BusBooking platform — a multi-tenant Vietnam bus booking marketplace built on Next.js App Router (same-origin, cookie-based auth, no separate API gateway). The platform serves three auth realms (Customer, Operator, Admin), integrates with Vietnamese PSPs (VNPay, MoMo), and must comply with PDPL 2025, Decree 70/2025 (e-invoicing), and E-Commerce Law 2025. The versioning strategy must balance regulatory data-format retention (10-year e-invoice archival), operator integration stability (enterprise SLA expectations from 200+ bus fleets), and the engineering reality of a monolithic same-origin deployment with forward-only migrations.

**Source ADRs.** This document synthesizes decisions from ADR-001 (Stack), ADR-002 (NFR Targets), ADR-003 (Auth), ADR-004 (Multi-Tenancy), ADR-005 (Payment), ADR-006 (Pricing/Currency), ADR-008 (Security), ADR-014 (E-Invoice), ADR-015 (Error Contract), ADR-016 (Module Boundaries), ADR-017 (Migration Safety), ADR-019 (State Machines), ADR-020 (Deployment). Cross-reference 01-data-model-design for entity schemas, 02-migration-strategy for schema evolution rules, 03-api-contract for the current API surface.

---

## 2. Versioning Model

### 2.1 Decision: Stability-Contract Model (No URL Versioning)

The platform uses a **stability-contract model** rather than URL-prefixed versioning (`/api/v1/`, `/api/v2/`). This means:

- No `/api/v1/` prefix on any route.
- No `Accept: application/vnd.busbooking.v1+json` content negotiation.
- No `API-Version` request header.
- The single API surface evolves via additive non-breaking changes and two-phase removals.

**Rationale.** Same-origin architecture (Next.js serves both frontend and API from one deployment) means the frontend and API always deploy together. There is no external API consumer at Stage 0 — all three portals (customer, operator, admin) are first-party. URL versioning adds routing complexity with no consumer to benefit from it. When external consumers arrive (agent/reseller API at Month 12+, OTA white-label at Year 2), a versioned external gateway will be introduced as a separate concern (see §8).

**Source:** ADR-001 D1 (single deployment), ADR-020 D1 (Vercel serverless, no API gateway at Stage 0).

### 2.2 Stability Tiers

Every API endpoint, response field, error code, and webhook contract is classified into one of three stability tiers:

| Tier | Label | Contract | Removal Process | Examples |
|------|-------|----------|----------------|----------|
| **S1** | Stable | Will not be removed or have semantics changed without a formal deprecation cycle (§5) | Minimum 90-day deprecation + migration guide | `error.code` values, `BookingStatus` enum, `bookingRef` format, webhook HMAC contract, `operatorId` JWT claim, pagination cursor shape |
| **S2** | Evolving | Additive changes at any time; removal follows two-phase deploy (§4.2) | Phase A (code removal) + Phase B (schema drop), minimum 30-day notice | New response fields, new optional query params, new error codes, new state machine states |
| **S3** | Unstable | May change without notice | None required | `error.message` text, response field ordering, internal header values, non-documented response fields |

**Classification rule:** A field, code, or contract is S1 if any of these apply:
- External systems parse it (PSP webhooks, MISA e-invoice payloads, operator ERP integrations).
- Regulatory retention mandates apply (LedgerEntry fields: 10 years; Booking fields: 5 years; ConsentRecord fields: consent duration + 1 year).
- Clients switch control flow on it (`error.code`, status enums, `alreadyCancelled` discriminator).
- Security middleware reads it (JWT claims consumed at Edge).

Everything else defaults to S2 unless explicitly marked S3 in the API contract doc.

**Source:** ADR-015 D1 (error code = stable, message = unstable), ADR-017 D2 (two-phase destructive changes), ADR-005 D3 (webhook idempotency constraints).

---

## 3. Non-Breaking Change Policy

### 3.1 Always Non-Breaking (Ship Without Coordination)

| Change Type | Why Non-Breaking | Constraint |
|-------------|-----------------|------------|
| New optional response field | Clients ignore unknown fields | Must not leak internal/filter-only columns (I001 lesson: `salesClosed` leaked) |
| New endpoint | No existing client calls it | Must follow namespace conventions (§2.2 of 03-api-contract) |
| New `error.code` value | Clients have default/fallback handlers | Must not reuse a retired code |
| New state machine state (enum value) | Additive to union | DTO union, `LEGAL_*_TRANSITIONS` map, and positive test assertion must land in same commit (ADR-019 D5) |
| New optional query parameter | Absent = previous behavior | Default must preserve current behavior |
| New webhook event type | Receivers ignore unknown types | Must follow existing HMAC + idempotency patterns |
| Stricter server-side validation | Rejects previously-invalid input | Must not reject previously-valid input |
| New ledger entry type | Append-only; existing types unchanged | Must coordinate with `calcBalance` and payout logic |

### 3.2 Always Breaking (Requires Deprecation Cycle)

| Change Type | Why Breaking | Mitigation |
|-------------|-------------|------------|
| Remove or rename response field | Client reads fail | Two-phase removal (§4.2) |
| Remove or rename `error.code` | Client switch-case misses | 90-day deprecation (§5) |
| Change HTTP status code for existing error | Client error-handler routing breaks | Spec conflict resolution first (§3.4) |
| Remove endpoint | Client calls 404 | 90-day deprecation with `Sunset` header |
| Change `bookingRef` format | Payment lookup, customer display, VietQR memo (≤25 chars) break | Never — format is S1 frozen |
| Change JWT claim shape | Edge middleware reads break | Coordinated deploy: new claim in token → deploy middleware → remove old claim |
| Change webhook HMAC algorithm or payload shape | PSP integration breaks | PSP re-approval (5–15 business days VNPay/MoMo) required |
| Change currency representation (VND integer → decimal) | Payout calculation drift (BigInt invariant) | Never — VND minor-unit integers are S1 frozen |
| Modify `FAILURE_RESULT_CODES` set | State machine mis-transitions | Only via new issue AC with explicit additions |

### 3.3 Conditionally Breaking (Context-Dependent)

| Change | When Non-Breaking | When Breaking |
|--------|-------------------|---------------|
| Add required request field | New endpoint only | Existing endpoint — existing clients omit it |
| Widen status enum | When clients have fallback | When raw SQL `WHERE status IN (...)` doesn't include new value |
| Change pagination default `limit` | If clients specify their own `limit` | If clients rely on default |
| Tighten rate limit | If current usage is below new limit | If operators hit the new limit |

### 3.4 Spec Conflict Resolution

When two endpoints assign different HTTP status codes to the same `error.code` (e.g., `BUS_OVERLAP_WITH_OUTBOUND` = 422 in `pairedReturn` vs 409 in `reassignBus`), follow this protocol:

1. Implement both per their respective AC text verbatim.
2. Add inline `// SPEC CONFLICT:` comment at each divergent site naming the other.
3. File a follow-up issue to canonicalize one status code.
4. The resolution issue is a **breaking change** for whichever endpoint changes — apply §5 deprecation to the affected code.

**Source:** Mistake Log Issue 013 (status code divergence).

---

## 4. Change Execution Protocols

### 4.1 Additive Changes (Non-Breaking)

Standard deploy. No special coordination. Commit checklist:

- [ ] New response field added to DTO interface (`lib/<domain>/to*Dto.ts`).
- [ ] Field NOT in `select` whitelist unless it is a UI-contract field.
- [ ] New enum value added to DTO status union in same commit.
- [ ] New PII field added to logger redaction list (`phone`, `email`, etc.) in same commit.
- [ ] New T2 field encrypted with AES-256-GCM from introduction (no retroactive path).
- [ ] DPIA amendment filed within 10 days if new field is a PII data category (PDPL 2025 / Decree 356/2025).

### 4.2 Two-Phase Removal (Breaking — Schema)

For removing a DB column, table, or constraint that backs an API response field:

**Phase A — Code Removal Deploy:**
1. Remove all code references to the deprecated field/column.
2. Remove field from DTO interface and response serialization.
3. Update all `prisma.<model>.create` / `INSERT INTO` call sites across `lib/`, `app/`, `e2e/`, `prisma/seed.ts`, `__tests__/`.
4. Deploy. Verify no runtime reference to the field.

**Phase B — Schema Drop Deploy (separate PR, minimum 1 deploy cycle later):**
1. New forward migration: `ALTER TABLE DROP COLUMN` / `DROP TABLE` / `DROP CONSTRAINT`.
2. Update `schema.prisma` to remove the declaration.
3. Verify schema-parity (read current Prisma CLI `migrate diff` help for valid flags — do not copy stale commands from prior Mistake Log entries).

**Regulatory gate:** Columns on `LedgerEntry`, `PaymentEvent`, `EInvoice`, `AdminAuditLog`, `ConsentRecord` cannot enter Phase B while within their retention window (10 years for financial/e-invoice, 5 years for booking, consent duration + 1 year for consent). Phase A (stop writing) is permitted; Phase B (drop) requires retention expiry.

**Source:** ADR-017 D1 (forward-only), ADR-017 D2 (two-phase destructive), Mistake Log Issue 020 (constraint removal via forward migration).

### 4.3 JWT Claim Evolution

JWT claims are read at Edge middleware (stateless, no DB). Claim changes require a coordinated two-deploy sequence:

**Adding a claim:**
1. Deploy 1: Add claim to token minting. Middleware treats absence as default (backward-compatible).
2. Deploy 2 (optional): Middleware now requires the claim. Safe because all tokens minted after Deploy 1 carry it, and `ACCESS_TTL_SECONDS=900` (15 min) means pre-Deploy-1 tokens have expired.

**Removing a claim:**
1. Deploy 1: Middleware stops reading the claim. Token minting still includes it (harmless).
2. Deploy 2: Remove claim from token minting.

**Changing claim semantics:**
Never change the meaning of an existing claim. Introduce a new claim with the new semantics; deprecate the old one via the two-deploy removal process above.

**Window:** The 15-minute access token TTL (`ACCESS_TTL_SECONDS=900`) defines the maximum overlap window. After Deploy 1, wait ≥15 minutes before Deploy 2 to ensure all old-format tokens have expired.

**Source:** ADR-003 D2 (JWT structure), Mistake Log Issue 010 (`requiresPasswordChange` claim in JWT).

### 4.4 State Machine Transition Changes

State machine transitions are the most coupling-dense API contract. Changes require coordinated updates across multiple artifacts:

| Artifact | Must Update | Greppable Check |
|----------|-------------|----------------|
| Service function (`lib/<domain>/*.ts`) | `throw` path for new error code | `grep '<ErrorCode>' lib/<domain>/` |
| `LEGAL_*_TRANSITIONS` map | New state in predecessor/successor sets | Read map; verify bidirectional consistency |
| DTO status union (`*Dto.ts`) | New status string literal | tsc `--noEmit` catches missing union member |
| Raw SQL guards (`$queryRaw`) | `WHERE status IN (...)` must include new value | `grep 'status.*IN' lib/` |
| Timestamp co-write | `<verb>At` column + `status:` in same `tx.model.update` | Within 3 lines of each other |
| Integration test | Positive assertion on new status value | `expect(*.status).toBe('<new>')` |
| E2e spec | Status assertion updated | `grep 'toBe.*<old_status>' e2e/` |

All artifacts must land in the same commit. A status value added to the union but never thrown is dead code and a silently un-enforced AC.

**Source:** ADR-019 D5, Mistake Log Issues 013 (pairedReturn dead variant), 014 (status + timestamp co-write).

---

## 5. Deprecation Lifecycle

### 5.1 Deprecation Signals

When a field, endpoint, or error code enters deprecation:

| Signal | Where | Example |
|--------|-------|---------|
| `Sunset` HTTP header | Response header | `Sunset: Thu, 01 Sep 2026 00:00:00 GMT` |
| `Deprecation` HTTP header | Response header | `Deprecation: true` |
| Inline code comment | Source file | `// DEPRECATED(2026-09-01): use newField instead` |
| Changelog entry | `CHANGELOG.md` | Dated entry with migration instructions |
| Console warning (operator) | Operator dashboard | Banner for deprecated API features operators consume |

### 5.2 Deprecation Windows

| Consumer Class | Minimum Notice | Rationale |
|----------------|---------------|-----------|
| Internal (first-party portals) | 0 days (same deploy) | Frontend and API deploy together |
| Operator ERP integrations (MISA sync, custom booking forms) | 60 days | Mid-tier operators need ≥1 accounting cycle to adapt |
| Enterprise operator API consumers (FUTA-scale, 200+ buses) | 90 days (contractual) | Enterprise SLA expectation; contract term |
| PSP webhook contracts (VNPay, MoMo) | N/A — requires PSP re-approval | 5–15 business day approval cycle; coordinate with PSP |
| Regulatory-mandated fields (e-invoice, consent) | N/A — cannot deprecate within retention window | 10-year retention for e-invoices; consent duration + 1 year |

### 5.3 Deprecation-to-Removal Sequence

```
Day 0:   Add Sunset + Deprecation headers. Changelog entry. Console warning if operator-facing.
         New replacement field/endpoint available in same deploy.
Day 1–N: Monitor usage of deprecated path (structured log: `deprecated_field_accessed`).
Day N:   Sunset date reached. Phase A deploy: remove code references.
Day N+1: Phase B deploy: remove schema construct (if applicable).
```

Usage monitoring is critical: if any operator is still hitting the deprecated path at Day N, extend the window and contact them directly. Silent removal of a path an operator depends on is a churn event — the competitive analysis shows operators multi-home and will reallocate inventory to VeXeRe/redBus if trust erodes.

**Source:** Competitor benchmark (operator-sentiment.md: "settlement disputes or cash flow squeezes — delayed or disputed payouts erode trust faster than high commission").

---

## 6. Immutable Contracts (S1-Frozen)

These contracts are permanently frozen and cannot be versioned away. Any change requires a new parallel contract, not a mutation of the existing one.

### 6.1 Data Format Invariants

| Contract | Frozen Value | Regulatory/Business Reason |
|----------|-------------|---------------------------|
| Currency representation | VND integer (no decimals), BigInt arithmetic | Payout calculation integrity; `BigInt` domain arithmetic prevents representation drift (Mistake Log Issue 016) |
| `bookingRef` format | `BB-YYYY-[0-9a-z]{4}-[0-9a-z]{4}` (18 chars) | VietQR memo ≤25 chars; payment webhook lookup key; customer-facing printed ticket; 5-year booking retention |
| LedgerEntry immutability | Append-only; `BEFORE UPDATE/DELETE` trigger | Double-entry accounting integrity; 10-year financial record retention |
| PaymentEvent idempotency | `@@unique([adapter, providerTxnId])` | Webhook replay safety; P2002 = return 200 immediately |
| ConsentRecord immutability | Append-only; `BEFORE UPDATE/DELETE` trigger; `version` field tracks policy revision | PDPL 2025 Art. 9 (pre-ticked boxes prohibited); consent duration + 1 year retention |
| AdminAuditLog immutability | Append-only; `BEFORE UPDATE/DELETE` trigger | 72-hour breach investigation window; phone masked to last 4 |
| Webhook response rule | Always HTTP 200 (except 400 for invalid HMAC) | PSP retry storm prevention |
| `operatorId` source | JWT claim only, never request body | Tenant isolation invariant (ADR-004) |

### 6.2 Error Code Taxonomy (S1)

The `error.code` values documented in 03-api-contract §5.2 are S1-stable. Clients switch control flow on these. Adding new codes is non-breaking; removing or renaming is breaking (90-day deprecation). The `error.message` field is S3-unstable and may change without notice.

### 6.3 E-Invoice Field Set (Regulatory S1)

E-invoice payloads submitted to MISA meInvoice and digitally signed by a GDT-approved provider are archived in original electronic XML form for 10 years (Decree 123/2020, Decree 70/2025). Once signed, the payload format is frozen for the invoice's archival lifetime. Field additions to future invoices are non-breaking; retrospective format changes to archived invoices are impossible.

Pending mandatory additions before go-live (Decree 70/2025): `vehiclePlateNumber`, `departureCityCode`, `destinationCityCode`, operator MST (tax code). These are additive but legally required — the current integration is non-compliant without them.

---

## 7. Regulatory Version Constraints

### 7.1 Retention-Locked Data Formats

Data retention mandates create implicit version-lock windows during which the response format for affected entities cannot undergo breaking changes, because archived records must remain parseable:

| Entity | Retention | Format Lock Implication |
|--------|-----------|----------------------|
| `EInvoice` | 10 years (Decree 123/2020) | XML payload frozen per-invoice at signing time; new invoices may use updated schema |
| `LedgerEntry` | 10 years (Accounting Law) | `entryType` enum, `amountMinor`, `sourceEventId` column names frozen |
| `PaymentEvent` | 10 years | `adapter`, `providerTxnId`, `status` columns frozen |
| `Booking` | 5 years (Accounting Law) | `bookingRef`, `totalVnd`, `status` enum frozen |
| `ConsentRecord` | Duration + 1 year (PDPL 2025) | `purpose`, `version`, `grantedAt` frozen |
| Security events | 90 days | Audit log structure must remain parseable for incident response |

### 7.2 DPIA-Triggered Version Constraints

Every API schema change that alters PII data categories, retention periods, or data recipients requires a DPIA amendment filed within 10 days (Decree 356/2025). This means:

- Adding a new PII-bearing endpoint is not just a deploy — it is a regulatory filing event.
- Removing a PII-bearing endpoint changes the data processing scope and also requires DPIA update.
- The CDTIA (Cross-border Data Transfer Impact Assessment) must be amended if new PII flows through overseas servers (Vercel sin1 Singapore = cross-border transfer under PDPL 2025).

**Practical constraint:** Batch PII-affecting API changes into quarterly DPIA update cycles rather than filing per-change. Maintain a running log of PII-scope changes between filings.

### 7.3 Hard Regulatory Deadlines Forcing API Changes

| Deadline | API Change Required | Breaking? |
|----------|-------------------|-----------|
| Before go-live | Decree 70/2025 transport e-invoice fields (plate, route, operator MST) | No — additive fields on `EInvoice` |
| Before go-live | Consumer complaint mechanism (CPL 2023 No. 19/2023/QH15) | No — new endpoints |
| Before July 2026 | E-Commerce Law 2025: tax withholding for individual operators (`tax_withheld` ledger entry, `calcWithholding()` service) | No — new ledger entry type, new payout response fields |
| Before July 2026 | E-Commerce Law 2025: 24-hour complaint response SLA field | No — additive field |
| Pending legal opinion | Consumer 3-day cancellation right (CPL 2023 Art. 29) | Potentially — new booking state + customer-initiated cancel endpoint |
| Every 6 months post-launch | DPIA update if material API schema changes occurred | Procedural, not technical |

### 7.4 PSP Contract Version Coupling

PSP integrations (VNPay, MoMo) have their own API versions that constrain platform changes:

| PSP | Version Coupling | Upgrade Path |
|-----|-----------------|--------------|
| VNPay | `vnp_Version=2.1.0` in payment URL params; HMAC SHA-512 | VNPay version upgrade requires production merchant re-approval (5–15 business days) |
| MoMo | AIO v3 endpoint (`developers.momo.vn/v3`); HMAC SHA-256 | MoMo sandbox same-day; production 5–15 days post-document submission |
| VietQR (future) | Bank-specific memo format constraints (≤25 chars) | Per-bank integration |

The `PaymentGateway` adapter interface (`lib/payment/gateway.ts`) is the anti-corruption layer: PSP-specific codes (`resultCode`, `vnp_ResponseCode`) never cross into domain code. PSP version upgrades are absorbed by the adapter; the domain API surface does not change.

**Source:** ADR-005 D2 (multi-PSP adapter), Mistake Log Issue 004 (FAILURE_RESULT_CODES pinned to spec).

---

## 8. Future: External API Versioning (Stage 2+)

### 8.1 Trigger Conditions

External API versioning becomes necessary when any of these conditions are met:

| Trigger | Expected Timeline | Source |
|---------|------------------|--------|
| Agent/reseller API launched (AMS network) | Month 12+ (Phase 4 roadmap) | market-research/strategic-roadmap.md |
| OTA white-label API (Traveloka, Klook, Agoda) | Year 2 (Phase 4 roadmap) | market-research/strategic-roadmap.md |
| Enterprise operator ERP integration API | When first 200+ bus fleet onboards | personas/operator-personas.md (FUTA-Scale persona) |
| Corporate/B2B shuttle contract API | Year 2 | market-research/strategic-roadmap.md |

### 8.2 Planned External Versioning Approach

When external consumers arrive, introduce versioning at the **API gateway layer** (not in application code):

```
External consumer → API Gateway (version routing) → Internal API (single version)
```

**URL-prefix versioning** for external APIs: `/external/v1/trips/search`, `/external/v1/bookings`. The gateway translates between the versioned external contract and the internal evolving surface.

**Design constraints from ADR-016 (Module Boundaries):**
- Each domain's barrel export (`lib/<domain>/index.ts`) is the natural service extraction boundary.
- Stage 2 service extraction (triggered when single module exceeds 50% CPU or search p95 > 200ms) means the barrel IS the versioned internal API contract.
- External API gateway maps versioned external endpoints to barrel-exported functions.

**Contract commitments for external consumers:**
- Published OpenAPI spec (required by FUTA-Scale persona: "REST API with OpenAPI spec").
- Semantic versioning on the external API surface.
- Minimum 90-day deprecation window per version.
- Published changelog with migration guides.
- Data export endpoints (operator can pull full booking/passenger data at any time — competitive differentiator vs VeXeRe's "data portability not guaranteed").

### 8.3 Competitive Positioning

The versioning strategy is a competitive differentiator. VeXeRe's operator lock-in model ("data portability not guaranteed," "custom features need separate negotiation and fees") creates an opening:

| VeXeRe | BusBooking (target) |
|--------|-------------------|
| No published API versioning policy | Published changelog + deprecation windows |
| Data portability not guaranteed | Full data export API |
| Custom features need negotiation | Self-serve API with OpenAPI spec |
| Settlement terms unpublished | T+1 settlement, published terms |

**Source:** competitor-benchmark/operator-sentiment.md.

---

## 9. Deployment Freeze Windows

### 9.1 Tet Freeze (Annual)

No deployments during the 2-week Tet window. 99.9% uptime SLA during Tet (vs 99.5% normal). All pending API changes must ship before the freeze or defer to post-Tet. This is a hard version-freeze window — no schema migrations, no new API surfaces, no PSP integration changes.

**Pre-Tet checklist:**
- [ ] All in-flight two-phase removals either completed (both phases) or deferred to post-Tet.
- [ ] No pending JWT claim changes with Deploy 2 still outstanding.
- [ ] Read replica pre-provisioned.
- [ ] 2-minute monitoring cadence activated.

**Source:** ADR-002 D2 (Tet availability), ADR-020 D4 (operational freeze).

### 9.2 PSP Maintenance Windows

VNPay and MoMo schedule maintenance windows (typically overnight Vietnam time). During these windows, payment-related API changes must not be deployed — webhook handlers may receive delayed callbacks for pre-maintenance transactions, and deploying a new handler version mid-window risks misprocessing queued webhooks.

### 9.3 MISA E-Invoice Cutover

GDT e-invoice system maintenance windows (announced by General Department of Taxation) require freezing e-invoice API changes. Invoice issuance retries must handle transient MISA unavailability without state corruption.

---

## 10. Versioning Invariant Checklist

Greppable checks to verify versioning discipline. Run before any deploy that touches API surface:

| Check | Command Pattern | Expected |
|-------|----------------|----------|
| No `operatorId` from request body | `grep -rn "body.*operatorId" app/api/op/` | Zero matches |
| No filter-only columns in response | Audit `select` whitelists in `to*Dto.ts` against UI contract | Exact match |
| No client barrel import of server module | `grep -rln "from ['\"]@/lib/auth['\"]" app components \| while read f; do head -1 "$f" \| grep -q "use client" && echo "$f"; done` | Zero matches |
| All error codes have throw paths | For each code in service error union, grep the service file for a `throw` of that code | 1:1 mapping |
| Status + timestamp co-written | Every `<verb>At` write within 3 lines of `status:` write | No orphan timestamps |
| DTO union includes all status values | tsc `--noEmit` | Zero errors |
| New PII field in redaction list | `grep '<fieldName>' lib/core/logger` | Present |
| `FAILURE_RESULT_CODES` matches AC | Diff against issue acceptance criteria | Exact match |
| `bookingRef` format unchanged | `grep 'BOOKING_REF_REGEX' lib/booking/bookingRef.ts` | `BB-\d{4}-[0-9a-z]{4}-[0-9a-z]{4}` |
| Webhook handlers return 200 | Audit all `/api/payments/*/webhook/route.ts` response paths | Only 200 or 400 (invalid HMAC) |

---

## 11. Decision Log

| # | Decision | Date | Rationale |
|---|----------|------|-----------|
| V1 | No URL-prefix versioning at Stage 0 | 2026-06-19 | Same-origin architecture; no external API consumers; routing overhead unjustified |
| V2 | Stability-contract model with S1/S2/S3 tiers | 2026-06-19 | Matches regulatory retention tiers and operator integration tolerance spectrum |
| V3 | 90-day deprecation for S1 contracts, 60-day for operator-facing S2 | 2026-06-19 | Enterprise operator persona requires contractual SLA; mid-tier needs ≥1 accounting cycle |
| V4 | E-invoice payloads frozen at signing time | 2026-06-19 | Decree 123/2020: 10-year archival in original electronic XML form |
| V5 | `bookingRef` format permanently frozen | 2026-06-19 | VietQR memo ≤25 chars + payment webhook lookup + 5-year retention + customer-facing print |
| V6 | VND integer representation permanently frozen | 2026-06-19 | BigInt arithmetic integrity; floating-point representation drift in payout calculations |
| V7 | External API gateway versioning deferred to Stage 2+ | 2026-06-19 | No external consumers until agent/reseller API (Month 12+) |
| V8 | JWT claim changes require two-deploy sequence with 15-min gap | 2026-06-19 | `ACCESS_TTL_SECONDS=900` defines token expiry window |

---

## Appendix A: Breaking Change Risk Map by Bounded Context

Ranked by blast radius and regulatory exposure:

| Context | Risk | Key Frozen Contracts | Largest Breaking-Change Scenario |
|---------|------|---------------------|--------------------------------|
| **Payment** | CRITICAL | Webhook HMAC, `FAILURE_RESULT_CODES`, `paid\|failed\|pending\|unknown` canonical status, `PaymentEvent` idempotency key | Split-settlement restructure (SBV IPS license) — rewrites payment, ledger, payout API |
| **Booking** | CRITICAL | `bookingRef` format, `BookingStatus` 8-value enum, `ConsentRecord` version, hold TTL (10 min) | Consumer 3-day cancellation right (pending legal opinion) — new terminal state |
| **Finance/Ledger** | CRITICAL | `LedgerEntry` immutability trigger, `entryType` enum, `sourceEventId` unique, `amountMinor` VND integer | Tax withholding for individual operators (July 2026 deadline) — new entry types |
| **E-Invoice** | HIGH | Signed XML payload (10-year archival), `EInvoice` status lifecycle (Circular 32/2025) | MISA issuer role determination (GDT ruling) — `seller` field changes |
| **Auth** | HIGH | JWT claims (`operatorId`, `requiresPasswordChange`, `purpose`, `jti`), cookie prefix namespaces, CSRF double-submit | Per-realm refresh token secret split (currently shared — PARTIALLY_IMPLEMENTED) |
| **Fleet/Catalog** | HIGH | `TripDto` status union, `TripDto.price` (I7 invariant), action-based endpoints | Bus overlap guard raw SQL (column renames break `$queryRaw`) |
| **Admin/Moderation** | MEDIUM | `AdminAuditLog` immutability, phone masking (last 4), DSAR statutory deadlines | DSAR API implementation (PDPL 2025 — 30-day SLA) |
| **Notification** | MEDIUM | `scheduledFor` as top-level indexed column (not JSON payload), I9 (no raw phone in payload) | ZNS channel addition (NOT_IMPLEMENTED) |

## Appendix B: Operator Integration Tolerance Matrix

| Operator Segment | Fleet Size | Integration Level | Versioning Tolerance | Required Notice |
|-----------------|------------|-------------------|---------------------|-----------------|
| Micro ("Bac Tam") | 1–5 buses | Console UI only | N/A (no API) | UI changes: immediate |
| Mid-Size ("Tinh") | 6–30 buses | MISA sync, basic API | LOW | 60+ days; cannot run parallel versions |
| Limousine/VIP ("Cao Cap") | 10–50 buses | Own booking form via API | MEDIUM | 60 days; needs backward-compatible response schemas |
| Large Fleet ("FUTA-Scale") | 200–800+ buses | Full ERP integration, OpenAPI | HIGH | 90 days contractual; API version SLA in contract |
| Cooperative/Government ("HTX") | Variable | Provincial station software | VERY LOW | Government software has fixed interfaces; long migration or parallel versions |
