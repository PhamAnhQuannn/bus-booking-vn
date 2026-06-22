# Business Domain — Spec vs Reality

Comparison of `documentation/business/` (domain model, market research, personas, regulatory) against codebase alignment.

---

## 1. Domain Model

### Bounded Contexts (`business/domain-model/bounded-contexts.md`)

**Spec defines 6 bounded contexts:**

| Context | Responsibility | Code Module | Aligned? |
|---|---|---|---|
| Booking | Hold → booking → payment lifecycle | `lib/booking/`, `lib/payment/`, `lib/security/` | YES |
| Catalog | Bus, Route, Trip management | `lib/catalog/`, `lib/trips/` | YES |
| Identity | Customer, Operator, Admin auth | `lib/auth/`, `lib/account/` | YES |
| Operations | Operator onboarding, staff, KYB | `lib/op/`, `lib/staff/`, `lib/onboarding/` | YES |
| Finance | Ledger, payouts, e-invoice | `lib/ledger/`, `lib/payment/`, `lib/einvoice/` | YES |
| Support | Charter, notifications, ticketing | `lib/charter/`, `lib/notification/`, `lib/ticketing/` | YES |

**Alignment:** Code modules map 1:1 to bounded contexts. Dependency flow matches context relationships.

---

### State Machines (`business/domain-model/state-machines.md`)

**Spec defines 8 state machines:**

| Machine | States (Spec) | States (Code) | Match? |
|---|---|---|---|
| Trip | scheduled → departed → completed / cancelled | `TripStatus` enum: scheduled, departed, completed, cancelled | YES |
| Booking | pending_payment → paid → cancelled / refunded | `BookingStatus` enum matches | YES |
| Payment | pending → success / failed / expired | `PaymentStatus` enum matches | YES |
| Payout | pending → requested → processing → settled / failed | `PayoutStatus` enum matches | YES |
| Charter | submitted → assigned → accepted → completed / cancelled / expired / rejected | `CharterStatus` enum matches | YES |
| OTP | active → consumed / expired / locked | `OtpAttempt` model with `consumed`, `expiresAt`, `attemptCount` | YES |
| Operator Approval | PENDING_REVIEW → UNDER_REVIEW → APPROVED / REJECTED / SUSPENDED | `OperatorStatus` enum matches | YES |
| E-Invoice | pending → issued / failed → correction | `EInvoiceStatus` enum matches | YES |

**Gap:** 5 of 8 lack formal `LEGAL_*_TRANSITIONS` constants in code (SI-003 KG-17). Transitions work correctly but aren't guarded by a single canonical map.

---

### Business Invariants (`business/domain-model/invariants-catalog.md`)

Key invariants and their enforcement status:

| ID | Invariant | Enforcement | Status |
|---|---|---|---|
| I1 | Hold expires after TTL, seat capacity restored | `expireHolds` cron + `holdTimerStore` client | IMPLEMENTED |
| I2 | Booking requires valid hold | `initiateOnlineBooking` checks hold validity | IMPLEMENTED |
| I3 | Bus cannot serve overlapping trips | Raw SQL window query in `$transaction` | IMPLEMENTED |
| I4 | Trip capacity = bus capacity (no overbooking) | `SELECT FOR UPDATE` + recount in `$transaction` | IMPLEMENTED |
| I5 | Ledger entries are immutable | PostgreSQL BEFORE UPDATE/DELETE triggers | IMPLEMENTED |
| I6 | Payout ≤ available balance | Balance derived from ledger, checked in `$transaction` | IMPLEMENTED |
| I7 | No client-originated price | Server-computed for customer endpoints | IMPLEMENTED |
| I7-exempt | Operator IS price authority for `/api/op/**` | Exempted per Mistake Log Issue 013 | DOCUMENTED |
| I8 | One active hold per customer per trip | Unique constraint + check in hold creation | IMPLEMENTED |
| I9 | Booking ref format: `BB-YYYY-xxxx-xxxx` | `lib/booking/bookingRef.ts` + exported `BOOKING_REF_REGEX` | IMPLEMENTED |
| I10 | Cancelled trip → refund all paid bookings | `cancelTrip` service with `$transaction` | IMPLEMENTED |
| I11 | Maintenance window blocks trip creation | Window-vs-window overlap check | IMPLEMENTED (Mistake Log Issue 001 fix) |
| I12 | Operator can only manage own resources | `withOperatorScope` / JWT `operatorId` claim | IMPLEMENTED |
| I13 | Admin actions are audit-logged | `AdminAuditLog` append-only model | IMPLEMENTED |

**Alignment:** All documented invariants are enforced in code.

---

### Ubiquitous Language (`business/domain-model/ubiquitous-language.md`)

| Term | Definition | Code Usage | Consistent? |
|---|---|---|---|
| Hold | Temporary seat reservation during payment | `Hold` model, `holdRepo`, `holdCookie` | YES |
| Booking | Confirmed seat reservation (paid or pending) | `Booking` model, `bookingRef`, `bookingDto` | YES |
| Trip | Scheduled bus departure on a route | `Trip` model, `tripDto`, `tripStatus` | YES |
| Route | Origin-destination path with duration | `Route` model, `createRoute` | YES |
| Charter | Group/private-hire request | `CharterRequest` model, `charterRef` | YES |
| Manifest | Trip passenger list for boarding | `getManifest`, manifest page | YES |
| Payout | Operator earnings withdrawal | `Payout` model, `settlePayout` | YES |
| Ledger Entry | Immutable financial record | `LedgerEntry` model (append-only) | YES |

---

## 2. Market Research (`business/market-research/`)

| Document | Content | Code Impact | Gaps |
|---|---|---|---|
| `business-model.md` | Commission-based marketplace model | Implemented (6% default fee in ADR-005) | None |
| `competitive-advantages.md` | Tech differentiation, operator tools | Operator console built | None |
| `competitive-landscape.md` | VeXeRe, Futa, Vato comparison | Informational | None |
| `feature-benchmark.md` | Feature parity matrix | Most features built | ZaloPay, i18n gaps |
| `risk-register.md` | SBV license, data residency, Tet scaling | SBV risk = Critical Blocker 1.1 | Active risk |
| `strategic-roadmap.md` | Phase 1-3 rollout plan | Phase 1 substantially complete | Phase 2-3 deferred |
| `user-insights.md` | Customer/operator pain points | Addressed in FD specs | None |
| `vietnam-market-context.md` | Regulatory landscape, market size | Matches HD-007 compliance requirements | Active gap (see 04-regulatory-compliance.md) |

---

## 3. Personas (`business/personas/`)

| Persona | Coverage in Code | Status |
|---|---|---|
| Customer personas | 18 customer pages, search, booking flow, charter | IMPLEMENTED |
| Operator personas | 32 operator pages, full console, staff management | IMPLEMENTED |
| Admin personas | 11 admin pages, approval workflow, finance, moderation | IMPLEMENTED |
| Investor KPIs | Analytics module (`lib/analytics/`), admin metrics | PARTIAL (no investor dashboard) |
| Stakeholder map | Informational, no direct code impact | N/A |

---

## 4. Competitor Benchmark (`business/competitor-benchmark/`)

| Document | Key Finding | Code Status |
|---|---|---|
| `feature-parity-matrix.md` | Must-have: search, booking, payment, operator tools | All must-haves implemented |
| `pricing-comparison.md` | Commission range 5-15% (market standard) | 6% default fee (competitive) |
| `geographic-coverage.md` | Focus on intercity Vietnam routes | Route/trip model supports this |
| `operator-sentiment.md` | Operators want fast payouts, clear reporting | Payout + reports implemented |
| `cac-ltv-benchmarks.md` | CAC/LTV targets for sustainability | Analytics funnel tracking exists |

---

## 5. Regulatory (`business/regulatory/`)

| Document | Regulation | Code Compliance | Gap Ref |
|---|---|---|---|
| `payment.md` | Decree 52/2024 (IPS licensing) | Central collection model = risk | 01-critical-blockers.md §1 |
| `data-privacy.md` | PDPL 2025 (data protection) | DPO/DPAs/DSAR absent | 04-regulatory-compliance.md |
| `einvoice-tax.md` | Decree 70/2025 (transport e-invoice) | Transport fields not mapped | 04-regulatory-compliance.md §7 |
| `consumer-protection.md` | CPL 2023 Art. 29 (refund rights) | Refund endpoint missing | 01-critical-blockers.md §6 |
| `transport.md` | Transport business regulations | Operator licensing model aligns | None |
| `telecom-sms.md` | SMS brandname registration | eSMS stub, no registration | 04-regulatory-compliance.md |
| `legal-entity.md` | Company formation requirements | Informational | N/A |
| `compliance-timeline.md` | Key deadlines | Tax withholding Jul 2026 | 04-regulatory-compliance.md §8 |
| `dpia-checklist.md` | Data Protection Impact Assessment | Not executed | 04-regulatory-compliance.md |
| `psp-contract-terms.md` | PSP agreement terms | No PSP agreements signed | 03-payment-integration.md |
| `labor-aml-ip.md` | Labor, AML, IP regulations | Informational | N/A |

---

## Summary

| Business Doc Category | Documents | Aligned | Gaps |
|---|---|---|---|
| Domain Model | 5 | 5/5 | State machine transition maps incomplete (KG-17) |
| Market Research | 8 | 8/8 | Risk register items are active (not gaps in docs) |
| Personas | 5 | 4/5 | Investor dashboard partial |
| Competitor Benchmark | 5 | 5/5 | None |
| Regulatory | 12 | 3/12 | 9 regulatory items have active compliance gaps |
| **Total** | **35** | **25/35** | **10 items with active gaps** |

Business documentation is comprehensive and accurate. Gaps are in compliance execution (implementing what the docs require), not in documentation accuracy.
