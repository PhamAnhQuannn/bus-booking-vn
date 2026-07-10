# FI-007: Booking Flow (Quy trinh dat ve)

> **Status:** DOCUMENTED
> **Last Updated:** 2026-06-20
> **Related:** ADR-009, ADR-010, ADR-019, DS-001, DS-003, DS-007, FD-014, FD-016, FD-017, FD-018

## Overview

FI-007 covers the full customer journey from selecting a trip through ticket issuance: hold creation, booking review, booking initiation, payment, confirmation, and post-booking lifecycle (status display, cancellation, refund tracking). The core architecture is the hold-then-book two-phase reservation model: (1) customer creates a time-bounded Hold (10-minute TTL) with seats reserved atomically via pg advisory locks + conditional INSERT, (2) customer reviews and initiates Booking consuming the hold, (3) PSP webhook confirms payment and Booking transitions to `paid`. The flow spans four bounded contexts: Booking (holds and bookings), Payment (PSP gateway and webhooks), Fleet/Catalog (Trip/Bus/Operator), and Notification (SMS/email confirmation).

## Scope & Boundaries

### In Scope

- `POST /api/holds` -- hold creation with capacity guard
- `app/booking/review/page.tsx` -- hold review server component
- `POST /api/bookings/initiate` (`POST /api/bookings`) -- booking initiation
- `POST /api/payments/momo/webhook` + `POST /api/payments/vnpay/webhook` -- PSP webhook processing
- `/booking/result/[confirmationToken]` -- payment polling page
- `/booking/confirmation/[confirmationToken]` -- success confirmation page
- `/bookings` -- My Bookings list
- `/bookings/[bookingRef]` -- booking detail page
- `POST /api/bookings/{id}/cancel` -- customer self-cancel
- Refund tracking UI (FD-018)
- Notification triggers (SMS/email on `paid` transition)

### Out of Scope

- Operator trip management -> [FI-005](../FI-005-trip-management/README.md)
- Admin moderation of bookings -> [FI-012](../FI-012-admin-console/README.md)
- Charter requests -> separate bounded context
- Operator-side payout/settlement -> [FI-010](../FI-010-payout-system/README.md) (Finance context)
- Admin refund manual processing -> [FI-012](../FI-012-admin-console/README.md)
- Payment gateway adapter internals -> [FI-008](../FI-008-payment-integration/README.md)

### Bounded Context(s)

- **Booking Context** (Section 3) -- holds and bookings ownership
- **Payment Context** (Section 4) -- PSP gateway and webhook processing
- **Fleet/Catalog Context** (Section 2) -- Trip/Bus/Operator data consumed
- **Notification Context** (Section 7) -- SMS/email triggers on booking events

## Key Entities

| Model | Key Columns | Constraints | Notes |
|-------|-------------|-------------|-------|
| Hold | `id` (CUID PK), `tripId` (FK Trip), `ticketCount` (Int), `customerPhone` (String), `customerName` (String), `customerEmail` (String?), `expiresAt` (DateTime, NOW()+10min), `status` (HoldStatus: active/consumed/expired/cancelled_trip), `pickupKind` (PickupKind: station/point/custom), `pickupAreaId` (FK OperatorPickupArea?), `pickupAreaLabel` (String?), `pickupDetail` (String?), `customPickupRequested` (Boolean), `createdAt` | -- | 10-minute TTL; `customPickupRequested = true` when `pickupKind === 'custom'`; `bb_hold` cookie set on creation |
| Booking | `id` (UUID `@db.Uuid` PK), `bookingRef` (String, `BB-YYYY-[0-9a-z]{4}-[0-9a-z]{4}` base36 lowercase), `confirmationToken` (String, URL-safe random), `tripId` (FK Trip), `holdId` (FK Hold @unique), `customerId` (FK Customer? onDelete: SetNull), `buyerName` (String), `buyerPhone` (String), `buyerEmail` (String?), `ticketCount` (Int), `totalVnd` (Int, `Trip.price * ticketCount`), `paymentMethod` (String: momo/vnpay/bank_transfer/cash), `paymentExternalRef` (String?), `status` (BookingStatus, 8 states), `isManual` (Boolean), `pickupKind`, `pickupAreaId`, `pickupAreaLabel`, `pickupDetail`, `customPickupRequested`, `contactStatus` (ContactStatus), `ticketPdfKey` (String?), `ticketPdfGeneratedAt` (DateTime?), `voucherCode` (String?), `discountVnd` (Int?), `refundedAt` (DateTime?), `einvoiceRef` (String?), `einvoiceIssuedAt` (DateTime?), `createdAt` | `@@unique([holdId])` | Primary key is UUID (not CUID). `totalVnd` computed from DB (I7). `confirmationToken` pages are token-gated, stateless. `customerId` null for guest bookings. |
| ConsentRecord | `id` (CUID PK), `bookingId` (FK Booking), `consentType` (String: no_refund/pii_storage/marketing_sms/marketing_email/marketing_zns), `version` (String), `consentedAt` (DateTime) | Immutability: BEFORE UPDATE trigger | Two rows per booking: `no_refund` + `pii_storage`. Append-only. |
| PaymentEvent | `id` (CUID PK), `adapter` (String: momo/vnpay/stub), `providerTxnId` (String), `bookingRef` (String), `rawPayload` (Json) | `@@unique([adapter, providerTxnId])` | Idempotency key for webhook dedup. |

## API Endpoints

| Method | Path | Auth | Description | Status Codes |
|--------|------|------|-------------|--------------|
| POST | `/api/holds` | Public + CSRF | Create hold with capacity guard. Advisory locks: phone-first then trip. Conditional INSERT. | 201, 409 (insufficient_capacity/sales_closed/trip_cancelled/operator_suspended), 429 (hold_cap_exceeded/rate_limited), 422 (maintenance_conflict) |
| GET | `/api/holds/{id}` | `bb_hold` cookie | Hold detail; verifies cookie | 200, 404 |
| POST | `/api/bookings` | Public + CSRF | Initiate booking from hold. I7: `totalVnd = Trip.price * ticketCount` from DB. | 201, 422 (HOLD_EXPIRED/HOLD_ALREADY_CONSUMED/INVALID_STATE_TRANSITION), 409 (SEAT_UNAVAILABLE/OPERATOR_SUSPENDED/DUPLICATE_BOOKING) |
| POST | `/api/payments/momo/webhook` | HMAC signature | MoMo payment webhook. CSRF-exempt. Idempotent via PaymentEvent unique constraint. | 200 (always to gateway), 400 (invalid signature) |
| POST | `/api/payments/vnpay/webhook` | HMAC signature | VNPay payment webhook. Same pattern as MoMo. | 200, 400 |
| POST | `/api/bookings/{id}/cancel` | Customer JWT | Customer self-cancel. CPL 2023 Art. 29 3-business-day window. | 200 `{ booking, alreadyCancelled, refundAmount }` |

### Hold Creation Lock Sequence

Inside pg transaction:
1. `pg_advisory_xact_lock(hashtext('hold-phone:' || phone))` -- phone-level lock (cap check)
2. `pg_advisory_xact_lock(hashtext('hold:' || tripId))` -- trip-level lock (serializes concurrent holds)

Phone lock acquired BEFORE trip lock (consistent ordering prevents deadlocks).

### Conditional INSERT (Atomic Capacity Check + Hold Creation)

```sql
INSERT INTO "Hold" (tripId, ticketCount, ...)
SELECT ..., NOW() + INTERVAL '10 minutes' AS expiresAt
WHERE
  Trip.status = 'scheduled'
  AND Trip.salesClosed = false
  AND Operator.status = 'APPROVED'
  AND (capacity - blockedSeats - activeHolds - paidBookings - awaitingPaymentInPSPWindow) >= ticketCount
```

Zero TOCTOU gap: capacity check and hold creation are one SQL statement.

### Booking Initiation Transaction Sequence

```
1. SELECT FOR UPDATE on Trip (defense-in-depth)
2. Re-verify operator APPROVED (closes suspend-after-search race)
3. INSERT Booking ON CONFLICT ("holdId") DO NOTHING
4. SET Booking.status = 'awaiting_payment', totalVnd = Trip.price * ticketCount
5. INSERT 2 ConsentRecord rows: no_refund + pii_storage
6. Mark Hold.status = 'consumed'
Then: gateway.createPayment(...) for PSP payment URL
Compensating transaction on gateway failure: DELETE booking, revert hold consumed -> active
```

### Payment Webhook Transaction Sequence (on paid)

```
1. INSERT PaymentEvent (idempotent via unique constraint)
2. UPDATE Booking SET status='paid' WHERE status IN legalPredecessors('paid')
3. SELECT FOR UPDATE on Trip; recount paid seats
   If paid > capacity -> status = 'refunded' (oversold race)
4. If not oversold:
   INSERT LedgerEntry: booking_credit (+gross)
   INSERT LedgerEntry: platform_fee (-fee)
   INSERT NotificationLog: customerBookingPaid
   INSERT NotificationLog: operatorNewBooking
Post-commit via after(): overpay refund, oversold refund
```

Amount guards: underpay -> reject; overpay -> mark paid + capture overpay for refund; non-VND -> reject.

### Cancellation Fee Schedule (CPL 2023 Art. 29)

| Time Since Booking | Fee | Refund |
|-------------------|-----|--------|
| Within 24 hours | 0% | 100% |
| 24-48 hours | 10% | 90% |
| 48-72 hours | 20% | 80% |
| After 72 hours | No self-cancel | -- |

## State Machine

### Booking Status (8 states)

| Status | Vietnamese Label | Terminal? |
|--------|-----------------|----------|
| `awaiting_payment` | Cho thanh toan | No |
| `paid` | Da xac nhan | No |
| `completed` | Hoan thanh | Yes |
| `cancelled` | Da huy | Yes |
| `trip_cancelled` | Chuyen bi huy | Yes |
| `no_show` | Khong co mat | Yes |
| `payment_failed_expired` | Thanh toan that bai | Yes |
| `refunded` | Da hoan tien | Yes |

### LEGAL_BOOKING_TRANSITIONS Map

| From | To (allowed) |
|------|-------------|
| `awaiting_payment` | `paid`, `payment_failed_expired`, `cancelled`, `trip_cancelled` |
| `paid` | `completed`, `cancelled`, `trip_cancelled`, `refunded`, `no_show` |
| `completed` | (terminal) |
| `cancelled` | (terminal) |
| `trip_cancelled` | (terminal) |
| `no_show` | (terminal) |
| `payment_failed_expired` | (terminal) |
| `refunded` | (terminal) |

### Key Transitions

| From | To | Trigger | Guard |
|------|----|---------|-------|
| `awaiting_payment` | `paid` | PSP webhook success | `amount >= booking.totalVnd`, `currency = 'VND'`, `legalPredecessors('paid')` |
| `awaiting_payment` | `payment_failed_expired` | PSP failure webhook or hold-expiry sweeper | MoMo FAILURE_RESULT_CODES: `{1001, 1002, 1003, 1004, 1005, 4100}` |
| `paid` | `completed` | Operator check-in | Sets `checkedInAt` |
| `paid` | `trip_cancelled` | Operator trip cancel cascade | Bulk UPDATE; post-commit `refundOut` |
| `paid` | `no_show` | Operator marks no-show | Sets `noShowAt` |
| `paid` | `refunded` | Oversold race in webhook | Same transaction as paid transition; `paid > capacity` |

**KNOWN GAP:** `paid -> cancelled` customer-initiated transition (CPL 2023 Art. 29). Legal opinion pending on "service already performed" exemption.

### Hold Lifecycle (4 states)

| From | To | Trigger | Guard |
|------|----|---------|-------|
| (create) | `active` | `createHold` | Advisory locks; conditional INSERT |
| `active` | `consumed` | `createOnlineBookingFromHold` | Atomic with booking INSERT |
| `active` | `expired` | `expireHolds` cron | `expiresAt <= NOW()`; `FOR UPDATE SKIP LOCKED`; batch 500 |
| `active` | `cancelled_trip` | `cancelTrip` cascade | Bulk UPDATE |

Compensating transaction: gateway failure after hold consumed -> DELETE booking, revert `consumed -> active`.

### Refund Status (5 states)

| From | To | Trigger | Guard |
|------|----|---------|-------|
| `refund_requested` | `processing` | Admin/system starts processing | -- |
| `processing` | `completed` | PSP refund success | -- |
| `processing` | `failed` | PSP refund failure | Retry allowed |
| `failed` | `processing` | Retry attempt | -- |
| `failed` | `permanently_failed` | Max retries exhausted | Terminal |

## Business Rules & Invariants

1. **I1 -- SELECT FOR UPDATE** -- Every state transition runs inside `prisma.$transaction(async (tx) => { ... })` (callback form) with `SELECT ... FOR UPDATE` on the entity row. Array form prohibited. (ADR-019 D3)

2. **I7 -- No client-originated price** -- `totalVnd = Trip.price * ticketCount` computed inside conditional INSERT from Trip row. No price accepted in request body for `/api/holds/**`, `/api/bookings/**`, `/api/payments/**`. Operator endpoints (`/api/op/**`) are I7-exempt with inline `// I7-exempt:` comment.

3. **I8 -- Ledger immutability** -- `LedgerEntry` is append-only. `BEFORE UPDATE/DELETE` trigger `ledger_entry_immutable` blocks modifications. Same trigger protects `AdminAuditLog` and `ConsentRecord`.

4. **I9 -- No raw phone in NotificationLog payload** -- `NotificationLog.recipient` carries the phone. The `payload` JSON must NOT duplicate the phone number.

5. **I10 -- All currency math in BigInt** -- Platform fee = `ratePpm` (parts-per-million) / 1,000,000. All multiplication of integer VND amount by fractional rate uses BigInt domain. ES2017 target: `BigInt(n)` constructor calls only, no `1n` suffix. (Mistake Log Issue 016)

6. **Three-Layer Capacity Guard (ADR-009 D7)** -- L1 at Hold creation: advisory locks + conditional INSERT + PSP_WINDOW_MINUTES=20. L2 at payment webhook: SELECT FOR UPDATE on Trip + recount; overflow -> `refunded`. L3: per-phone hold cap via phone-level advisory lock.

7. **Phone-to-trip lock ordering** -- Phone lock acquired BEFORE trip lock (`hold-phone:` then `hold:`). Consistent ordering across all concurrent callers prevents deadlock.

8. **Operator bookable gate (suspend-after-search race)** -- Checked at: (1) search time, (2) hold conditional INSERT, (3) booking initiation. Ensures operator suspension between search and hold/booking is caught.

9. **Idempotency guards** -- Payment webhook: `@@unique([adapter, providerTxnId])` P2002 -> 200 no-op. Booking creation: `INSERT ON CONFLICT ("holdId") DO NOTHING`. LedgerEntry: `sourceEventId` unique. Trip cancel and customer cancel: discriminated result at HTTP 200.

10. **Confirmation token vs booking ref** -- `confirmationToken` = URL-safe random, no auth required, no expiry (shareable). `bookingRef` = `BB-YYYY-[0-9a-z]{4}-[0-9a-z]{4}` (base36 lowercase), customer auth required.

11. **Guest booking** -- `Booking.customerId` null for guests. `attachGuestBookingByPhone` backfills on registration (phone match). Guest views ticket via `confirmationToken` URL from SMS. Guest cannot cancel via `bookingRef` page (requires auth).

## Frontend Surfaces

| Page | Path | Key Components | Notes |
|------|------|----------------|-------|
| Hold Timer | (persistent overlay) | MM:SS countdown; Zustand `useHoldTimerStore`; green >5min, amber 2-5min (pulsing), red <2min | `HoldExpiryModal` non-dismissible (no close, no click-outside, no Escape) |
| Booking Review | `/booking/review` | Trip summary, pricing breakdown (`{ticketCount} x {price} d = {totalVnd} d`), cancellation policy table, consent checkboxes, "Xac nhan va thanh toan" CTA | RSC server component; calls `getHoldDetails` in-process (NO self-fetch) |
| Payment Polling | `/booking/result/[confirmationToken]` | Spinner + "Dang kiem tra thanh toan..."; exponential backoff (2s, 4s, 8s, 16s); timeout at 60s | Redirects to confirmation on `paid`; shows failure on `payment_failed_expired` |
| Success Confirmation | `/booking/confirmation/[confirmationToken]` | Booking ref (large), QR code (200x200px, Level M), trip details, operator legal info, "Tai ve PDF" CTA, "Chia se qua Zalo" CTA | Token-gated, no auth required; cash variant: amber badge "Cho thanh toan" |
| My Bookings | `/bookings` | Three tabs: Sap toi (upcoming), Da di (past), Da huy (cancelled) | Customer auth required; booking list cards with status badges |
| Booking Detail | `/bookings/[bookingRef]` | Full booking info, status badge, action buttons per status | Customer auth required |
| Cancellation Modal | (overlay from booking detail) | Fee preview: ticket price, cancellation fee, refund amount, refund method, timeline | Destructive CTA "Xac nhan huy ve" (red); Art. 29 variant: fee "0 d (mien phi)" |
| Refund Tracking | (within booking detail) | Vertical timeline stepper: Yeu cau hoan tien -> Dang xu ly -> Hoan tien thanh cong/that bai | Permanently failed: display support contact |

<!-- Phase 2: Pickup selection deferred to post-launch (trigger: 4 operators). Phase 1 = station-only. -->
### Pickup Selection

| Kind | Vietnamese | UI |
|------|-----------|-----|
| `station` | Ben xe | Station name displayed |
| `point` | Diem don | `OperatorPickupArea` selector |
| `custom` | Dia chi khac | Free-text input; min 5 chars; operator calls back to confirm |

### Booking Status Badges

| Status | Vietnamese | Color | Actions |
|--------|-----------|-------|---------|
| `awaiting_payment` | Cho thanh toan | Amber | "Thanh toan", "Huy" |
| `paid` | Da xac nhan | Green | "Xem ve", "Huy ve" |
| `completed` | Hoan thanh | Blue | "Xem ve", "Dat lai" |
| `cancelled` | Da huy | Grey | "Dat lai" |
| `trip_cancelled` | Chuyen bi huy | Red | "Tim chuyen khac", "Dat lai" |
| `no_show` | Khong co mat | Grey/dark | "Dat lai" |
| `payment_failed_expired` | Thanh toan that bai | Red | "Dat lai" |
| `refunded` | Da hoan tien | Purple | "Dat lai" |

### Re-Book Shortcut

"Dat lai" button on completed/cancelled/trip_cancelled/no_show/payment_failed_expired/refunded bookings navigates to `/tuyen/{origin-slug}/{destination-slug}/{next-date}` with `ticketCount` pre-filled.

## Regulatory Requirements

| Law/Decree | Requirement | Impact |
|------------|-------------|--------|
| CPL 2023 Art. 29 | 3-day cancellation right for remote contracts | `POST /api/bookings/{id}/cancel`; fee schedule displayed; "Huy mien phi trong X gio Y phut" banner |
| E-Transactions Law 2023 | Review and confirm step before payment | `app/booking/review/page.tsx` is mandatory pre-payment review step |
| CPL 2023 Art. 37-39 | Operator legal name and tax code (MST) on confirmation | Confirmation page legal content section |
| CPL 2023 Art. 29 | Cancellation terms link on confirmation | "Dieu khoan huy ve" link |
| CPL 2023 | Platform complaint contact on confirmation | `support@busbooking.vn` + Zalo OA |
| E-Transactions Law 2023 | Departure details in electronic confirmation | Route, date, time, pickup on confirmation page |
| E-Transactions Law 2023 | Total price paid in VND | `Booking.totalVnd` displayed |
| Circular 32/2025/TT-BTC | E-invoice per transaction | `EInvoice` model; MISA integration; "Tai hoa don" CTA |
| CPL 2023 | Refund handling SLA: acknowledge 3 days, resolve 7-30 days | Complaint handling flow |
| E-Commerce Law 2025 (Jul 2026) | 24-hour complaint response | Added requirement |
| CPL 2023 + PDPL 2025 | Consent at booking initiation | 2 ConsentRecord rows (`no_refund` + `pii_storage`) |
| PDPL 2025 (I9) | Phone masking in UI | `****1234` format; only last 4 digits |

### Tax Withholding (NOT_IMPLEMENTED)

`tax_withheld` LedgerEntry type exists in schema; `taxVat` + `taxPit` fields on Payout model. E-Commerce Law 2025 (July 2026 deadline) requires platform to withhold VAT ~3% + PIT ~1.5% from individual/household operators. Schema ready; service logic absent.

## Testing Strategy

### Unit Tests

- `totalVnd = Trip.price * ticketCount` (not from body) in `initiateOnlineBooking.ts`
- `bookingRef` output matches `BOOKING_REF_REGEX` (`/BB-\d{4}-[0-9a-z]{4}-[0-9a-z]{4}/`) -- lowercase base36 (Mistake Log Issue 003)
- `LEGAL_BOOKING_TRANSITIONS` map: `isLegalTransition` and `legalPredecessors` correctness
- `FAILURE_RESULT_CODES = {1001, 1002, 1003, 1004, 1005, 4100}` exact set (Mistake Log Issue 004)
- `calcPlatformFeeMinor`: BigInt arithmetic; `BigInt()` constructor calls; edge cases where Number/BigInt diverge
- `Buffer.from(hex, 'hex')` in crypto: 64-char hex strings for SHA-256 (Mistake Log Issue 010)

### Integration Tests

- `createHold` conditional INSERT: zero rows when capacity exhausted; one row when available
- `createHold` advisory lock ordering: phone lock before trip lock; no deadlock
- `createHold` PSP window: `awaiting_payment` within 20 min counted; older NOT counted
- `createHold` phone cap: second hold from same phone blocked at cap
- `initiateOnlineBooking`: `ON CONFLICT ("holdId") DO NOTHING` idempotency
- `initiateOnlineBooking`: compensating transaction on gateway failure reverts hold to `active`
- `processWebhook`: P2002 duplicate `providerTxnId` -> 200 no-op
- `processWebhook`: oversold race `paid > capacity` -> `status = 'refunded'`
- `processWebhook`: `legalPredecessors` prevents regression from `paid` -> `awaiting_payment`
- `processWebhook`: LedgerEntry immutability trigger blocks UPDATE
- `cancelTrip` cascade: bulk update Bookings -> `trip_cancelled`; Holds -> `cancelled_trip`
- `cancelTrip` idempotency: second cancel returns `{ alreadyCancelled: true }` HTTP 200
- ConsentRecord immutability: UPDATE blocked by trigger
- Concurrent hold creation: `Promise.all` 2 holds; exactly 1 succeeds when capacity = 1

### E2E Tests

- Full happy path: search -> hold -> book -> stub payment -> confirmation page
- CSRF threading via `primeCsrf()` before POST `/api/holds` and POST `/api/bookings`
- Hold expiry modal: countdown -> non-dismissible modal (no click-outside, no Escape)
- My Bookings tab routing; status badge colors
- Form bypass: navigate to `/booking/review` via URL, not synthetic keystrokes (Mistake Log Issue 002)

## Cross-References

- **Architecture Decisions:** [ADR-009](../../architecture-decisions/ADR-009-concurrency-seat-holding/README.md) (three-layer guard, advisory locks, conditional INSERT, PSP window), [ADR-010](../../architecture-decisions/ADR-010-booking-lifecycle/README.md) (16 booking decisions, hold-then-book, guest booking), [ADR-019](../../architecture-decisions/ADR-019-state-machines/README.md) (LEGAL_BOOKING_TRANSITIONS, state machine enforcement)
- **Design Specifications:** [DS-001](../../design-specifications/DS-001-data-model/README.md) (Hold, Booking, ConsentRecord, PaymentEvent), [DS-003](../../design-specifications/DS-003-api-contract/README.md) (holds, bookings, webhooks), [DS-007](../../design-specifications/DS-007-refund-flow/README.md) (5 refund triggers, refund state machine, Art. 29 fee schedule)
- **Frontend Design:** [FD-014](../../frontend-design/FD-014-hold-timer/README.md) (HoldTimer, HoldExpiryModal, pickup selection), [FD-016](../../frontend-design/FD-016-booking-confirmation/README.md) (polling, confirmation, QR, notifications), [FD-017](../../frontend-design/FD-017-booking-lifecycle/README.md) (status badges, My Bookings tabs, re-book), [FD-018](../../frontend-design/FD-018-cancellation-refund/README.md) (cancellation UX, fee preview, refund timeline)
- **Business/Domain:** [bounded-contexts.md](../../business/domain-model/bounded-contexts.md) (Booking Context), [state-machines.md](../../business/domain-model/state-machines.md) (Booking, Hold transitions), [event-flows.md](../../business/domain-model/event-flows.md) (Flows 1-4), [invariants-catalog.md](../../business/domain-model/invariants-catalog.md) (I1, I7, I8, I9, I10)
- **Regulatory:** [consumer-protection.md](../../business/regulatory/consumer-protection.md) (CPL 2023 Art. 29, complaint SLA)
- **Personas:** [customer-personas.md](../../business/personas/customer-personas.md) (hold duration comparison, refund trust, Zalo preference)
- **Scaffolding:** [SI-005](../../scaffolding-infra/SI-005-testing-strategy/README.md) (real DB mandate, mock hygiene, concurrency tests, BigInt rules)

## Known Gaps & Open Questions

- **CRITICAL -- `paid -> cancelled` customer self-cancel gap** -- Booking state machine has no customer-initiated `paid -> cancelled` transition. CPL 2023 Art. 29 legal opinion pending. FD-018 assumes implemented. Pre-go-live compliance blocker.
- **MEDIUM -- HOLD_SWEEPER_MODE dry-run override** -- `HOLD_SWEEPER_MODE` defaults to `'update'` (active sweep). Verify production env does not override to `'count'` (dry-run).
- **HIGH -- Tax withholding NOT_IMPLEMENTED** -- VAT ~3% + PIT ~1.5% for individual/household operators. E-Commerce Law 2025 July 2026 deadline. Schema ready; service logic absent.
- **HIGH -- Marketplace payment model NOT_IMPLEMENTED** -- Currently central collection; target is VNPay/MoMo direct to operator merchants (ADR-010 D4).
- **MEDIUM -- Sandbox-gated MoMo/VNPay E2E specs excluded from CI** -- No documented manual execution schedule.
- **MEDIUM -- Concurrent-write integration test requirement is code-review only** -- No CI enforcement.
- **MEDIUM -- Payout.amount is 32-bit Int** -- Max ~2.1B VND; overflow risk for full-bus high-price trips.
- **MEDIUM -- Customer phone masking sufficiency** -- `****1234` last 4 digits visible; assess PII compliance.
- **LOW -- LEGAL_*_TRANSITIONS maps only exist for 3 of 8 state machines** -- Booking, CharterRequest, Operator have maps; Trip/Hold/Payout/OTP/EInvoice use inline WHERE guards (ADR-019 PARTIALLY_IMPLEMENTED).
- **LOW -- No waitlist for sold-out trips** -- Persona research identifies high value; no UI spec.
- **LOW -- Holiday calendar for Art. 29 "3 business days"** -- Vietnamese public holidays needed for accurate countdown (DS-035 section 2.3).
