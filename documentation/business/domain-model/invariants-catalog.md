# Business Invariants Catalog

> Extracted from CLAUDE.md Mistake Log, code comments, and service implementations. Research date: 2026-06-17.

---

## I1: Concurrency Control (SELECT FOR UPDATE)

**Description**: Every read-then-write on shared state runs inside `$transaction` (callback form, not array form -- the array form provides no `tx` handle for raw SQL) with `SELECT ... FOR UPDATE` on the gating row. This serializes concurrent writers and prevents TOCTOU races.

**Enforcement locations**:

| Gating Row | Service Files |
|-----------|---------------|
| Bus | `lib/trips/createTrip.ts`, `lib/trips/reassignBus.ts` |
| Trip | `lib/trips/cancelTrip.ts`, `lib/trips/markDeparted.ts`, `lib/trips/completeTripCore.ts`, `lib/trips/salesToggle.ts`, `lib/payment/applyPaidTransition.ts` |
| Operator | `lib/ledger/withdrawal.ts`, `lib/admin/disableOperator.ts`, `lib/onboarding/operatorStatus.ts` |
| OperatorUser | `lib/admin/resetOperatorAdminPassword.ts` |
| CharterRequest | `lib/charter/charterStatus.ts` |
| Staff (OperatorUser) | `lib/trips/` (assign service) |

**Failure mode**: Without FOR UPDATE, concurrent requests can read stale state and both succeed, leading to oversold trips, double payouts, or invalid state transitions.

---

## I7: No Client-Originated Price

**Description**: Customer-facing endpoints (`/api/holds/**`, `/api/bookings/**`, `/api/payments/**`) never accept price from the request body. Price is derived from `Trip.price * Hold.ticketCount` at booking creation time via raw SQL INSERT (the price is read from the Trip row inside the conditional INSERT, not passed from the client).

**Enforcement location**: `lib/booking/initiateOnlineBooking.ts` -- the `totalVnd` is computed from the Trip row, not from request input.

**Exception**: Operator-side endpoints (`/api/op/trips`, `lib/ledger/calcPayout.ts`) are I7-exempt because the operator IS the price authority for their trips. Each exempt site carries an inline `// I7-exempt:` comment.

**Failure mode**: If a customer could supply their own price, they could underpay for a ticket. The amount guard in the payment webhook (`amount >= booking.totalVnd`) is a defense-in-depth check, not the primary enforcement.

---

## I9: No Raw Phone in NotificationLog Payload

**Description**: `NotificationLog.recipient` carries the phone number for delivery. The `payload` JSON field must NOT duplicate the phone number. This prevents double-exposure of PII if the payload is logged or exported.

**Enforcement location**: Annotated in `lib/trips/cancelTrip.ts` and `lib/trips/reassignBus.ts` where notification rows are created.

**Failure mode**: Raw phone in payload would leak PII through structured log exports or admin UI payload inspection, violating the principle that `recipient` is the sole phone column.

---

## Capacity Guard (Oversell Prevention)

**Description**: Multi-layer defense preventing more tickets from being sold than a bus has seats.

**Layer 1 -- Hold creation** (`lib/core/db/holdRepo.ts`):
- Conditional INSERT checking `capacity - active_holds(expiresAt > NOW()) - paid_bookings - awaiting_payment_bookings(createdAt > NOW() - PSP_WINDOW_MINUTES) >= ticketCount`
- Serialized by trip-level pg advisory lock (`pg_advisory_xact_lock(hashtext('hold:' || tripId))`)
- `PSP_WINDOW_MINUTES = 20` ensures awaiting_payment bookings still occupy capacity during the payment window

**Layer 2 -- Booking-paid webhook** (`lib/payment/applyPaidTransition.ts`):
- `SELECT FOR UPDATE` on Trip after marking booking as paid
- Recount paid seats; if `paid > capacity` -> immediate `status = 'refunded'` + post-commit `refundOut`

**Layer 3 -- Hold cap** (`CONCURRENT_HOLD_CAP`):
- Per-phone limit on simultaneous active holds across all trips
- Enforced by phone-level pg advisory lock acquired BEFORE the trip-level lock (consistent lock ordering prevents deadlocks)

**Failure mode**: Without advisory locks, concurrent hold requests on a nearly-full trip could both see sufficient capacity and both succeed, overselling the bus.

---

## Maintenance Window Overlap

**Description**: Buses with active or future maintenance windows cannot be assigned to trips that overlap the window.

**Enforcement locations**:
- `lib/trips/createTrip.ts` and `lib/trips/reassignBus.ts`: check `maintenanceStart <= departureAt < maintenanceEnd` (point-in-window)
- `lib/trips/searchTrips.ts`: window-vs-window overlap using `maintenanceStart IS NULL OR maintenanceEnd < startUtc OR maintenanceStart > endUtc` (excludes the complement of overlap -- see Mistake Log Issue 001)

**Failure mode**: Without the overlap check, a bus could be scheduled for a trip during its maintenance period, leading to operational failures on departure day.

---

## salesClosed Gate

**Description**: A Trip with `salesClosed = true` is excluded from search results and cannot accept new holds.

**Enforcement locations**:
- `lib/trips/searchTrips.ts`: WHERE `salesClosed = false`
- `lib/core/db/holdRepo.ts`: conditional INSERT requires `salesClosed = false`
- `lib/trips/markDeparted.ts`: automatically sets `salesClosed = true` when trip departs
- `lib/trips/salesToggle.ts`: operator can manually toggle

**Failure mode**: Without this gate, customers could create holds on trips that have already departed or that the operator has manually closed.

---

## Bus Overlap Guard

**Description**: The same bus cannot be assigned to two trips with overlapping time windows. The window for each trip is `[departureAt, departureAt + route.durationMinutes + 60min buffer]`.

**Enforcement location**: `lib/trips/busOverlap.ts` (`busHasOverlappingTrip`), called from `createTrip`, `reassignBus`, and `pairedReturn`. Runs inside the Bus row's `FOR UPDATE` transaction.

**Failure mode**: Without the overlap check, a bus could be double-booked for overlapping departure times, making it physically impossible to serve both trips.

**Note (SPEC CONFLICT)**: The `bus_overlap_with_outbound` error returns HTTP 422 in `pairedReturn` (per AC6) but HTTP 409 in `reassignBus` (per I3). Both sites carry `// SPEC CONFLICT:` comments. Divergence deferred to a follow-up issue.

---

## Ledger Immutability

**Description**: `LedgerEntry` rows are append-only. No UPDATE or DELETE is permitted, enforced by a PostgreSQL `BEFORE UPDATE/DELETE` trigger (`ledger_entry_immutable`). The same trigger pattern protects `AdminAuditLog` and `ConsentRecord`.

**Enforcement location**: Database trigger (defined in migration SQL). Application code uses INSERT only -- no update/delete methods exist on these models.

**Failure mode**: If ledger rows could be modified, the audit trail would be unreliable, balance calculations could be retroactively altered, and financial reconciliation would be impossible.

---

## Payout Account Verification Gate

**Description**: Withdrawals and payouts only proceed when `PayoutAccount.verifiedAt IS NOT NULL`. Any edit to account fields (bank name, account number, holder name) resets `verifiedAt` to `null`, requiring re-verification before funds can be disbursed.

**Enforcement locations**:
- `lib/ledger/withdrawal.ts`: checks `isPayoutAccountVerified(tx, operatorId)` inside the FOR UPDATE transaction
- `lib/onboarding/payoutAccount.ts`: resets `verifiedAt = null` on any field edit

**Failure mode**: Without this gate, an attacker who compromises an operator account could change payout details and immediately withdraw funds to a fraudulent account.

---

## Money Arithmetic in BigInt

**Description**: All currency math that multiplies an integer minor-unit value (VND) by a fractional rate (e.g., platform fee percentage) uses BigInt arithmetic. This prevents IEEE 754 floating-point representation drift that can flip half-even rounding on the wrong side of a tie.

**Enforcement location**: `lib/ledger/feeConfig.ts` (`calcPlatformFeeMinor`), `lib/ledger/calcPayout.ts`. Platform fee rate encoded as `BigInt(Math.round(pct * 1e10)) / BigInt(1e10)` with all intermediate arithmetic in the BigInt domain.

**Constraint**: ES2017 target requires `BigInt(n)` constructor calls -- the `n` literal suffix is a parser error under `--target es2017`.

**Failure mode**: Native `Number` multiplication of `gross * 0.06` produces representation drift for many `gross` values, causing the half-even rounding branch to fire incorrectly. Cumulative rounding errors in a high-volume VND marketplace can sum to material financial discrepancies.

---

## Settlement Delay (T+1)

**Description**: Operator revenue is not available for withdrawal until `completedAt + 1 day <= NOW()`. This provides a buffer for dispute resolution, chargebacks, and oversold-race refunds before funds become withdrawable.

**Enforcement locations**:
- `lib/ledger/constants.ts`: `SETTLEMENT_DELAY_DAYS = 1`, `SETTLEMENT_DELAY_SQL_INTERVAL = '1 day'`
- `lib/ledger/balance.ts`: `settled_eligible` computation uses `completedAt + '1 day' <= NOW()` as the eligibility predicate
- `lib/trips/completeTripCore.ts`: Payout row created with `scheduledAt = completedAt + 1 day`

**Failure mode**: Without settlement delay, an operator could complete a trip and immediately withdraw funds before chargebacks or disputes are processed.

---

## Operator Bookable Gate

**Description**: Every hold creation and booking initiation re-verifies that `operator.status IN ['APPROVED']`, not just at search time. This closes the suspend-after-search race: an admin could suspend an operator after a customer's search but before the customer creates a hold.

**Enforcement locations**:
- `lib/core/db/holdRepo.ts`: conditional INSERT joins Trip -> Operator and checks status
- `lib/booking/initiateOnlineBooking.ts`: re-verifies operator APPROVED before creating booking

**Failure mode**: Without re-verification, a customer could book a ticket on a suspended operator's trip that appeared in search results before the suspension.

---

## Hold Expiry and Cleanup

**Description**: Active holds expire after `HOLD_TTL_MINUTES = 10`. A cron job (`expireHolds`) transitions expired holds from `active` to `expired` using `UPDATE ... FOR UPDATE SKIP LOCKED` in batches of 500 to avoid long-running transactions.

**Enforcement location**: `lib/core/db/holdRepo.ts`

**Failure mode**: Without expiry, abandoned holds would permanently reduce available capacity, preventing other customers from booking.

---

## Idempotency Guards

**Description**: Critical state-changing operations are idempotent to handle retries safely.

| Operation | Idempotency Mechanism |
|-----------|----------------------|
| Payment webhook | `@@unique([adapter, providerTxnId])` on PaymentEvent; P2002 -> 200 no-op |
| Booking creation | `INSERT ... ON CONFLICT ("holdId") DO NOTHING` |
| LedgerEntry writes | `sourceEventId` unique constraint |
| Withdrawal | Double-probe: `withdraw-key:<idempotencyKey>` marker checked outside and inside transaction |
| Trip completion | `completedAt IS NOT NULL` -> return existing result |
| Trip cancellation | `status === 'cancelled'` -> return `{ alreadyCancelled: true }` |
| Payout creation | `findFirst` before insert (per-trip dedup) |
| Refund | `refund_out:<key>` replay guard |

**Failure mode**: Without idempotency, network retries or webhook replays could create duplicate bookings, double-charge customers, or issue duplicate payouts.
