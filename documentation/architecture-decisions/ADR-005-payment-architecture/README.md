# ADR-005: Payment Architecture

## Status
ACCEPTED

## Date
2026-06-17 (reviewed and confirmed)

## Context

Bus-Booking processes ticket payments between Vietnamese travelers and bus operators (nhà xe). The payment architecture must satisfy Vietnam-specific regulatory, financial, and operational constraints while supporting a marketplace model where the platform does not own inventory.

Key business constraints driving payment decisions (sourced from `documentation/business/`):

- **SBV payment intermediary license (Decree 52/2024)**: Collecting customer payments and disbursing to operators constitutes "thu ho/chi ho" (collection/payment support) — operating this without a State Bank of Vietnam license is illegal and carries shutdown risk. Rated CRITICAL severity, CERTAIN likelihood. (risk-matrix.md, regulatory/payment.md)
- **VeXeRe precedent**: Dominant competitor (~80% online bus market) operates without IPS license using a marketplace model where PSP settles directly to operator accounts. 10+ years, no SBV enforcement. (regulatory/payment.md, competitor-benchmark/operator-sentiment.md)
- **PSP landscape**: VNPay (broadest coverage: cards+QR+wallets+international), MoMo (40M+ users, 68% e-wallet market share), VietQR/NAPAS (<0.5-1% MDR, fastest settlement T+0/T+1). (regulatory/psp-contract-terms.md, market-research/user-insights.md)
- **Settlement as trust signal**: Small operators (60-70% of market) are cash-flow-constrained; settlement speed is a churn trigger second only to brand control. No competitor publishes settlement terms. (competitor-benchmark/pricing-comparison.md, competitor-benchmark/operator-sentiment.md)
- **Financial integrity**: 8 state machines with ACID requirements, append-only ledger invariant, and BigInt currency math are core to preventing double-sell, underpay, and retroactive balance alteration. (domain-model/invariants-catalog.md, domain-model/state-machines.md)
- **Refund = #1 pain point**: VeXeRe has 2.7-star Trustpilot dominated by "slow refund" complaints. Automated refund-to-original-payment within 24-48h is a stated trust differentiator. (market-research/user-insights.md, risk-matrix.md)
- **VND integer currency**: Vietnam Dong has no minor unit (no cents). All amounts are integer VND. Platform fee percentages (e.g., 6%) applied to integer amounts via fractional multiplication produce IEEE 754 representation drift. (domain-model/invariants-catalog.md, domain-model/ubiquitous-language.md)
- **E-wallet transaction limits**: VND 100M monthly cap per user; VND 10M single transaction triggers biometric auth. Group bookings >10M may fail mid-checkout. (regulatory/payment.md)
- **VietQR reconciliation risk**: Memo truncation or user mistyped reference = money received but no ticket. Rated HIGH likelihood, HIGH impact. (risk-matrix.md, stakeholder-map.md)

---

## Decisions

### 1. Payment Model — PSP Split-Settlement (Marketplace)

| Option | Pros | Cons |
|--------|------|------|
| **PSP split-settlement (marketplace)** | Platform never touches customer money; no SBV IPS license required; VeXeRe precedent (10+ years); PSP handles PCI compliance; each operator = own merchant account | Requires per-operator PSP onboarding; operator must open own VNPay/MoMo merchant; platform has less control over settlement timing |
| Central collection (BB holds funds) | Full control over settlement timing and payout logic; simpler single-merchant integration; can batch payouts | Illegal without SBV intermediary license (Decree 52/2024); CRITICAL shutdown risk; license application is 6-12 months; requires registered capital thresholds |
| Licensed escrow provider | Legal custody of funds; platform controls payout timing; professional fund management | Escrow fees eat margin (1-3%); dependency on third-party availability; limited Vietnam escrow providers for marketplace model; adds intermediary latency |
| Merchant of record | Platform as seller; simplest tax/invoice model; full payment control | Platform assumes all refund/chargeback liability; misrepresents business model (platform doesn't own inventory); VAT obligation on gross, not commission; regulatory reclassification risk |

**Choice**: PSP split-settlement (marketplace)

**Reasons**:
- Central collection without SBV license is rated CRITICAL risk with CERTAIN likelihood — "illegal; shutdown risk" (risk-matrix.md). Restructuring to split-settlement eliminates custody of operator funds entirely (vietnam-market-context.md)
- VeXeRe has operated this exact model for 10+ years without SBV enforcement — strongest available market precedent for regulatory acceptance (regulatory/payment.md)
- Customer pays VNPay/MoMo → PSP splits payment → operator's merchant account receives ticket price, platform receives commission. BB never holds operator funds in transit (regulatory/payment.md)
- Each operator opening their own merchant account aligns with the "Shopify for bus operators" positioning — operator owns the payment relationship, not just the listing (competitor-benchmark/operator-sentiment.md)
- Fallback documented: if split-settlement proves infeasible with specific PSPs, licensed escrow provider is the next option (vietnam-market-context.md)
- Legal opinion on IPS classification required before issue 094 go-live keys — this is a HALT-level regulatory blocker (market-research/regulatory-compliance.md, risk-matrix.md)

---

### 2. PSP Selection & Priority — VNPay First, MoMo Second, VietQR Third

| Option | Pros | Cons |
|--------|------|------|
| **VNPay first** | Broadest coverage: domestic cards, international cards (Visa/MC), QR, e-wallets; MDR 0.5-1.5% domestic cards, 1-2% e-wallet/QR; T+1 settlement; serves both Vietnamese and tourist segments | Higher MDR than VietQR for QR payments; requires ERC + tax code + bank account + UBO ID for production onboarding |
| MoMo first | Largest e-wallet user base (40M+, 68% market share); strongest brand trust signal for domestic travelers; "Chị Lan" persona's primary payment method | MDR 1.5-2.5% wallet (higher than VNPay domestic); wallet-only (no card acceptance without additional integration); VND 100M monthly cap per user |
| VietQR first | Lowest MDR (<0.5-1%); fastest settlement (T+0/T+1); growing rapidly | No programmatic refund API (manual bank transfer only); accessed via partner bank, not direct; memo truncation risk = reconciliation failures |
| All at once | Maximum payment method coverage from day one; no customer payment friction | Triple integration effort; triple webhook/reconciliation complexity; delays launch; testing matrix explosion |

**Choice**: VNPay first → MoMo second → VietQR third (phased rollout)

**Reasons**:
- VNPay covers the widest customer base with a single integration — domestic cards, international cards (tourist segment "Marco"), QR, and e-wallets. No other single PSP covers both Vietnamese and international travelers (regulatory/psp-contract-terms.md, personas/customer-personas.md)
- MoMo is the primary payment method for the beachhead customer persona "Chị Lan" (migrant worker, 20-45yo, MoMo wallet + cash primary) and "Em Quan" (student, MoMo via family top-up) — must be live before or at Phase 1 launch on Thanh Hóa ↔ TPHCM corridor (personas/customer-personas.md, vietnam-market-context.md)
- VietQR deferred to post-launch cost optimization: lowest fees but no programmatic refund (manual bank transfer), and memo truncation risk is rated HIGH likelihood × HIGH impact (risk-matrix.md, regulatory/psp-contract-terms.md)
- Phased rollout reduces integration complexity per milestone — each PSP adapter normalizes to canonical `paid | failed | pending | unknown` enum behind a gateway-agnostic interface (domain-model/bounded-contexts.md)
- Production onboarding for each PSP requires ERC (Entity Registration Certificate) as a prerequisite — phased approach aligns with entity formation timeline (regulatory/compliance-timeline.md)

---

### 3. Settlement Timing — T+1 with Published Transparent Terms

| Option | Pros | Cons |
|--------|------|------|
| T+0 (instant) | Maximum operator cash flow; strongest competitive position | No buffer for chargebacks or disputes; operator withdraws before fraud detected; PSP settlement to BB may not be T+0 |
| **T+1 (1 business day)** | Fast enough to be competitive; 1-day buffer for dispute resolution and chargeback detection; aligns with VNPay/MoMo standard settlement to merchant | Tighter chargeback window than T+3; less float for platform operations |
| T+3 (3 business days) | More buffer for dispute resolution; aligns with original business docs proposal; moderate float | Slower than T+1; less competitive for cash-flow-constrained small operators |
| T+7 to T+14 (competitor baseline) | Maximum dispute resolution window; maximum float | Uncompetitive — settlement speed is the #2 operator churn trigger after brand control; VeXeRe advertises "direct deposits" to differentiate its BMS |

**Choice**: T+1 (SETTLEMENT_DELAY_DAYS = 1)

**Reasons**:
- Settlement speed is the #2 operator churn trigger after brand control — faster settlement directly addresses the pain point that drives operators away from incumbents (competitor-benchmark/operator-sentiment.md)
- Business docs originally proposed T+3 (competitor-benchmark/pricing-comparison.md); implementation settled on T+1 as both VNPay and MoMo offer T+1 standard settlement to merchants (regulatory/psp-contract-terms.md) — no reason to hold funds longer than the PSP does
- No competitor publishes settlement terms — publishing T+1 is a trust differentiator, especially for micro operators (60-70% of market, VND 500M-2B annual revenue) who cannot absorb cash flow gaps (personas/operator-personas.md, competitor-benchmark/pricing-comparison.md)
- 1-day buffer provides minimum viable dispute resolution window — Trip must reach `completed` status AND `completedAt + 1 day <= NOW()` before revenue is withdrawal-eligible (domain-model/ubiquitous-language.md, domain-model/event-flows.md)
- Revenue available for withdrawal is derived, never stored: `available = settled_eligible - paid_out`, where `settled_eligible` = SUM of non-payout/non-tax entries where trip status='completed' AND `completedAt + '1 day' <= NOW()` (domain-model/event-flows.md)
- Regulatory caveat: T+1 must be structured so PSP holds funds and settles directly to operator — if BB holds funds in transit even briefly, this triggers IPS classification (regulatory/payment.md, risk-matrix.md)

---

### 4. Webhook Verification & Idempotency — HMAC + Unique Constraint + Amount Guard

| Option | Pros | Cons |
|--------|------|------|
| Trust all webhooks | Simplest integration; no verification logic | Trivially forgeable; attacker sends fake "paid" webhook → free tickets; catastrophic security failure |
| HMAC verification only | Authenticates webhook origin; prevents forgery; MoMo and VNPay both provide HMAC signatures | Doesn't prevent replay attacks (same valid webhook delivered twice = double credit); doesn't catch amount mismatch |
| HMAC + idempotency via unique constraint | Prevents both forgery and replay; `@@unique([adapter, providerTxnId])` on PaymentEvent makes duplicates a no-op (Prisma P2002 → 200 return) | Doesn't catch amount manipulation (attacker intercepts, modifies amount, re-signs — unlikely with HMAC but defense-in-depth matters for money) |
| **HMAC + idempotency + amount guard** | Full defense stack: authenticates origin (HMAC), prevents replay (unique constraint), catches underpay/overpay (amount >= booking.totalVnd guard); always returns 200 to gateway (except 400 for invalid HMAC) | Most complex integration; overpay edge case needs handling (log + still mark paid); slight overhead per webhook |

**Choice**: HMAC + idempotency via unique constraint + amount guard (full defense stack)

**Reasons**:
- Payment webhook is the most security-critical endpoint — a forged or replayed webhook means free tickets or double-credited bookings. NAPAS/VietQR + MoMo rated as make-or-break stakeholders: "VietQR webhook not reconciled = money received but no ticket = worst CX" (stakeholder-map.md)
- MoMo IPN requires HMAC verification with exact `FAILURE_RESULT_CODES` per spec — vendor-doc supersets are explicitly prohibited (codes must be sourced from AC verbatim, never augmented from upstream vendor docs) (domain-model/invariants-catalog.md)
- VNPay requires return URL + IPN dual confirmation — both paths must be idempotent (stakeholder-map.md, domain-model/event-flows.md)
- PaymentEvent `@@unique([adapter, providerTxnId])` makes duplicate webhook deliveries a no-op: Prisma P2002 unique violation → catch → return 200 (domain-model/invariants-catalog.md)
- Amount guard: `amount >= booking.totalVnd` with currency='VND' verification. Overpay: log warning + still mark paid (defense-in-depth, not a blocker). Underpay: do not mark paid (domain-model/event-flows.md)
- Webhook always returns HTTP 200 to gateway (except 400 for invalid HMAC signature) — non-200 causes PSP retry storms that compound the problem (domain-model/event-flows.md)
- Post-paid transition: SELECT FOR UPDATE on Trip, recount paid seats, if `paid > capacity` → status='refunded' + post-commit refundOut (oversold race detection) (domain-model/event-flows.md, domain-model/invariants-catalog.md)

---

### 5. Ledger Design — Append-Only Double-Entry with PostgreSQL Immutability Trigger

| Option | Pros | Cons |
|--------|------|------|
| Single-entry balance column | Simplest model; one UPDATE per transaction; easy to read current balance | Balance is mutable (can be retroactively altered); no audit trail; reconciliation impossible; cannot reconstruct history; single point of failure for financial data |
| Event-sourced ledger | Complete history; can replay to any point; strong audit trail | Complex infrastructure (event store, projections, snapshots); eventual consistency complications; overkill for a booking platform with known, bounded entry types |
| **Append-only double-entry with DB trigger** | Balance always derived (never stored → never stale); PostgreSQL BEFORE UPDATE/DELETE trigger enforces immutability at DB level (not just app code); full audit trail; finite set of 9 entry types covers lifecycle; compatible with MISA e-invoice reconciliation | More complex queries (SUM over entries vs read column); append-only means corrections require reversal entries, not edits; trigger adds DB-level constraint that must be understood by all developers |
| External accounting SaaS (Xero, QuickBooks) | Professional-grade double-entry; regulatory compliance built in; tax reporting | Latency for real-time balance checks; API dependency for critical path; Vietnamese accounting standards may differ; cost per transaction; not designed for per-booking granularity |

**Choice**: Append-only double-entry with PostgreSQL immutability trigger

**Reasons**:
- Ledger immutability is a core business invariant — "No UPDATE/DELETE permitted, enforced by PostgreSQL BEFORE UPDATE/DELETE trigger (`ledger_entry_immutable`)" (domain-model/invariants-catalog.md)
- Balance is always derived, never stored — `available = settled_eligible - paid_out`. This eliminates stale-balance bugs and makes reconciliation deterministic (domain-model/ubiquitous-language.md, domain-model/event-flows.md)
- 9 entry types cover the full booking-to-payout lifecycle: `booking_credit`, `platform_fee`, `refund_debit`, `refund_out`, `payout_debit`, `payout_reversal`, `chargeback`, `adjustment`, `tax_withheld` (domain-model/ubiquitous-language.md)
- Platform fee stored as `ratePpm` (parts-per-million, e.g., 60000 = 6%) in FeeConfig with effective-dating — new row per rate change, never in-place edits. Supports global default + per-operator override (domain-model/ubiquitous-language.md)
- Same immutability pattern protects AdminAuditLog and ConsentRecord — consistent DB-level enforcement across all append-only tables (domain-model/bounded-contexts.md)
- `sourceEventId` unique constraint on LedgerEntry provides idempotency — prevents double-crediting from webhook replays or retry logic (domain-model/invariants-catalog.md)
- Finance/Accounting Manager persona requires: "payout queue, ledger reconciliation view, MISA push status, refund approval, tax export" — all derivable from append-only ledger entries without mutable state (personas/admin-personas.md)
- Event-sourced rejected: bounded set of 9 entry types with known semantics doesn't benefit from event-store infrastructure complexity; double-entry with derived balance achieves the same auditability (domain-model/bounded-contexts.md)

---

### 6. Currency Math — BigInt Domain with PPM Fee Encoding

| Option | Pros | Cons |
|--------|------|------|
| Number (IEEE 754 float) | Native JS type; no special handling; familiar to all developers | Representation drift: `gross * 0.06` is not the same value as `(gross * 6) / 100` for many gross values; half-even rounding fires on wrong side of tie; cumulative rounding errors → material financial discrepancies. Drift starts long before 2^53 ceiling. |
| Decimal.js library | Arbitrary-precision decimal; no representation drift; familiar API | External dependency; performance overhead on every arithmetic operation; bundle size; every developer must remember to use library, not native operators |
| **BigInt native** | Zero representation drift; exact integer arithmetic; no external dependency; detects exact ties via `remainder * 2 === denominator`; native to V8 engine | Cannot mix with Number operators (explicit conversion needed); ES2017 target requires `BigInt()` constructor calls (no `n` literal suffix); `JSON.stringify` doesn't handle BigInt (needs serialization layer) |
| Integer minor-unit with float multiplication | Simple mental model (VND is already integer); familiar arithmetic | Same IEEE 754 drift problem as Option A when multiplied by fractional rate (e.g., 6% fee); `Math.round(int * 0.06)` is the greppable smell |

**Choice**: BigInt native

**Reasons**:
- VND is integer currency (no minor unit), but platform fee computation requires multiplying integer `gross` by fractional `platformFeePct` (e.g., 6%). `Number` multiplication produces representation drift that flips half-even rounding on the wrong side of the tie — not a theoretical risk but a demonstrated failure mode caught during implementation (domain-model/invariants-catalog.md)
- Platform fee encoded as `ratePpm` (parts-per-million): `BigInt(Math.round(pct * 1e10)) / BigInt(1e10)`, all intermediate arithmetic in BigInt domain, exact tie detection via `remainder * BigInt(2) === denominator`, only `Number()` on the final integer result (domain-model/ubiquitous-language.md)
- ES2017 target constraint: `1n`/`2n`/`0n` literal suffixes are parser errors under `--target es2017`. Must use `BigInt(1)`/`BigInt(2)`/`BigInt(0)` constructor calls everywhere (domain-model/invariants-catalog.md)
- Greppable smell for violations: any `Math.round(<int> * <fractional>)` or `Math.floor(<minor-unit-int> * <rate>)` in money-handling modules is a bug — should be promoted to BigInt (domain-model/invariants-catalog.md)
- Decimal.js rejected: external dependency for a problem solvable with native BigInt; adds bundle weight and requires discipline to use library instead of native operators (same discipline problem, different solution)
- VND amounts can reach 10^11+ for a full bus (50 seats × 2M VND high-end ticket = 100M VND = 10^8, aggregate operator balance higher) — well within Number safe-integer range but representation drift from fractional multiplication starts at much lower values (market-research/business-model.md)

---

### 7. Reconciliation & Refund Strategy — PSP-Initiated Refund + Ledger Reversal

| Option | Pros | Cons |
|--------|------|------|
| Manual bank transfer refunds | No PSP API integration needed; works with any payment method; admin controls timing | Slow (days); error-prone (wrong account, wrong amount); no audit trail; worst customer experience; violates 24-48h refund target |
| **PSP-initiated refund via API** | Refund to original payment method (highest trust); automated; audit trail via PaymentEvent; integrates with ledger reversal entries; 24-48h achievable | Requires per-PSP refund API integration; VietQR has no programmatic refund (manual fallback needed); refund fees may apply; PSP may reject refund after settlement window |
| Platform credit/voucher only | Zero PSP integration; instant; retains funds in ecosystem; simple implementation | Not a real refund — customer's money is trapped; #1 complaint pattern at competitors; likely violates Consumer Protection Law 59/2023 complaint resolution requirements; destroys trust |

**Choice**: PSP-initiated refund via MoMo + VNPay refund APIs, with manual bank transfer fallback for VietQR

**Reasons**:
- Refund is the #1 user pain point across all Vietnamese bus booking platforms — VeXeRe's 2.7-star Trustpilot is dominated by "slow refund" complaints. Automated refund-to-original-payment within 24-48h is a stated trust differentiator (market-research/user-insights.md, risk-matrix.md)
- PSP refund not implemented is rated HIGH impact, CERTAIN likelihood as a risk — "no customer refund possible with real keys" (risk-matrix.md). Must be live before issue 094 go-live (vietnam-market-context.md)
- Ledger reversal maintains double-entry integrity: `refund_debit` (reverses booking_credit) + `refund_out` (records outbound refund to customer). Both entries are append-only, keyed by `refund_out:<key>` for replay-guard idempotency (domain-model/event-flows.md, domain-model/ubiquitous-language.md)
- `refund_out` entries deliberately excluded from operator available balance computation — these are platform-float (the platform absorbs the refund timing mismatch between PSP refund and operator settlement) (domain-model/event-flows.md)
- Trip cancellation triggers bulk refund: `cancelTrip` → bulk UPDATE bookings to `trip_cancelled` → post-commit `refundOut` per paid booking, keyed `cancel:<tripId>:<bookingId>` (domain-model/event-flows.md)
- Oversold race refund: if `paid_count > capacity` detected at webhook processing time → immediate status='refunded' + post-commit refundOut in same transaction (domain-model/event-flows.md, domain-model/invariants-catalog.md)
- VietQR has no programmatic refund API — manual bank transfer is the only option. VietQR reconciliation dashboard in admin is required to flag unmatched payments for manual resolution (risk-matrix.md, regulatory/psp-contract-terms.md)
- Platform credit/voucher rejected: Consumer Protection Law 59/2023 requires complaint resolution with clear response timelines — trapping customer funds in platform credit likely violates this and is the exact pattern generating negative reviews for competitors (regulatory/consumer-protection.md, market-research/user-insights.md)

---

## Consequences

### Positive
- PSP split-settlement eliminates SBV IPS license requirement — the single highest-severity regulatory risk is structurally removed
- Phased PSP rollout (VNPay → MoMo → VietQR) reduces per-milestone integration complexity while covering the widest customer base first
- T+1 published settlement is the fastest in the Vietnamese bus booking market — directly addresses the #2 operator churn trigger
- Full webhook defense stack (HMAC + unique + amount guard) prevents the three most damaging payment failure modes: forgery, replay, and amount mismatch
- Append-only double-entry ledger with DB-enforced immutability makes retroactive balance alteration impossible at the database level, not just the application level
- BigInt currency math eliminates IEEE 754 representation drift — no cumulative rounding errors in fee computation or payout calculation
- PSP-initiated refund to original payment method is the strongest available trust signal — directly counters the #1 complaint against competitors

### Negative
- PSP split-settlement requires each operator to open their own merchant account — onboarding friction, especially for micro operators (60-70% of market) with low tech literacy
- VietQR has no programmatic refund API — manual bank transfer fallback is slow and error-prone for VietQR-originated payments
- T+1 settlement provides only a 1-day buffer for dispute resolution — chargebacks or fraud detected after payout are harder to recover
- Append-only ledger means corrections require reversal entries (`adjustment`, `payout_reversal`) — no "just fix the number" path; every correction is visible in the audit trail
- BigInt arithmetic requires explicit conversion at every boundary (`Number()` for JSON serialization, `BigInt()` for arithmetic entry) — developer discipline required
- E-wallet transaction limits (VND 100M/month, VND 10M biometric trigger) may cause mid-checkout failures for group bookings on premium routes

### Mitigations
- Operator merchant onboarding friction: white-glove onboarding for first 10-20 operators (vietnam-market-context.md); operator console guides through PSP setup; admin persona (Operations Manager) handles document verification (personas/admin-personas.md)
- VietQR refund gap: admin reconciliation dashboard flags unmatched VietQR payments; manual resolution documented in support agent workflow; VietQR is Phase 3 (post-launch), so gap doesn't block go-live (regulatory/psp-contract-terms.md)
- T+1 chargeback risk: payout account verification gate (any edit resets `verifiedAt` to null, blocking withdrawals until re-verified) prevents attacker from changing payout destination and immediately withdrawing (domain-model/invariants-catalog.md)
- Ledger correction overhead: reversal entries are an audit feature, not a bug — GDT (General Department of Taxation) compliance requires traceable corrections, not invisible edits (regulatory/einvoice-tax.md)
- BigInt discipline: greppable smell documented (`Math.round(<int> * <fractional>)` in money-handling modules = bug); ESLint or code review catches violations (domain-model/invariants-catalog.md)
- E-wallet limits: display payment method limits before checkout; suggest VNPay card payment for amounts approaching VND 10M; document limit in booking flow UI (regulatory/payment.md)

---

## References

All decisions sourced exclusively from `documentation/business/`:

| Document | Cited In |
|----------|----------|
| risk-matrix.md | D1, D2, D3, D4, D7 |
| regulatory/payment.md | D1, D3, D6 (Mitigations) |
| regulatory/psp-contract-terms.md | D1, D2, D3, D7 |
| regulatory/compliance-timeline.md | D2 |
| regulatory/consumer-protection.md | D7 |
| regulatory/einvoice-tax.md | Mitigations |
| market-research/user-insights.md | D2, D7 |
| market-research/business-model.md | D6 |
| market-research/regulatory-compliance.md | D1 |
| market-research/risk-register.md | D7 |
| domain-model/invariants-catalog.md | D1, D4, D5, D6, D7, Mitigations |
| domain-model/event-flows.md | D3, D4, D5, D7 |
| domain-model/bounded-contexts.md | D2, D4, D5 |
| domain-model/ubiquitous-language.md | D3, D5, D6, D7 |
| domain-model/state-machines.md | D5 |
| personas/customer-personas.md | D2 |
| personas/operator-personas.md | D3 |
| personas/admin-personas.md | D5, Mitigations |
| competitor-benchmark/pricing-comparison.md | D3 |
| competitor-benchmark/operator-sentiment.md | D1, D3 |
| competitor-benchmark/feature-parity-matrix.md | D2 |
| stakeholder-map.md | D4 |
| vietnam-market-context.md | D1, D2, D3, D7 |
