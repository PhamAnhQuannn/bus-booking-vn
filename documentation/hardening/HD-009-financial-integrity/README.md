# HD-009: Financial Integrity Audit

> Status: NOT_STARTED | References: ADR-005 D5/D6, FI-010, FI-007, Mistake Log Issue 016

## Purpose

Verify integrity of all money-handling paths: append-only ledger, currency arithmetic (BigInt), commission calculation, payout settlement, and tax withholding. A bug here means real money lost or incorrect operator payouts.

## Skill Invocation

- **Primary**: `/security-review` -- financial data integrity
- **Supplementary**: `/observability-review` -- payout pipeline monitoring

## Acceptance Criteria

### Ledger Immutability (ADR-005 D5)

- [ ] PostgreSQL trigger `ledger_entry_immutable` active: `BEFORE UPDATE` returns error
- [ ] PostgreSQL trigger `ledger_entry_immutable` active: `BEFORE DELETE` returns error
- [ ] Integration test: `UPDATE LedgerEntry SET ...` throws trigger error
- [ ] Integration test: `DELETE FROM LedgerEntry WHERE ...` throws trigger error
- [ ] Corrections use reversal entries only (append new row, never edit existing)

### Ledger Entry Types

- [ ] All 9 entry types present in schema and exercised by tests:
  - [ ] `booking_credit` -- customer payment received
  - [ ] `platform_fee` -- commission deducted
  - [ ] `refund_debit` -- refund issued to customer
  - [ ] `refund_out` -- refund disbursed
  - [ ] `payout_debit` -- operator payout initiated
  - [ ] `payout_reversal` -- failed payout reversed
  - [ ] `chargeback` -- PSP chargeback received
  - [ ] `adjustment` -- manual correction
  - [ ] `tax_withheld` -- tax deducted per E-Commerce Law 2025

### Currency Arithmetic (Mistake Log Issue 016)

- [ ] All currency math uses BigInt -- no `Number` multiplication of minor-unit integers by fractional rates
- [ ] Greppable: zero hits for `Math.round(<int> * <fractional>)` or `Math.floor(<int> * <rate>)` in `lib/payouts/**` and any money module
- [ ] Platform fee encoded as `ratePpm` (parts-per-million) in BigInt domain
- [ ] BigInt uses `BigInt()` constructor calls (not `n` literal suffix -- ES2017 target constraint)
- [ ] Half-even rounding for exact ties uses `remainder * BigInt(2) === denominator` (not `Number` `=== 0.5`)

### Commission Calculation

- [ ] Default platform fee: 6% (ADR-005) -- verify `ratePpm = 60000`
- [ ] `calcPayout` function: `operatorNet = gross - platformFee - taxWithheld`
- [ ] Balance derived (never stored): `available = settled_eligible - paid_out`
- [ ] Idempotency: `LedgerEntry.sourceEventId` unique constraint prevents double-entry

### Payout Settlement Pipeline

- [ ] `settlePayout` cron: batch size 500, `FOR UPDATE SKIP LOCKED`
- [ ] Payout state machine: `pending -> processing -> settled -> failed -> reversed`
- [ ] Stranded `processing` payouts: auto-recovery mechanism OR documented manual process
- [ ] Payout reconciliation sweeper cron built (FI-008 gap) OR explicit deferral

### Tax Withholding (E-Commerce Law 2025, effective Jul 2026)

- [ ] `calcWithholding()` service function implemented (FI-010 -- currently absent)
- [ ] Individual/household operators: ~3% VAT + ~1.5% PIT
- [ ] Corporate operators: exempt (self-report)
- [ ] `taxVat`, `taxPit`, `taxTotal` columns populated in payout record
- [ ] Withholding integrated into `settlePayout` cron (deducted before operator net)
- [ ] If pre-Jul-2026 launch: deferral documented with implementation deadline

### Refund & Dispute Handling (Phase 1: Bank Transfer)

- [ ] No PSP chargebacks on bank transfers (push-only; no pull-back mechanism)
- [ ] No holdback reserve needed for Phase 1
- [ ] Manual refund process documented: admin initiates reverse bank transfer to customer
- [ ] Refund ledger entries (`refund_debit` + `refund_out`) created when admin confirms manual transfer
- [ ] Memo mismatch (~5%): unmatched transfers queued for admin reconciliation (HD-006)
- [ ] T+3 payout window provides buffer for dispute investigation before operator receives funds
- [ ] **Phase 2 note:** re-add chargeback reserve section when MoMo/VNPay ship (45-90 day chargeback window applies to PSP payments)

## Verdict

**PASS** when: ledger triggers verified, all currency arithmetic uses BigInt, commission calculation correct, payout pipeline resilient. Tax withholding may be deferred if launch is pre-Jul-2026.

## Cross-References

- ADR-005 D5/D6 -- ledger design and currency arithmetic
- FI-010 -- payout system (settlement pipeline, tax withholding gaps)
- FI-007 -- booking flow (refund paths)
- FI-008 -- payment integration (chargeback, reconciliation gaps)
- Mistake Log Issue 016 -- BigInt currency math incident
- HD-006 -- payment webhook security (payment event idempotency)
