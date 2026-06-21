# FI-010: Payout System (He thong chi tra)

> **Status:** DOCUMENTED
> **Last Updated:** 2026-06-20
> **Related:** ADR-005, ADR-006, ADR-012, ADR-019, DS-001, DS-009, DS-011

## Overview

FI-010 covers the operator payout pipeline: the settlement process after a trip completes (T+1 delay), the on-demand withdrawal flow, the `settlePayout` cron that processes `Payout` rows through `requested -> processing -> paid | failed`, and the tax withholding computation applied to individual/household operators. Balance is always derived from the append-only ledger (never stored as a column). The current implementation uses central collection (platform holds funds and disburses), pending migration to PSP split-settlement.

## Scope & Boundaries

### In Scope

- Payout row creation at `Trip: departed -> completed` (`completeTripCore`, `autoCompleteTrips` cron)
- T+1 settlement delay enforcement (`SETTLEMENT_DELAY_DAYS = 1`, `scheduledAt = completedAt + 1 day`)
- `settlePayout` cron: two-phase pipeline `requested -> processing -> paid | failed`
- On-demand withdrawal: `requestWithdrawal()`, balance check, `PayoutAccount.verifiedAt` gate
- Balance derivation: `available = settled_eligible - paid_out` from ledger SUM
- `calcPayout` (BigInt arithmetic for platform fee)
- `calcWithholding` (BigInt arithmetic for VAT 3% + PIT 1.5% on individual/household operators)
- Tax withholding ledger entries (`tax_withheld_vat`, `tax_withheld_pit`)
- Operator tax summary API + PDF certificate
- Admin tax summary API + quarterly filing tracking
- `retryPayout` (admin: `failed -> requested`)
- PayoutAccount management and `verifiedAt` reset gate

### Out of Scope

- Payment webhook receipt -> [FI-008](../FI-008-payment-integration/README.md)
- Refund processing -> [FI-008](../FI-008-payment-integration/README.md) / DS-007
- Split-settlement target architecture -> DS-009 (documented but not yet implemented)
- E-invoice MISA submission -> [FI-015](../FI-015-e-invoice/README.md) / DS-014
- FCT (foreign contractor tax) -> operational, not product scope per DS-011 S8.3
- Operator KYB / onboarding -> [FI-002](../FI-002-operator-onboarding/README.md)

### Bounded Context(s)

**Finance/Ledger Context** -- LedgerEntry, Payout, FeeConfig, PayoutAccount, SubscriptionPlan/OperatorSubscription. Double-entry accounting with append-only immutability. Balance derived, never stored.

**Operator Context** -- `taxClassification` on Operator model determines withholding behavior. Operator-scoped data access via `withOperatorScope`.

**Background Jobs Context** -- `settlePayout` cron (every 5 min), `autoCompleteTrips` cron (every 15 min). Two-phase pipeline with `FOR UPDATE SKIP LOCKED`.

**Admin Context** -- `retryPayout`, payout queue management, tax withholding summary, quarterly filing tracking.

## Key Entities

### Payout

| Model | Key Columns | Constraints | Notes |
|-------|-------------|-------------|-------|
| Payout | id (CUID PK), tripId (String? FK->Trip onDelete:Restrict), operatorId (String FK->Operator), gross (Int VND), platformFee (Int VND), net (Int VND), taxVat (Int default 0), taxPit (Int default 0), taxTotal (Int default 0), status (PayoutStatus default `requested`), scheduledAt (DateTime), settledAt (DateTime?), failureReason (String?), createdAt (DateTime default `now()`), updatedAt (DateTime `@updatedAt`) | PayoutStatus enum: `requested \| processing \| paid \| failed`. Terminal state: `paid` | On-demand withdrawal: `tripId = null`, `scheduledAt = NOW()`, `platformFee = 0`, `net = gross`. Idempotency: `findFirst` before insert for per-trip dedup. Int columns risk overflow at ~2.1B VND |

### LedgerEntry (Payout-relevant entry types)

| Entry Type | Sign | When Written | sourceEventId Pattern |
|-----------|------|-------------|----------------------|
| `booking_credit` | + | At booking `paid` webhook | `booking:<bookingId>` |
| `platform_fee` | - | At booking `paid` webhook | `fee:<bookingId>` |
| `payout_debit` | - | At payout settlement (auto-sweep) or immediately (on-demand withdrawal) | `payout_debit:<payoutId>` |
| `payout_reversal` | + | Admin retry correction | -- |
| `tax_withheld_vat` | - | At payout settlement (INDIVIDUAL/HOUSEHOLD only) | `tax_vat:<payoutId>` |
| `tax_withheld_pit` | - | At payout settlement (INDIVIDUAL/HOUSEHOLD only) | `tax_pit:<payoutId>` |
| `adjustment` | +/- | Corrections; also withdrawal idempotency marker | `withdraw-key:<idempotencyKey>` |
| `refund_debit` | - | At refund completion | `refund_out:<key>` |

**LedgerEntry.amount** is `BigInt` (signed). The `payoutId` column has NO foreign key constraint (decoupled from Payout model).

### PayoutAccount

| Model | Key Columns | Constraints | Notes |
|-------|-------------|-------------|-------|
| PayoutAccount | id (CUID PK), operatorId (String @unique), bankName (String), accountNumber (String), accountHolderName (String), verifiedAt (DateTime?), verifyMethod (String?: `'name_match' \| 'micro_deposit'`), createdAt (DateTime default `now()`), updatedAt (DateTime `@updatedAt`) | One per operator (`@unique` on operatorId). `verifiedAt IS NOT NULL` required for any payout/withdrawal | `accountNumber` is T2 sensitive PII: AES-256-GCM encrypted at application layer, masked to last-4 on API responses, log-redacted. Any edit to bankName/accountNumber/accountHolderName resets `verifiedAt = null` |

### FeeConfig

| Model | Key Columns | Constraints | Notes |
|-------|-------------|-------------|-------|
| FeeConfig | id (CUID PK), operatorId (String? FK->Operator onDelete:Restrict), ratePpm (Int), effectiveFrom (DateTime), effectiveTo (DateTime?), createdBy (String?), createdAt (DateTime default `now()`) | NULL operatorId = global default; non-null = per-operator override | ratePpm=60000 = 6% default. Effective-dated: never edit in place. Resolution order: (1) Active SubscriptionPlan.ratePpm, (2) Per-operator FeeConfig override, (3) Global FeeConfig default |

### SubscriptionPlan

| Model | Key Columns | Constraints | Notes |
|-------|-------------|-------------|-------|
| SubscriptionPlan | id (CUID PK), name (String), monthlyFeeVnd (Int), ratePpm (Int), isActive (Boolean default true), createdAt (DateTime default `now()`) | -- | Overrides FeeConfig.ratePpm when operator has active subscription |

### OperatorSubscription

| Model | Key Columns | Constraints | Notes |
|-------|-------------|-------------|-------|
| OperatorSubscription | id (CUID PK), operatorId (String @unique), planId (String FK->SubscriptionPlan), startsAt (DateTime), endsAt (DateTime?), status (SubscriptionStatus default `active`), billingCycleDay (Int 1-28), nextBillingAt (DateTime), createdAt (DateTime default `now()`), updatedAt (DateTime `@updatedAt`) | One per operator (`@unique` on operatorId). SubscriptionStatus: `active \| cancelled \| expired \| past_due` | NULL `endsAt` = auto-renew. `nextBillingAt` is cron predicate column |

## API Endpoints

### Operator-Facing Payout Endpoints

| Method | Path | Auth | Description | Status Codes |
|--------|------|------|-------------|--------------|
| GET | `/api/op/payouts` | Operator JWT (`requireOperatorAuth`) | List operator's payouts (paginated, status/date filters) | 200 |
| POST | `/api/op/payouts/withdraw` | Operator JWT | Request on-demand withdrawal (idempotencyKey required). Guards: `PayoutAccount.verifiedAt`, `available >= amount`, `amount >= MIN_WITHDRAW_THRESHOLD_VND` | 200 `{ok:true, payoutId}` or `{ok:false, reason}` |
| GET | `/api/op/payouts/balance` | Operator JWT | Operator available balance (derived, never stored) | 200 `{pending, available, paidOut}` |
| GET | `/api/op/tax/withholding-summary` | Operator JWT | Aggregated tax withholding for year/quarter | 200 |
| GET | `/api/op/payout-account` | Operator JWT | Get payout account details (accountNumber masked to last-4) | 200 |
| PUT | `/api/op/payout-account` | Operator JWT | Update payout account (resets `verifiedAt` to null) | 200 |

### Admin Payout Endpoints

| Method | Path | Auth | Description | Status Codes |
|--------|------|------|-------------|--------------|
| GET | `/api/admin/payouts` | Admin JWT | List all payouts with filters | 200 |
| POST | `/api/admin/payouts/{id}/retry` | Admin JWT | Retry failed payout (`failed -> requested`) | 200, 422 |
| GET | `/api/admin/tax/withholding-summary` | Admin JWT | Cross-operator withholding summary (year, quarter, taxClassification, operatorId filters) | 200 |
| POST | `/api/admin/payout-account/{id}/verify` | Admin JWT | Verify operator payout account (sets `verifiedAt`) | 200 |

### Cron Endpoints (Vercel Cron)

| Method | Path | Schedule | Description | Status Codes |
|--------|------|----------|-------------|--------------|
| POST | `/api/cron/settle-payout` | Every 5 min | `settlePayout` -- two-phase: `requested -> processing -> paid/failed` for `scheduledAt <= NOW()` rows | 200 |
| POST | `/api/cron/auto-complete-trips` | Every 15 min | `autoCompleteTrips` -- departed trips past expected window -> `completed`, creates Payout rows | 200 |

## State Machine

### Payout Status (state-machines.md S4)

**States:** `requested` | `processing` | `paid` | `failed`

**Terminal state:** `paid`

| From | To | Trigger | Guard |
|------|----|---------|-------|
| *(creation)* | `requested` | `completeTripCore` (auto-sweep per trip) OR `requestWithdrawal` (on-demand, `tripId = null`) | Auto-sweep: `scheduledAt = completedAt + 1d`. Withdrawal: `scheduledAt = NOW()`, requires verified PayoutAccount and `available >= amountMinor` |
| `requested` | `processing` | `settlePayout` cron begins bank transfer | `scheduledAt <= NOW()`, `FOR UPDATE SKIP LOCKED` |
| `processing` | `paid` | Bank transfer confirmed | Sets `settledAt` |
| `processing` | `failed` | Bank transfer rejected | Sets `failureReason` |
| `failed` | `requested` | Admin retry (`lib/ledger/retryPayout.ts`) | Human-in-the-loop |

### Ledger Integration

- **Auto-sweep payouts:** `payout_debit` LedgerEntry written when Payout transitions to settled
- **On-demand withdrawals:** `payout_debit` LedgerEntry written at `requested` time (immediately reserves amount), keyed `payout_debit:<payoutId>`
- **Payout reversals (`failed -> requested` retry):** `payout_reversal` entry may be written to correct the ledger

### Trip Completion -> Payout Creation

| Transition | Side Effect for Payout |
|-----------|----------------------|
| `departed -> completed` | Sets `completedAt = NOW()`. Creates Payout row (`status='requested'`, `scheduledAt = completedAt + 1d`). Enqueues `payout_scheduled` NotificationLog per paid booking with `scheduledFor` as top-level column (not in JSON payload -- Mistake Log Issue 014) |

## Business Rules & Invariants

1. **T+1 Settlement Delay** -- Revenue available only when `completedAt + 1 day <= NOW()` (`SETTLEMENT_DELAY_DAYS = 1`). Provides dispute buffer. Enforcement: `lib/ledger/constants.ts`, `lib/ledger/balance.ts`, `lib/trips/completeTripCore.ts`.

2. **Balance Derivation** -- Available balance is derived, never stored: `available = settled_eligible - paid_out`. `settled_eligible` = SUM of non-payout/non-tax entries where trip `status='completed'` AND `completedAt + '1 day' <= NOW()`. `refund_out` excluded. Enforcement: `lib/ledger/balance.ts` -> `getOperatorBalance()`.

3. **PayoutAccount Verification Gate** -- Withdrawals and payouts only proceed when `PayoutAccount.verifiedAt IS NOT NULL`. Any edit to account fields resets `verifiedAt = null`. Enforcement: `lib/ledger/withdrawal.ts` + `lib/onboarding/payoutAccount.ts`.

4. **BigInt Math (payouts)** -- `calcPayout`: `platformFee = gross * feePpm / 1_000_000` (BigInt). `calcWithholding`: `taxVat = operatorShare * 30000 / 1_000_000` (BigInt). ES2017: `BigInt(n)` constructor only -- `1n`/`2n`/`0n` literal suffixes are parser errors. Greppable bug: `Math.round(<int> * <fractional>)` in `lib/payouts/**`. Enforcement: `lib/ledger/calcPayout.ts`, `lib/tax/calcWithholding.ts`.

5. **Two-Phase Payout Pipeline** -- `requested -> processing` (mark before PSP call; prevents double-settlement on next cron). `processing -> paid/failed` (after PSP confirms/rejects). Each payout settles independently. Enforcement: `settlePayout` cron.

6. **FOR UPDATE SKIP LOCKED** -- Cron uses `FOR UPDATE SKIP LOCKED` batch (batch size configurable) to allow concurrent cron invocations to process different rows safely. Enforcement: `settlePayout` cron SQL.

7. **Idempotency (Payout creation)** -- `findFirst` before insert -- dedup per trip. Enforcement: `completeTripCore`.

8. **Idempotency (Withdrawal)** -- Double-probe: `withdraw-key:<idempotencyKey>` marker in LedgerEntry checked outside and inside `$transaction`. Enforcement: `lib/ledger/withdrawal.ts`.

9. **Minimum Withdrawal** -- `MIN_WITHDRAW_THRESHOLD_VND = 100,000 VND`. Enforcement: `requestWithdrawal()`.

10. **Tax Withholding (Decree 117/2025)** -- COMPANY: 0% withholding (self-declares). INDIVIDUAL/HOUSEHOLD: VAT 3% (`ratePpm = 30000`) + PIT 1.5% (`ratePpm = 15000`) = 4.5% total. Applied at payout settlement time, not at booking-paid time. Enforcement: `calcWithholding()` (NOT_IMPLEMENTED per ADR-006 D7).

11. **Separate VAT/PIT Entries** -- Two separate LedgerEntry rows (`tax_withheld_vat` + `tax_withheld_pit`) -- NOT combined -- because GDT quarterly filing requires separate VAT and PIT totals. Enforcement: DS-011 S6.1.

12. **scheduledFor as Top-Level Column** -- `NotificationLog.scheduledFor` is a top-level indexed column (NOT in JSON payload). Required for cron WHERE clause predicate indexability. `@@index([template, scheduledFor])`. Enforcement: `completeTripCore`.

13. **Ledger Immutability** -- All LedgerEntry rows (incl. tax entries) are append-only. No UPDATE/DELETE. Corrections via new `tax_adjustment_vat`/`tax_adjustment_pit` rows. Enforcement: PostgreSQL `BEFORE UPDATE/DELETE` trigger.

14. **Payout Processing Stranding** -- If cron crashes between `processing` and `paid/failed`, payout stays in `processing` indefinitely. No auto-recovery documented. Manual admin investigation required.

### Payout Calculation Chain (DS-011 S4.3)

```
grossBookingAmount (Booking.totalVnd)
  |
  +-- calcPayout(grossBookingAmount, platformFeePpm)
  |   +-- platformFee = gross * feePpm / 1_000_000  (BigInt)
  |   +-- operatorShare = gross - platformFee
  |
  +-- calcWithholding(taxClassification, operatorShare)
      +-- taxVat = operatorShare * 30000 / 1_000_000  (BigInt) [3%]
      +-- taxPit = operatorShare * 15000 / 1_000_000  (BigInt) [1.5%]
      +-- taxTotal = taxVat + taxPit
      +-- netAmount = operatorShare - taxTotal
          |
          +-- Payout to operator bank = netAmount
```

**Example** (VND 500,000 ticket, 6% platform fee, INDIVIDUAL operator):

| Step | Calculation | Amount (VND) |
|------|-------------|--------------|
| Gross booking | -- | 500,000 |
| Platform fee (6%) | 500,000 x 60,000 / 1,000,000 | 30,000 |
| Operator share | 500,000 - 30,000 | 470,000 |
| VAT withheld (3%) | 470,000 x 30,000 / 1,000,000 | 14,100 |
| PIT withheld (1.5%) | 470,000 x 15,000 / 1,000,000 | 7,050 |
| Tax total | 14,100 + 7,050 | 21,150 |
| Net to operator bank | 470,000 - 21,150 | 448,850 |

## Frontend Surfaces

| Page | Path | Key Components | Notes |
|------|------|----------------|-------|
| Revenue Report | `/op/reports/revenue` | Booking revenue, platform fee, operator share breakdown. Default date-range computed in module-scope helper (NOT in RSC render body -- Mistake Log Issue 016) | Operator-scoped. CSV export supported |
| Payout Queue | `/op/payouts` | List of Payout rows with status, scheduledAt, settledAt, net amount | Paginated with status/date filters |
| Withdrawal Request | `/op/payouts/withdraw` | Form for on-demand withdrawal. Shows available balance, minimum threshold (VND 100,000), requires verified PayoutAccount | Idempotency key in request body |
| Payout Account Settings | `/op/settings/payout` | Bank account details (accountNumber masked to last-4), verifiedAt status, edit triggers re-verification | Any field edit resets verifiedAt |
| Tax Withholding Summary | `/op/tax` | Year/quarter summary for operator's own GDT filings. PDF certificate download | INDIVIDUAL/HOUSEHOLD operators only |
| Admin Payout Queue | `/admin/payouts` | All operators' payouts, retry button for `failed` payouts, filter by status | Admin Finance persona |
| Admin Tax Summary | `/admin/tax` | Cross-operator withholding totals, quarterly filing deadlines, remittance status toggle | Quarterly remittance tracking |

## Regulatory Requirements

| Law/Decree | Requirement | Impact |
|------------|-------------|--------|
| ADR-005 D3 (business decision) | T+1 settlement delay: trip must reach `completed` AND `completedAt + 1 day <= NOW()` before revenue is withdrawal-eligible. If BB holds funds in transit, triggers IPS classification | Current implementation holds funds (central collection risk) |
| E-Commerce Law 2025 (eff. 1 Jul 2026) + Decree 117/2025/ND-CP | Platforms must withhold and remit VAT ~3% + PIT ~1.5% from individual/household operators. Remit to GDT quarterly. Issue withholding certificates | NOT_IMPLEMENTED -- schema ready (columns exist, zero values), no `calcWithholding()` in service layer |
| Decree 117/2025 | Issue "CHUNG TU KHAU TRU THUE" per quarter/year. Fields: platform MST, operator MST, period, total income, VAT withheld, PIT withheld | PDF generation not implemented |
| GDT quarterly deadlines | Q1: April 30. Q2: July 30. Q3: October 30. Q4: January 30 (next year). Non-compliance: 1x-3x fine + 0.03%/day interest | No automated remittance; admin manual toggle |
| Decree 117/2025 | COMPANY: no withholding (self-declares). INDIVIDUAL/HOUSEHOLD: 4.5% withheld. Classification set at operator KYB via `taxClassification` field | Field exists on Operator model; classification at onboarding TBD |
| Decree 123/2020 + Circular 32/2025/TT-BTC | Platform must issue B2B VAT e-invoice to operators for commission earned | Commission B2B invoice NOT implemented |
| PDPL 2025 | `accountNumber` AES-256-GCM encrypted at application layer. Masked to last-4 on all API responses. Log-redacted | Go-live blocker noted in DS-001 |

## Testing Strategy

### Unit Tests

- `calcPayout` BigInt arithmetic (incl. edge cases where Number/BigInt diverge)
- `calcWithholding` for each `taxClassification` (COMPANY -> 0%, INDIVIDUAL -> 4.5%)
- `getEffectiveFeeRate` resolution (subscription plan -> operator override -> global default)
- Payout state machine transitions: valid and invalid
- `requestWithdrawal` discriminated result variants

### Integration Tests

- `settlePayout` two-phase transition with `SELECT FOR UPDATE`
- `LedgerEntry.sourceEventId` unique constraint (idempotency)
- `payout_debit` and `tax_withheld_vat/pit` entries written in same transaction
- `PayoutAccount.verifiedAt IS NOT NULL` guard
- `available >= amountMinor` balance check under lock
- `completeTripCore` Payout row creation idempotency (`findFirst` before insert)
- `scheduledFor` as top-level column: assert payload does NOT contain `scheduledFor` (Mistake Log Issue 014)
- Concurrent-write integration test for withdrawal lock

### E2E Tests

- Trip complete -> payout created -> operator views balance -> withdrawal -> admin sees payout queue
- Sandbox-gated PSP specs
- Revenue report page: default date range computed correctly (module-scope helper, not RSC render body)

**Critical BigInt rules (SI-005 S8):**
- `Math.round(<int> * <fractional>)` anywhere in `lib/payouts/**` or `lib/tax/**` = greppable bug
- `Math.floor(<minor-unit-int> * <rate>)` = greppable bug
- `Number(<bigint>) * <rate>` = converts back to float before rate multiplication = bug
- ES2017 target: `BigInt(n)` constructor only; `1n`/`2n`/`0n` literal suffixes are parser errors

## Cross-References

- **Architecture Decisions:** [ADR-005](../../architecture-decisions/ADR-005-payment-architecture/README.md), [ADR-006](../../architecture-decisions/ADR-006-pricing-currency/README.md), [ADR-012](../../architecture-decisions/ADR-012-background-jobs/README.md), [ADR-019](../../architecture-decisions/ADR-019-state-machines/README.md)
- **Design Specifications:** [DS-001](../../design-specifications/DS-001-data-model/README.md), [DS-009](../../design-specifications/DS-009-split-settlement/README.md), [DS-011](../../design-specifications/DS-011-tax-withholding/README.md)
- **Frontend Design:** [FD-024](../../frontend-design/FD-024-operator-console/README.md)
- **Business/Domain:** [bounded-contexts.md](../../business/domain-model/bounded-contexts.md), [state-machines.md](../../business/domain-model/state-machines.md), [invariants-catalog.md](../../business/domain-model/invariants-catalog.md), [event-flows.md](../../business/domain-model/event-flows.md), [ubiquitous-language.md](../../business/domain-model/ubiquitous-language.md)
- **Regulatory:** [payment.md](../../business/regulatory/payment.md), [psp-contract-terms.md](../../business/regulatory/psp-contract-terms.md)
- **Scaffolding:** [SI-005](../../scaffolding-infra/SI-005-testing-strategy/README.md)

## Known Gaps & Open Questions

- **CRITICAL -- Tax withholding NOT_IMPLEMENTED** -- E-Commerce Law 2025 effective 1 Jul 2026. Schema columns exist (`taxVat`, `taxPit`, `taxTotal` default 0); `calcWithholding()` service function absent; no withholding in `settlePayout` cron. Must implement before 1 Jul 2026.
- **CRITICAL -- Split-settlement target architecture not implemented** -- Current central collection model means platform holds funds; payout cron performs actual bank transfers. Under split-settlement, `settlePayout` would confirm PSP settlement (no money movement). Implement split-settlement OR obtain legal opinion before significant transaction volume.
- **HIGH -- Tax rates unconfirmed** -- 3% VAT + 1.5% PIT are estimates from business docs. GDT may publish different rates for transport service category. Verify with tax counsel before go-live.
- **HIGH -- Chargeback reserve not implemented** -- No holdback reserve; T+1 disbursement exposes platform to 45-90 day VNPay chargeback window.
- **HIGH -- Payout Int overflow** -- `gross`, `platformFee`, `net`, `taxVat`, `taxPit`, `taxTotal` are `Int` (max ~2.1B VND). Busy operators could approach this in months. Migrate Payout amount columns to BigInt before single payout batch exceeds 2.1B VND.
- **MEDIUM -- Commission B2B invoice not implemented** -- Circular 32/2025/TT-BTC: platform must issue VAT invoice to operator for commission. Must design and implement; likely extends DS-014.
- **MEDIUM -- Tax withholding certificate PDF** -- JSON API defined (DS-011 S7); PDF template not designed. Requires legal review for compliant layout.
- **MEDIUM -- Payout `processing` stranding** -- No auto-recovery if cron crashes between `processing` and `paid/failed`. Design timeout/cleanup or admin alert for stranded `processing` payouts.
- **MEDIUM -- Revenue threshold exemption** -- Individual operators below a certain annual revenue may be exempt from withholding; threshold not confirmed in Decree 117/2025. Verify with tax counsel.
- **MEDIUM -- Retroactive withholding** -- If individual operators received payouts without withholding before feature launch, current quarter may need assessment. Define correction workflow.
- **LOW -- GDT electronic filing integration** -- Manual quarterly GDT portal filing acceptable initially. Automation deferred post-launch.
- **LOW -- Rate change effective date handling** -- Current compile-time constants; no rate schedule table for mid-quarter rate changes. Build if GDT changes rates.
- **LOW -- FCT remittance automation** -- Monthly totals < USD 100; manual is acceptable. No action needed for Stage 0.
