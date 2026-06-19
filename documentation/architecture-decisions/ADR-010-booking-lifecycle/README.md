# ADR-010: Booking Lifecycle

## Status

ACCEPTED

## Date
2026-06-17 (reviewed and confirmed)

## Context

Bus Booking (BB) is entering the Vietnam inter-city bus ticketing market — a USD 140–500M addressable space dominated by VeXeRe (~80% online market share, 700+ operators). The platform serves 5 operator segments (micro family-run to FUTA-scale fleets) and 6 customer personas (budget domestic workers to international backpackers), under Vietnam-specific regulatory constraints: SBV payment intermediary licensing (Decree 52/2024), PDPL 2023 data privacy, Circular 78/2021 e-invoicing, and Consumer Protection Law 2023.

The booking lifecycle — from search through hold, payment, ticket issuance, trip completion, to settlement and potential cancellation/refund — is the platform's core value loop. Every decision here shapes operator trust (settlement speed, manifest accuracy), customer trust (no double-selling, instant ticket), regulatory compliance (payment model, e-invoice timing), and technical complexity.

This ADR records the 16 architectural decisions that define the booking lifecycle, each with options considered, choice made, and rationale drawn from business documentation (market research, domain model, competitor benchmarks, regulatory scan, personas).

---

## Decisions

### D1: Reservation Model — Hold-then-Book (Two-Phase)

**Sources**: `domain-model/event-flows.md`, `domain-model/state-machines.md`, `domain-model/ubiquitous-language.md`

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A. Instant booking (no hold) | Customer pays immediately on search result click | Simpler flow; fewer states | No price/seat review before payment; higher abandonment; no capacity lock during payment |
| B. Cart model | Customer adds trips to cart, checks out later | Familiar e-commerce UX; multi-trip bundling | Stale inventory; no real-time capacity guarantee; complex cart-expiry logic |
| **C. Hold-then-Book** ✅ | Customer creates temporary hold (10-min TTL) → reviews → initiates payment → hold consumed on booking | Capacity locked during payment window; clean two-phase commit; matches bus industry mental model | Requires advisory locks; hold expiry sweeper; adds states |

**Choice**: Option C — Hold-then-Book with 10-minute TTL.

**Rationale**: Bus ticket purchasing has a natural review step (pickup point, passenger info, consent). A 10-minute hold prevents double-selling during that window. Advisory locks (phone-level cap + trip-level serialization) make it concurrency-safe without pessimistic table locks. Matches operator mental model ("đặt chỗ tạm" = temporary seat reservation).

---

### D2: Capacity Model — Count-Based (No Seat Selection)

**Sources**: `risk-matrix.md` (Gap #7), `vietnam-market-context.md`, `competitor-benchmark/feature-parity-matrix.md`, `domain-model/invariants-catalog.md`

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A. Seat map with named seats | Each seat individually bookable (1A, 2B…) | Premium UX for limousine/sleeper; prevents neighbor conflicts | Per-bus seat layout config; high onboarding friction for small operators |
| **B. Count-based capacity** ✅ | Trip has integer capacity; bookings decrement count | Simple; matches ~80% of operators (standard coach); zero config | No seat preference; limousine operators may push back |
| C. Hybrid (count default, seat map opt-in) | Operators choose per bus type | Best of both | Double complexity; deferred to v2+ |

**Choice**: Option B — Count-based capacity.

**Rationale**: Vietnamese bus operators (especially small/family-run — "Bác Tâm" persona) manage capacity as headcount, not seat assignments. VeXeRe offers seat maps but operators report it as onboarding friction. Count-based matches "Đặt Chỗ" (reserve a place) language. Limousine operators (Phase 2 tourist corridors) served by seat maps later — ratified as "not this version" in risk matrix.

---

### D3: Capacity Guard — Three-Layer Defense

**Sources**: `domain-model/invariants-catalog.md` (I4), `domain-model/event-flows.md`, `domain-model/ubiquitous-language.md`

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A. Single check at booking time | Verify capacity only when payment confirmed | Simple | Race condition: two concurrent payments both pass check |
| B. Optimistic lock with retry | Check-and-set with version column | Low contention in happy path | Retry UX poor; customer sees "seat lost after payment" |
| **C. Three-layer defense** ✅ | L1: conditional INSERT with advisory locks at hold; L2: immediate oversold refund at payment webhook; L3: per-phone concurrent hold cap | Defense-in-depth; L1 prevents ~99% oversell; L2 catches PSP race; L3 prevents abuse | More complex; requires advisory lock understanding |

**Choice**: Option C — Three-layer defense.

**Rationale**: Double-selling is the #1 trust-destroyer per stakeholder map ("double-sell trust collapse" under Domestic Travelers risk). Layer 1 (advisory locks at hold) prevents most overselling. Layer 2 (refund if oversold after payment) handles the PSP webhook race (two customers pay simultaneously). Layer 3 (per-phone hold cap = CONCURRENT_HOLD_CAP) prevents hold-flooding abuse. Defense-in-depth matches the "no brand equity buffer" reality — one viral complaint on Facebook/Zalo kills adoption.

---

### D4: Payment Model — Marketplace (PSP Split-Settlement)

**Sources**: `vietnam-market-context.md` (Action #1), `regulatory/payment.md`, `risk-matrix.md` (Risk #1), `regulatory/psp-contract-terms.md`

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A. Central collection (platform holds funds) | Customer → Platform bank → Operator | Full control over payout timing; simple reconciliation | **ILLEGAL** without SBV intermediary license (Decree 52/2024); shutdown risk |
| **B. Marketplace / PSP split-settlement** ✅ | Customer → VNPay/MoMo → Operator merchant account; platform fee splits at source | No SBV license needed; VeXeRe precedent (10+ years); no custody of operator funds | Each operator needs own merchant account; less payout control |
| C. Licensed escrow provider | Platform uses licensed intermediary to hold funds | Legal; no fund custody | Third-party dependency; escrow fees; slower settlement |

**Choice**: Option B — Marketplace with PSP split-settlement.

**Rationale**: Central collection is classified as "thu hộ chi hộ" (collect-and-remit) under Article 3(17) of SBV regulations — requires IPS license BB doesn't have. VeXeRe operates on marketplace model with VNPay for 10+ years without SBV challenge. Payment flows directly to operator's merchant account; platform 6% fee extracted at source. Eliminates fund custody, SBV license requirement, and T+N payout obligation entirely. Fallback for micro-operators who can't open merchant accounts: licensed escrow (Option C), never Option A.

---

### D5: Settlement Timing — T+1 (After Trip Completion)

**Sources**: `domain-model/ubiquitous-language.md`, `domain-model/invariants-catalog.md` (I11), `competitor-benchmark/pricing-comparison.md`, `domain-model/state-machines.md`

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A. Instant settlement (T+0) | Funds available immediately on payment | Strongest competitive advantage | No refund/chargeback protection |
| **B. T+1 after trip completion** ✅ | Revenue available 1 day after trip marked completed | Protects against pre-departure cancellations; competitive vs VeXeRe (T+7-14) | Operators wait until service delivery + 1 day |
| C. T+3 after payment | Revenue available 3 days after payment | Simpler; no trip-completion dependency | Regulatory risk (IPS classification); refund obligation while funds "available" |
| D. T+7 to T+14 (VeXeRe model) | Industry standard long settlement | Maximum protection | #1 operator churn driver per sentiment research |

**Choice**: Option B — T+1 after trip completion.

**Rationale**: Ties settlement to service delivery, not payment time. Eliminates the T+3-after-payment IPS classification risk (risk register Risk #1). Competitive advantage: faster than VeXeRe's estimated T+7–T+14. Operator sentiment research shows settlement speed is #2 priority after brand control. The +1 day buffer covers most same-day chargeback/dispute scenarios. Two payout creation paths: auto-sweep (scheduledAt = completedAt + 1 day) and on-demand withdrawal.

---

### D6: Price Authority — Server-Derived (Invariant I7)

**Sources**: `domain-model/invariants-catalog.md` (I7), `domain-model/event-flows.md`, `domain-model/ubiquitous-language.md`

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A. Client sends price in request body | Frontend calculates total, backend trusts it | Simpler backend | **Price tampering** — customer underpays by modifying request |
| **B. Server derives price from Trip.price × ticketCount** ✅ | Backend reads Trip.price at booking time; client never sends price | Tamper-proof; single source of truth | Frontend must fetch price for display (already via search) |
| C. Price locked at hold creation | Hold stores price snapshot; booking uses hold price | Protects against mid-session price changes | Price update during hold TTL won't apply (minor; 10-min window) |

**Choice**: Option B — Server-derived price (I7 invariant).

**Rationale**: Customer-facing endpoints (`/api/holds`, `/api/bookings`, `/api/payments`) never accept price from request body. Price = `Trip.price × ticketCount`, computed server-side at booking initiation. Operator-side endpoints (`/api/op/trips` POST) are I7-exempt — the operator IS the price authority for their own trips. This is an OWASP-critical security invariant.

---

### D7: Booking Status State Machine

**Sources**: `domain-model/state-machines.md`, `domain-model/ubiquitous-language.md`

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A. Simple (booked → completed → cancelled) | Minimal states | Easy to reason about | Can't distinguish unpaid from paid; no refund tracking |
| **B. Full lifecycle with legal transitions** ✅ | `awaiting_payment → paid → completed → cancelled / trip_cancelled / no_show / payment_failed_expired / refunded` | Each state = distinct business meaning; WHERE-clause idempotency via `legalPredecessors` | More states; transition validation required |

**Choice**: Option B — Full lifecycle with legal predecessor transitions.

**Rationale**: Each status maps to a distinct business event: `awaiting_payment` (hold consumed, payment pending within PSP_WINDOW_MINUTES=20), `paid` (webhook confirmed), `completed` (trip completed), `trip_cancelled` (operator cancelled trip — cascaded), `refunded` (refund processed). The `legalPredecessors` pattern enables idempotent replays — a transition's WHERE clause includes `status IN (legalPredecessors)`, so duplicate webhooks are safe. Terminal states are absorbing — no outbound transitions.

---

### D8: Customer Identity — Phone-Primary (No Email/Password)

**Sources**: `domain-model/ubiquitous-language.md`, `personas/customer-personas.md`, `market-research/user-insights.md`, `domain-model/state-machines.md`

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A. Email + password | Traditional registration + login | Familiar to Western users | Vietnamese travelers don't use email daily; "Bà Hoa" (elderly) may not have email |
| **B. Phone + OTP (6-digit SMS)** ✅ | Phone = identity; login via OTP SMS | Matches Vietnam behavior (Zalo, MoMo, VeXeRe); zero password to forget; works for all 6 personas | SMS cost 300-800 VND/OTP; carrier delivery variance |
| C. Social login (Zalo/Facebook) | OAuth via Zalo or Facebook | Zero-friction; large user bases | Platform dependency; Zalo OAuth limited; no phone for ticket SMS |

**Choice**: Option B — Phone + OTP.

**Rationale**: All 6 customer personas have phone as primary identifier. Vietnamese digital behavior is phone-centric — MoMo (68% e-wallet share), Zalo (85% usage), VeXeRe all use phone login. OTP with 5-min TTL, 3-failure 15-min lockout (via row repurposing as lockout sentinel), and otpProof JWT for cross-route state transfer. SMS delivery via eSMS (Vietnamese provider, 95-99% delivery vs 60-80% for Twilio/AWS SNS).

---

### D9: Cancellation Model — Idempotent with Discriminated Result

**Sources**: `domain-model/state-machines.md`, `domain-model/event-flows.md`, `regulatory/consumer-protection.md`, `risk-matrix.md`

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A. Throw error on duplicate cancel | Service throws if already cancelled | Simple | Forces catch → 422; loses trip DTO in error path; violates idempotency |
| **B. Discriminated result** ✅ | Service returns `{ trip, alreadyCancelled, cancelledBookings }` — HTTP 200 always | Idempotent; full DTO; no error fabrication | Must detect duplicate inside transaction |

**Choice**: Option B — Discriminated result pattern.

**Rationale**: Trip cancellation cascades to all bookings and holds. Second cancel attempt returns HTTP 200 with `alreadyCancelled: true` (not 422 error). Discriminator detected inside `$transaction` after `SELECT ... FOR UPDATE` for lock consistency. Cascaded booking cancellations trigger refundOut processing.

**Regulatory note**: Consumer Protection Law 2023 grants 3-day right to cancel remote contracts UNLESS service already performed. Bus departure = "service performed" is the likely interpretation — legal counsel needed (one of 8 must-get legal opinions).

---

### D10: Platform Fee Model — Commission via FeeConfig (Parts-Per-Million)

**Sources**: `domain-model/ubiquitous-language.md`, `competitor-benchmark/pricing-comparison.md`, `market-research/business-model.md`, `personas/operator-personas.md`

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A. Fixed fee per booking | Flat VND amount per ticket | Predictable; simple | Regressive on cheap tickets; doesn't scale |
| **B. Percentage commission (ratePpm)** ✅ | Parts-per-million in FeeConfig with effective dating; 6% = 60,000 ppm | Scales with ticket value; supports intro rates (3-4% → 6% → negotiable); no retroactive changes | BigInt math required; operator resistance at >15% |
| C. SaaS subscription | Monthly flat fee (1-2M VND/month) | Predictable revenue | Small operators can't justify fixed cost; misaligned incentives |
| D. Hybrid (subscription + reduced commission) | Monthly base + lower % | Dual revenue | Complex; confusing pricing |

**Choice**: Option B — Percentage commission via FeeConfig.

**Rationale**: 8-10% standard commission, below VeXeRe (~8-12%) and redBus (10-20%). Introductory 3-4% for first 3 months to reduce adoption friction ("Bác Tâm" micro-operator). Stored as `ratePpm` for precision without floating-point — 60,000 ppm = 6.0000%. Effective-dating means fee changes apply only to future bookings. All fee math uses BigInt (invariant I10) to prevent IEEE 754 drift.

---

### D11: Ledger Model — Append-Only Double-Entry

**Sources**: `domain-model/invariants-catalog.md` (I8), `domain-model/ubiquitous-language.md`, `domain-model/bounded-contexts.md`

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A. Balance column on operator | Simple running balance | Easy to query | Mutation risk; no audit trail; reconciliation impossible |
| **B. Append-only double-entry ledger** ✅ | Immutable LedgerEntry rows (booking_credit, platform_fee, refund_debit, refund_out, payout_debit, payout_reversal, chargeback, adjustment, tax_withheld); balance = derived SUM | Full audit trail; GDT/investor compliance; DB trigger prevents UPDATE/DELETE | Complex queries; seed cleanup requires DROP SCHEMA |

**Choice**: Option B — Append-only double-entry ledger.

**Rationale**: Vietnam GDT requires 10-year financial record retention. Investor due diligence requires audit trail. Immutability enforced at DB level via PostgreSQL `BEFORE UPDATE OR DELETE` trigger — even platform admin can't modify history. Available balance = `settledEligible - paidOut` (never stored as column). Corrections are reversal entries, not mutations.

---

### D12: Guest Booking — Phone-Identified, No Account Required

**Sources**: `domain-model/ubiquitous-language.md`, `personas/customer-personas.md`, `market-research/user-insights.md`

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A. Mandatory account creation | Must register + verify OTP before booking | Full user data; clean records | Friction; abandonment; "Bà Hoa" (elderly, children book for her) blocked |
| **B. Phone-identified guest booking** ✅ | Phone = identity; Customer record auto-created on first hold; can later "claim" account | Zero friction; matches "children book for grandmother" pattern; consent captured at booking | Harder to re-engage guests; no booking history without registration |

**Choice**: Option B — Phone-identified guest booking.

**Rationale**: Reducing friction critical for market entry. "Bà Hoa" persona has children booking on her behalf — they enter her phone, she gets SMS ticket. Customer record created lazily via `attachGuestBookingByPhone`. Consent records (no_refund, pii_storage) captured at booking initiation. Guest can later register with same phone to see history. Soft-delete with anonymization supports PDPL 2023 deletion requests.

---

### D13: E-Invoice Timing — Async on Payment Confirmation

**Sources**: `regulatory/einvoice-tax.md`, `domain-model/bounded-contexts.md`, `stakeholder-map.md`

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A. Synchronous (block checkout) | Invoice generated during payment webhook | Guaranteed delivery | MISA latency blocks checkout; MISA downtime = no booking |
| **B. Async with retry queue** ✅ | Payment webhook creates booking; e-invoice queued async; retry on failure | Checkout unblocked; retry handles transients | Small window without invoice; alert needed for failures |

**Choice**: Option B — Async on payment confirmation with retry queue.

**Rationale**: Circular 78/2021 requires e-invoice "no later than payment confirmation" — interpreted as "triggered by", not "blocking". Customer needs QR within 60s of payment (stakeholder obligation). E-invoice state machine: `pending → issued → sent → failed → cancelled`. Corrections create new rows (consistent with ledger immutability). "Anh Minh" (business traveler) needs invoice for expense claims — async delivery acceptable if within minutes.

---

### D14: Payment Gateway Strategy — Multi-PSP (VNPay + MoMo + VietQR)

**Sources**: `regulatory/psp-contract-terms.md`, `market-research/user-insights.md`, `vietnam-market-context.md`, `domain-model/bounded-contexts.md`

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A. Single PSP (VNPay only) | One integration, broadest card coverage | Simplest | Misses MoMo's 40M+ users; higher MDR for bank transfers |
| **B. Multi-PSP with adapter pattern** ✅ | VNPay (cards + QR) + MoMo (e-wallet) + VietQR (bank transfer); adapter interface normalizes | ~95% payment coverage; best MDR per channel; redundancy | Three integrations; three webhook handlers |
| C. Start with one, add later | VNPay first, others phased | Lower initial complexity | Phase 1 demographic ("Chị Lan") is MoMo-heavy; delays PMF |

**Choice**: Option B — Multi-PSP with PaymentGateway adapter interface.

**Rationale**: Phase 1 corridor demographic (migrant workers, MoMo primary) requires MoMo from day 1. VietQR offers lowest MDR (<0.5-1%). VNPay covers international cards for Phase 2 tourist corridors. Adapter interface (anti-corruption layer) normalizes webhook codes, status enums, and refund APIs across PSPs. Integration priority: VNPay → MoMo → VietQR.

---

### D15: Charter Model — Lead-Gen Only (Off-Platform Settlement)

**Sources**: `domain-model/state-machines.md`, `domain-model/bounded-contexts.md`, `vietnam-market-context.md`

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A. Full transactional charter | Platform processes charter payment | Revenue; full control | Complex pricing; regulatory ambiguity; distracts from scheduled PMF |
| **B. Lead-gen only** ✅ | Customer submits → Admin reviews → Assigns operator → Off-platform settlement | Zero payment complexity; tests demand | No transaction revenue; no quality control |
| C. No charter | Don't build it | Simplest | Misses demand signal from cooperatives/groups |

**Choice**: Option B — Lead-generation only.

**Rationale**: Charter explicitly OFF in Phase 1. "One working corridor with real payment > perfectly-engineered charter state machine." State machine exists (SUBMITTED → ADMIN_REVIEW → ASSIGNED_DIRECT/PUBLISHED → ACCEPTED → COMPLETED) but settlement off-platform. Revenue deferred to Phase 4 ("graduate from lead-gen to transactional"). Focus on proving scheduled booking PMF first.

---

### D16: Notification Channel — SMS Primary, Email Secondary

**Sources**: `regulatory/telecom-sms.md`, `market-research/user-insights.md`, `domain-model/bounded-contexts.md`, `stakeholder-map.md`

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A. Email only | Tickets + confirmations via email | Cheapest | Vietnamese travelers don't check email; low open rates |
| **B. SMS primary + email secondary** ✅ | OTP + ticket via SMS (eSMS brandname); confirmation email backup (Resend) | Matches Vietnam behavior; 95-99% delivery via eSMS | SMS cost 300-800 VND/msg; brandname registration = 2-4 week blocker |
| C. Zalo ZNS primary | Zalo notifications (200-500 VND/msg) | Cheaper; higher engagement; 75M MAU | Not universal; doesn't reach tourists or non-Zalo users |
| D. SMS + Zalo ZNS hybrid | ZNS for Zalo users, SMS fallback | Best coverage + cost optimization | Two channels to maintain |

**Choice**: Option B for launch (SMS + email). Option D planned for Phase 2.

**Rationale**: Brandname SMS via eSMS is the only channel guaranteed to reach all 6 customer personas. ZNS cheaper (200-500 VND vs 300-800 VND) but not universal. Email via Resend handles business traveler invoice delivery and acts as SMS fallback. Phase 2 adds ZNS as primary with SMS fallback (50-70% cost savings). Brandname SMS registration is a 2-4 week hard blocker — must start immediately.

---

## Consequences

### Enabled

- **No SBV license required** — marketplace payment model (D4) eliminates fund custody risk
- **Sub-second booking confirmation** — hold-then-book (D1) + async e-invoice (D13) keeps checkout fast
- **Zero double-selling** — three-layer capacity guard (D3) with advisory locks
- **Operator competitive advantage** — T+1 settlement (D5) faster than VeXeRe T+7-14; transparent fee (D10) below market
- **Vietnam-native UX** — phone+OTP (D8), SMS-first (D16), guest booking (D12) match all personas
- **Audit compliance** — immutable ledger (D11) satisfies GDT 10-year retention + investor diligence
- **Safe idempotency** — discriminated result (D9) + legal predecessor transitions (D7) make retries/replays safe

### Constrained

- **No seat selection** until v2+ (D2) — limousine operators must accept count-based
- **No charter revenue** until Phase 4 (D15) — lead-gen only
- **SMS cost floor** — 300-800 VND/OTP + 300-800 VND/ticket (D16); ZNS optimization deferred
- **Operator merchant account required** — marketplace model (D4) means each operator needs VNPay/MoMo merchant setup; micro-operators may need escrow fallback
- **BigInt everywhere** — commission math (D10) and all currency arithmetic must use BigInt domain; no Number multiplication on money
- **Seed cleanup cost** — immutable ledger (D11) requires DROP SCHEMA for dev database resets

### Open Questions — Resolved

> Originally flagged for legal counsel. Resolved 2026-06-17 using regulatory research in `documentation/business/regulatory/`.

**1. Does Consumer Protection Law 2023 3-day cancellation right apply to bus tickets? (D9)**

**Resolution**: Likely applies pre-departure, does not apply post-departure. CPL 2023 Art. 29 grants a 3-working-day right to cancel remote/electronic contracts UNLESS "services already fully performed." Pre-departure, the transport service has not been performed — the cancellation right likely applies. Post-departure, it has. However, the exact boundary is untested for bus tickets specifically. Current mitigation: capture explicit `no_refund` consent at checkout (ConsentRecord). **Action**: obtain written legal opinion confirming bus ticket exception before launch. Source: `regulatory/consumer-protection.md` §Right to Cancel Remote Contracts.

**2. Does marketplace fund flow trigger "thu hộ chi hộ" classification? (D4)**

**Resolution**: No — if VNPay settles directly to each operator's bank account (not to platform's account first). Decree 52/2024 Art. 3(17) defines thu hộ chi hộ as receipt and remittance of funds. If funds flow Customer → VNPay → Operator directly, platform never touches the money and no IPS license is required. Platform invoices operator separately for commission. This is the Vexere precedent model (operating since 2013, no SBV IPS license, no regulatory challenge). **Risk**: if VNPay settles to platform's merchant account first then platform transfers to operators, the practical fund flow looks like thu hộ chi hộ regardless of contract label. **Action**: confirm VNPay split-settlement contract routes funds directly to operator accounts. Source: `regulatory/payment.md` §2 Marketplace vs. Merchant Model.

**3. E-invoice issuer: platform as authorized agent or operator directly? (D13)**

**Resolution**: Platform issues on behalf of operator via third-party authorization. Decree 123/2020 Art. 17 (expanded by Decree 70/2025) allows operators to formally authorize the platform to issue e-invoices on their behalf. Invoice must show operator as seller (with operator's MST/tax code), not platform. Authorization requires: formal written agreement + notification to tax authority before arrangement begins. Decree 70/2025 expanded this right to business households and individual businesses (previously enterprises only). This is the standard approach used by Vexere and Ve Xe Nhanh. Source: `regulatory/einvoice-tax.md` §2 Invoice Issuer in Marketplace Model.

**4. Sector classification: technology services (100% foreign ownership) or transport (49-51% cap)?**

**Resolution**: Technology + e-commerce only. Register with VSIC codes for technology/software/IT services and e-commerce platform services. Do NOT register road transport VSIC codes — this would trigger transport license requirements and cap foreign ownership at 49-51%. Platform does not own or operate buses; it is a technology marketplace connecting licensed operators with passengers. Precedent: Grab Vietnam registered under technology/IT service categories with 100% foreign ownership, operating transport-adjacent platform without transport license. Vexere operates as technology company, not transport business, for 10+ years without regulatory challenge. **Risk**: if platform later adds fleet management/route optimization features, could trigger transport reclassification. Draft Road Transport Law (in progress) may explicitly address digital platforms when enacted — monitor. Source: `regulatory/legal-entity.md` §3 VSIC Code Strategy, `regulatory/transport.md` §2 Platform Classification.
