# HD-006: Payment & Webhook Security Audit

> Status: NOT_STARTED | References: ADR-005, DS-005 Section 3.1, DS-013, FI-008, FI-010

## Purpose

Verify end-to-end payment security for Phase 1 (bank transfer via VietQR + SePay + cash). Covers webhook defense stack, SePay credential isolation, memo mismatch reconciliation, manual refund handling, and regulatory compliance of the central collection model.

**Phase 1 scope:** Bank transfer (SePay webhook) + cash at boarding only. MoMo/VNPay/ZaloPay are Phase 2/3 -- re-audit this document when those adapters ship.

## Skill Invocation

- **Primary**: `/security-review` -- payment flow threat analysis
- **Supplementary**: `/threat-model` -- bank transfer attack surface mapping

## Acceptance Criteria

### Webhook Defense Stack (DS-005 Section 3.1, DS-013)

SePay webhook (`POST /api/payments/bank_transfer/webhook`) uses bearer token auth (not HMAC). Three of four defense layers still apply:

- [ ] Layer 1 -- Bearer token verification:
  - [ ] `SEPAY_API_KEY` verified against `Authorization` header before any processing
  - [ ] Invalid/missing token returns 401
  - [ ] Token compared using constant-time comparison (prevent timing attacks)
- [ ] Layer 2 -- Idempotency:
  - [ ] `PaymentEvent @@unique([adapter, providerTxnId])` constraint active
  - [ ] P2002 unique-violation returns HTTP 200 (duplicate webhook = already processed)
- [ ] Layer 3 -- Amount guard:
  - [ ] Webhook amount compared against `booking.totalVnd` (server-derived, not client-originated)
  - [ ] Underpay rejected (amount < booking total)
  - [ ] Overpay logged + alert triggered
  - [ ] Oversold refund path tested
- [ ] Layer 4 -- Oversold race guard:
  - [ ] `SELECT FOR UPDATE` on Trip row inside `$transaction`
  - [ ] Paid seat recount after lock acquired
  - [ ] Concurrent webhook test: two simultaneous payments for last seat -- only one succeeds

### BookingRef Extraction (DS-013)

- [ ] BookingRef extracted from SePay `content` field via case-insensitive regex: `/BB-\d{4}-[0-9a-z]{4}-[0-9a-z]{4}/i`
- [ ] Handles banking app uppercasing (e.g., `BB-2026-A1B2-C3D4` -> lowercased match)
- [ ] Handles customer text around ref (e.g., `thanh toan BB-2026-a1b2-c3d4 ve xe`)
- [ ] No-match path: transfer is real but unlinked -> logged as unmatched for admin reconciliation
- [ ] No-match does NOT return error to SePay (money already arrived; webhook just notifies)

### Memo Mismatch & Admin Reconciliation (~5% of transfers)

- [ ] Unmatched transfers (no bookingRef extracted) queued for admin manual reconciliation
- [ ] Admin dashboard shows: transfer amount, timestamp, sender bank, raw memo text
- [ ] Admin can manually link an unmatched transfer to a pending booking
- [ ] Alert triggers when unmatched transfer count exceeds threshold (e.g., >10 in 1 hour)

### Webhook Processing Sequence

- [ ] Steps execute in order: bearer token verify -> bookingRef extract -> booking lookup -> PaymentEvent INSERT -> status transition -> FunnelEvent -> post-commit `after()`
- [ ] Booking state transition: `awaiting_payment -> paid`
- [ ] Ledger writes: `booking_credit` + `platform_fee`
- [ ] NotificationLog: `customerBookingPaid` + `operatorNewBooking`

### SePay Credential Security

- [ ] `SEPAY_API_KEY` stored as env var with Zod min-length validation at boot
- [ ] Sandbox sentinel: `env.ts` rejects production deployment with test/placeholder SePay key
- [ ] `PAYMENTS_STUB=false` verified in production env
- [ ] No SePay credentials in Docker image layers or `.tfstate`

### VietQR Configuration Security

- [ ] `VIETQR_ACCOUNT_NUMBER` (Agribank account) stored as env var
- [ ] `VIETQR_BANK_BIN` (`970405` for Agribank) configured correctly
- [ ] QR code generated via `img.vietqr.io` -- amount and memo pre-filled server-side (I7: no client-originated price)
- [ ] BookingRef is 18 characters (fits within Agribank 25-char memo limit)

### Refund & Dispute Handling (Bank Transfer)

- [ ] No programmatic refund API exists for bank transfer -- documented as manual process
- [ ] Refund procedure: admin initiates manual bank transfer to customer's account
- [ ] Refund ledger entries (`refund_debit` + `refund_out`) created when admin confirms manual transfer
- [ ] Customer dispute flow: customer contacts support -> admin investigates -> manual reverse transfer
- [ ] No PSP chargeback risk (bank transfers are push-only; no pull-back mechanism)
- [ ] **Phase 2 note:** re-add chargeback/holdback reserve section when MoMo/VNPay ship (card-style chargebacks apply to PSP payments)

### Payment Anomaly Detection

- [ ] Failed webhook count spike triggers alert (SePay downtime or misconfiguration)
- [ ] Amount mismatch pattern triggers alert (potential fraud or pricing bug)
- [ ] Duplicate transfer detection (same amount + same sender within short window)
- [ ] Stuck `awaiting_payment` bookings past hold TTL: sweep detects and expires

### Regulatory: Central Collection Model (ADR-005 D1, Decree 52/2024)

- [ ] Central collection concern applies regardless of payment channel (bank transfer or PSP)
- [ ] Platform collects from customers into platform's Agribank account -> disburses to operators via software ledger
- [ ] This model may constitute unlicensed `thu ho/chi ho` under Decree 52/2024
- [ ] Resolution: IPS license obtained OR legal opinion confirming exemption OR split-settlement architecture (DS-009)
- [ ] Decision documented with legal basis before go-live

## Phase 2 Re-Audit Trigger

When MoMo/VNPay adapters ship, re-audit this document and add:
- HMAC signature verification (MoMo SHA-256, VNPay SHA-512)
- `FAILURE_RESULT_CODES` pinned to AC-verbatim set (Mistake Log Issue 004)
- Always-200 webhook response rule (non-200 causes PSP retry storms)
- PSP-specific credential management (MoMo `partnerCode`, VNPay `tmnCode`)
- Chargeback workflow and holdback reserve policy

## Verdict

**PASS** when: SePay bearer token verified, all 4 defense layers active, bookingRef extraction tested, memo mismatch reconciliation working, manual refund process documented, and central collection model has legal clearance.

## Cross-References

- ADR-005 -- payment architecture (bank transfer promoted to Phase 1)
- DS-005 Section 3.1 -- webhook processing sequence
- DS-013 -- VietQR bank transfer design (SePay integration, bookingRef extraction)
- FI-008 -- payment integration feature (known gaps)
- FI-010 -- payout system (ledger integrity)
- HD-001 -- security review (webhook section delegates here)
- HD-009 -- financial integrity (ledger entry types)
