# GL-001: Launch Checklist

> Status: IN_PROGRESS | References: SI-003 §14.5, SI-006, ADR-008, ADR-020, EPIC #782, Issue #769

## Purpose

Master checklist for the first production deployment (Issue 094). Every item must be checked or explicitly deferred with documented rationale before going live with real users and real money.

The **granular checklist** further down is the backing detail. The **Go/No-Go Gate** below is the concretized launch decision (issue #769): the small set of conditions that actually block Phase-1 launch, separated from what merely *should* be done and from what is *deliberately out of scope* for this launch. Phase-1 scope is a single family operator on a seed catalog (see the single-operator deferral register at the end) — several generic items above are therefore intentionally deferred, and the register records that so a future reader never mistakes a deliberate deferral for an oversight.

## Go/No-Go Gate (concretized — #769)

Legend: ✅ done · 🟡 in progress / pending merge · ⛔ blocked (external) · ☐ not started.

### HARD blockers — launch is NO-GO until every one is ✅

| # | Gate | Ref | Status |
|---|------|-----|--------|
| H1 | 4 PDPL retention migrations applied to prod **+ redact backfill run** | #762 | ⛔ blocked on Neon free-tier compute quota; runbook ready (`scripts/prod/backfill-planner-redact.ts`) |
| H2 | HD-009 financial-integrity audit PASS (append-only ledger triggers, BigInt currency, 9 entry types, `sourceEventId` uniqueness) | #765, HD-009 | ✅ |
| H3 | HD-005 tenant-isolation audit PASS (6 cross-operator entity pairs → 403/404, realm separation, no `operatorId`-from-body) | #766, HD-005 | ✅ |
| H4 | HD-006 payment-webhook audit PASS (idempotent IPN, race→exactly-one, bearer timing-safe, HMAC round-trip) | #767, HD-006 | ✅ (SePay base; VNPay addendum tracked #120/#122–124) |
| H5 | HD-011 cron-resilience subset PASS (response contract, idempotent double-invoke) | #770, HD-011 | ✅ |
| H6 | Guest planner privacy e2e green (session-only chat, never localStorage, never authed API) | #764 | 🟡 PR #801 (chromium e2e green; awaiting merge) |
| H7 | geminiAdapter unit coverage green (default prod LLM adapter) | #763 | ✅ (PR #784) |
| H8 | `bank_transfer` paid-booking e2e green (only live payment rail) | #768 | ☐ |
| H9 | Coverage blind-spot fix (trip-planner in coverage include) | #761 | ✅ |
| H10 | `pnpm test:all` + required e2e + post-deploy smoke all green on the launch commit | GL-005 | 🟡 gated on Dependency Audit (PR #802) + #801 merge |
| H11 | Admin seed password not a weak default | — | ✅ (`seed-admin.ts` uses `genTempPassword()`) |
| H12 | Payment collection model legal clearance (Decree 52/2024 thu-hộ/chi-hộ: SBV IPS license OR legal opinion) | #779, HD-006 | ⛔ user-gated (legal) |
| H13 | Cross-border disclosure legal copy human-reviewed + published | #779 | ⛔ user-gated (legal/vendor) |

### SOFT — SHOULD be done; not a launch blocker at single-operator scale

| # | Gate | Ref | Status | Rationale for non-blocking |
|---|------|-----|--------|----------------------------|
| S1 | Cut-down load/capacity check | #780 | ☐ | Single operator, seed catalog, low traffic; formal k6 deferred until a real traffic event |
| S2 | Timezone boundary suite (Asia/Ho_Chi_Minh midnight rollover) | #777 | ☐ | Business-date logic already TZ-aware in code; suite hardens against regression |
| S3 | English i18n (UI + planner + legal) merged | #640 | 🟡 | Vietnamese is the launch language; EN is additive |

### NOT required for Phase-1 launch — explicit out-of-scope (record so it is never mistaken for an oversight)

| # | Item | Ref | Why out of scope for this launch |
|---|------|-----|----------------------------------|
| N1 | Tet-2000 / peak-surge capacity | #780 | No peak event at launch; single operator |
| N2 | Chaos drills + stub-vs-real contract tests | #781 | Deferred until multi-operator / higher blast radius |
| N3 | Formal runtime a11y + Core Web Vitals measurement | #780 | Deferred with the NFR bundle; not a money/PII risk |
| N4 | MoMo / ZaloPay / card rails | #133, working-track/26–28 | Phase-1 is bank_transfer (web) + cash (operator walk-up) only |
| N5 | CSP nonce (`script-src` still `'unsafe-inline'`) | #560 | Tracked P2 security hardening; not a launch gate |
| N6 | Split-settlement payment model | #133 | Decree 52 wave-4; single bank account at launch |

**Verdict rule:** GO only when **every HARD blocker is ✅**. Each SOFT and NOT-required row must remain explicitly recorded (checked or deferred-with-rationale) — an un-annotated open item is itself a NO-GO, per the single-operator deferral discipline below.

## Skill Invocation

- **Primary**: `/launch-checklist` -- structured production readiness assessment

## Checklist

### Infrastructure (SI-006, ADR-020)

- [ ] Vercel Pro project configured (sin1 region)
- [ ] Neon database provisioned (ap-southeast-1, Launch tier)
- [ ] Neon pooled + unpooled connection strings configured (`DATABASE_URL` + `DIRECT_URL`)
- [ ] Upstash Redis provisioned (ap-southeast-1)
- [ ] `REDIS_PROVIDER=upstash` configured with Upstash REST URL + token
- [ ] Vercel environment variables configured (all secrets from `lib/config/env.ts`)
- [ ] Custom domain configured on Vercel
- [ ] Cloudflare DNS pointing to Vercel
- [ ] Cloudflare WAF Pro ($20/mo) active (optional — Vercel has built-in DDoS)
- [ ] `vercel.json` cron jobs verified (11 endpoints)

### Security (ADR-008, HD-001, HD-006, HD-010)

- [ ] HD-001 security review: **PASS**
- [ ] HD-006 payment & webhook security audit: **PASS**
- [ ] HD-010 infrastructure security audit: **PASS**
- [ ] All 6 OWASP security headers configured (KG-02)
- [ ] PayoutAccount bank details encrypted at rest (KG-03) -- verified via integration test
- [ ] Branch protection rules configured in GitHub (KG-04)
- [ ] Secrets rotation runbook documented (KG-06)
- [x] Admin seed password changed from `123456` (Fixed — seed-admin.ts uses genTempPassword())
- [ ] `tempPasswordPlain` column removed or encrypted
- [ ] Gitleaks + data-leak-audit passing in CI
- [ ] Dependabot + `pnpm audit` active in CI (KG-01)
- [ ] TOTP replay protection active (SETNX jti, 30s TTL)
- [ ] TOTP backup codes implemented (admin device-loss recovery)
- [ ] Sentry deployed and capturing unhandled exceptions
- [ ] BetterStack uptime monitoring active

### Auth & Access

- [ ] Production JWT secrets generated (not CI test values)
- [ ] CRON_SECRET generated and configured
- [ ] CSRF double-submit middleware active
- [ ] Rate limiting active on auth endpoints
- [ ] OTP lockout (3 failures → 15-min) working

### Payment -- Phase 1: Bank Transfer + Cash (ADR-005, HD-006, HD-009)

- [ ] HD-006 payment & webhook security audit: **PASS**
- [ ] HD-009 financial integrity audit: **PASS**
- [ ] `SEPAY_API_KEY` configured (production, not test/placeholder)
- [ ] `VIETQR_ACCOUNT_NUMBER` + `VIETQR_BANK_BIN` configured (Agribank production account)
- [ ] SePay webhook URL registered and receiving test transfers
- [ ] SePay bearer token verification active on `/api/payments/bank_transfer/webhook`
- [ ] Append-only ledger: triggers preventing UPDATE/DELETE active
- [ ] `PAYMENTS_STUB=false` in production env
- [ ] BookingRef extraction from memo working (case-insensitive regex)
- [ ] Admin reconciliation dashboard for memo-mismatch transfers (~5%)
- [ ] Manual refund process documented (no programmatic refund API for bank transfer)
- [ ] Payment collection model: legal clearance obtained (SBV IPS license OR legal opinion -- Decree 52/2024)
- [ ] Payment anomaly alerting configured (failed webhook spikes, amount mismatches)

### Notifications (ADR-013, HD-008)

- [ ] HD-008 notification channel hardening: **PASS**
- [ ] eSMS production API key configured
- [ ] eSMS brandname approved (5-10 week process -- start early)
- [ ] SMS template registered and approved
- [ ] Resend production API key configured (if email active)
- [ ] OTP delivery monitoring active (>95% delivery within 30s target)
- [ ] Notification delivery failure alerting configured

### Data & Compliance (ADR-014, PDPL 2025, HD-007)

- [ ] HD-007 regulatory & compliance audit: **PASS**
- [ ] CDTIA filed for Vercel/Neon/Upstash (Singapore hosting) OR deferral documented with legal rationale
- [ ] If Resend (US) processes customer email: CDTIA filed with MPS A05 within 60 days
- [ ] No production PII in staging/Vercel environment
- [ ] Privacy policy published
- [ ] Terms of service published
- [ ] DPO appointed (PDPL 2025 -- mandatory for sensitive-data platforms)
- [ ] DPA signed with all processors (eSMS, Resend, MISA, VNPay, MoMo)
- [ ] E-invoice transport fields mapped to MISA XML (Decree 70/2025 -- fine per invoice if missing)
- [ ] Tax withholding `calcWithholding()` implemented OR pre-Jul-2026 deferral documented
- [ ] DSAR response API implemented (data export/deletion within 72h)
- [ ] `piiAnonymization` cron built and tested
- [ ] Breach notification tabletop exercise completed

### Monitoring (GL-002)

- [ ] GL-002 monitoring setup: **PASS**

### Backup & DR (GL-003)

- [ ] GL-003 backup & DR: **PASS**

### Rollback (GL-004)

- [ ] GL-004 rollback plan: **PASS**

### Smoke Tests (GL-005)

- [ ] GL-005 smoke test suite: **PASS**

### Cron Jobs (DS-006, HD-011)

- [ ] HD-011 cron & background job resilience audit: **PASS**
- [ ] All 16 cron endpoints responding with correct contract shape
- [ ] Vercel Cron active (11 endpoints in `vercel.json`; schedules in UTC matching DS-006 VN-time equivalents)
- [ ] Hold expiry sweep verified (10-min TTL)
- [ ] Notification dispatch cron verified
- [ ] `operatorLicenseAlert` and `piiAnonymization` cron routes implemented (KG from SI-006)
- [ ] Missed-cron detection alerting configured
- [ ] `paymentRecon` sweeper cron built OR deferral documented
- [ ] `strandedPayoutRecovery` cron built OR deferral documented

### Post-Deploy (SI-003 §11)

- [ ] Health check endpoint returning 200
- [ ] Smoke test script passing against production URL
- [ ] Rollback trigger thresholds documented (SI-003 §11.5)

## Single-Operator Deferral Register

Phase-1 launches with **1–2 family operators on a seed catalog** (single bank account, no self-serve customer auth). The items below are **deliberately deferred because of that scope**, not forgotten. Each carries a trigger (the condition that re-opens it) and a sign-off. A future reviewer who finds one of these un-built should check the trigger before treating it as a gap.

| ID | Deferred item | Ref | Trigger that re-opens it | Rationale | Signed off |
|----|---------------|-----|--------------------------|-----------|------------|
| D1 | Multi-operator tenant RLS (DB row-level security) | ADR-008 | ≥ 50 operators (Phase 3) | `withOperatorScope` + HD-005 negative tests cover isolation at this scale | ☐ _pending owner_ |
| D2 | Staff / multi-user per operator | FI-001, ADR-003 D12 | 2nd operator user needed | Phase-1 = one operator user per company | ☐ _pending owner_ |
| D3 | eSMS brandname SMS (stubbed) | #144 | Brandname approved (5–10wk) | OTP path stubbed for launch; deferral in working-track/… | ☐ _pending owner_ |
| D4 | MoMo / ZaloPay / VNPay / card rails | #133, working-track/26–28 | Demand beyond bank_transfer+cash | Phase-1 payment scope frozen (ADR-005) | ☐ _pending owner_ |
| D5 | Programmatic refund API (bank_transfer) | HD-006 | Refund volume warrants it | Manual refund runbook covers Phase-1 | ☐ _pending owner_ |
| D6 | Split-settlement / thu-hộ-chi-hộ automation | #133 | Decree 52 wave-4 / multi-account | Single bank account at launch | ☐ _pending owner_ |
| D7 | Tax withholding `calcWithholding()` | HD-009 | Pre-Jul-2026 regulatory date | Documented deferral; not due at launch | ☐ _pending owner_ |
| D8 | Chargeback model + admin UI | #139 | First chargeback | Deferred P2 | ☐ _pending owner_ |
| D9 | Complaint & support ticket system (Law 19/2023) | #136 | Post-launch wave-4 | Deferred compliance wave | ☐ _pending owner_ |

> Sign-off convention: replace `☐ _pending owner_` with `[x] <name/role> <YYYY-MM-DD>` when the deferral is accepted for launch. An un-signed row in this register is a NO-GO — a deferral must be *decided*, not defaulted.

## Verdict

**GO** only when **every HARD blocker (H1–H13) is ✅** AND every SOFT / NOT-required / deferral-register row is explicitly annotated (checked, or deferred-with-rationale-and-sign-off). The granular checklist below is the backing evidence for the gate rows above.

## Cross-References

- SI-003 §14.5 -- go-live gate definition
- SI-003 Known Gaps -- KG-01 through KG-06
- SI-006 -- deployment architecture
- ADR-008 -- security posture
- ADR-020 -- infrastructure decisions
