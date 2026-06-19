# State Machines

> Status enums, valid transitions, triggers, and guards extracted from code. Research date: 2026-06-17.

---

## 1. Trip Status

**States**: `scheduled` | `departed` | `completed` | `cancelled`

**Additional flag**: `salesClosed` (boolean, orthogonal to status -- can be toggled independently)

### Transition Table

| From | To | Trigger | Guard / Precondition |
|------|----|---------|---------------------|
| `scheduled` | `departed` | `markDeparted` (operator action) | Not cancelled. `SELECT FOR UPDATE` on Trip. |
| `departed` | `completed` | `completeTripCore` (operator action or `autoCompleteTrips` cron) | `departedAt IS NOT NULL`. Not cancelled. `SELECT FOR UPDATE` on Trip. |
| `scheduled` | `cancelled` | `cancelTrip` (operator action) | `SELECT FOR UPDATE` on Trip. |
| `departed` | `cancelled` | `cancelTrip` (operator action) | `SELECT FOR UPDATE` on Trip. |
| `completed` | `cancelled` | `cancelTrip` (operator action) | `SELECT FOR UPDATE` on Trip. |

### Side Effects

| Transition | Side Effects |
|-----------|-------------|
| -> `departed` | Sets `departedAt = NOW()`, `salesClosed = true`. |
| -> `completed` | Sets `completedAt = NOW()`. Creates Payout row (`status = 'requested'`, `scheduledAt = completedAt + 1d`). Enqueues `payout_scheduled` NotificationLog per paid booking with `scheduledFor` as top-level column. |
| -> `cancelled` | Sets `cancelledAt = NOW()`, `cancelReason`. Cascades: bulk-update Bookings to `trip_cancelled`, Holds to `cancelled_trip`. Enqueues `trip_cancelled` SMS per affected booking. Post-commit: `refundOut` per paid booking. |

### Idempotency

- `markDeparted`: if `departedAt IS NOT NULL`, returns `{ alreadyDeparted: true }` without modification.
- `completeTripCore`: if `completedAt IS NOT NULL`, returns `{ alreadyCompleted: true }` without modification.
- `cancelTrip`: if `status === 'cancelled'`, returns `{ alreadyCancelled: true, cancelledBookings: 0 }` (HTTP 200, discriminated result -- no throw).

### salesClosed Toggle

`salesClosed` can be toggled independently by the operator via `lib/trips/salesToggle.ts` (under `SELECT FOR UPDATE`). `markDeparted` forces `salesClosed = true` as a side effect. A `scheduled` trip can have `salesClosed = true` (operator manually closes early).

---

## 2. Booking Status

**States**: `awaiting_payment` | `paid` | `completed` | `cancelled` | `trip_cancelled` | `no_show` | `payment_failed_expired` | `refunded`

**Terminal states**: `completed`, `cancelled`, `trip_cancelled`, `no_show`, `payment_failed_expired`, `refunded`

### Transition Table

Single-source transition map defined in `lib/booking/transitions.ts` as `LEGAL_BOOKING_TRANSITIONS`:

| From | To | Trigger | Guard / Precondition |
|------|----|---------|---------------------|
| `awaiting_payment` | `paid` | PSP webhook confirms success | `amount >= booking.totalVnd`, `currency = 'VND'`. `legalPredecessors('paid')` used in WHERE clause to prevent replays from regressing advanced rows. |
| `awaiting_payment` | `payment_failed_expired` | PSP failure webhook or hold-expiry sweeper | Guarded by `legalPredecessors`. |
| `paid` | `completed` | Operator check-in (`lib/booking/checkIn.ts`) | Sets `checkedInAt`. |
| `paid` | `trip_cancelled` | `cancelTrip` cascade | Bulk UPDATE. Post-commit `refundOut`. |
| `paid` | `no_show` | Operator marks no-show | Sets `noShowAt`. |
| `paid` | `refunded` | Oversold-race detection inside `applyPaidStatusTransition` | Same transaction as paid transition. When `paid_count > capacity` after marking paid. |

> **GAP**: No `paid → cancelled` customer-initiated transition exists. Consumer Protection Law 2023 (No. 19/2023/QH15, Art. 29) grants a 3-day cancellation right for remote contracts. Legal opinion needed on whether bus ticket = "service already performed" exemption. Until resolved, customer cancel is deferred. See risk-register.

### Helper Functions

- `isLegalTransition(from, to)`: returns boolean
- `legalPredecessors(target)`: returns array of statuses that can legally transition TO the target -- used to build the `WHERE status IN (...)` clause in payment webhook UPDATEs, ensuring idempotent replays never regress a booking that has already advanced past the predecessor set.

---

## 3. Hold Lifecycle

**States**: `active` | `consumed` | `expired` | `cancelled_trip`

**Terminal states**: `consumed`, `expired`, `cancelled_trip`

### Transition Table

| From | To | Trigger | Guard / Precondition |
|------|----|---------|---------------------|
| (creation) | `active` | `createHold` | Phone advisory lock + trip advisory lock. Conditional INSERT: capacity check, `Trip.status = 'scheduled'`, `salesClosed = false`. TTL = 10 minutes. |
| `active` | `consumed` | `createOnlineBookingFromHold` | Atomic, same transaction as booking INSERT. |
| `active` | `expired` | `expireHolds` cron | `UPDATE ... FOR UPDATE SKIP LOCKED` in batches of 500. `expiresAt <= NOW()`. |
| `active` | `cancelled_trip` | `cancelTrip` bulk-update | Trip cancellation cascade. |

### Compensating Transaction

If the payment gateway call fails after the hold has been consumed (during booking initiation), the compensating transaction reverts `consumed -> active` (DELETE booking, revert hold status). This prevents a consumed hold from blocking the seat when no booking was actually created.

---

## 4. Payout Status

**States**: `requested` | `processing` | `paid` | `failed`

**Terminal state**: `paid`

### Transition Table

| From | To | Trigger | Guard / Precondition |
|------|----|---------|---------------------|
| (creation) | `requested` | `completeTripCore` (auto-sweep per trip) or `requestWithdrawal` (on-demand, `tripId = null`) | Auto-sweep: `scheduledAt = completedAt + 1d`. Withdrawal: `scheduledAt = NOW()`, requires verified `PayoutAccount` and `available >= amountMinor`. |
| `requested` | `processing` | Payout processor begins bank transfer (`settlePayout`) | |
| `processing` | `paid` | Bank transfer confirmed | Sets `settledAt`. |
| `processing` | `failed` | Bank transfer rejected | Sets `failureReason`. |
| `failed` | `requested` | Admin retry (`lib/ledger/retryPayout.ts`) | |

### Ledger Integration

- Auto-sweep payouts: `payout_debit` LedgerEntry is written when the Payout transitions to settled (via sweep).
- On-demand withdrawals: `payout_debit` LedgerEntry is written at `requested` time (immediately reserves the amount), keyed `payout_debit:<payoutId>` for idempotency.
- Payout reversals (failed -> requested retry): `payout_reversal` entry may be written to correct the ledger.

---

## 5. Operator Approval

**States**: `PENDING_REVIEW` | `UNDER_REVIEW` | `APPROVED` | `REJECTED` | `SUSPENDED`

### Transition Table

Defined in `lib/onboarding/operatorStatus.ts` as `LEGAL_OPERATOR_TRANSITIONS`:

| From | To | Trigger | Guard / Precondition |
|------|----|---------|---------------------|
| `PENDING_REVIEW` | `UNDER_REVIEW` | Admin starts review | `SELECT FOR UPDATE` on Operator. |
| `UNDER_REVIEW` | `APPROVED` | Admin approves | Clears `disabledAt`. |
| `UNDER_REVIEW` | `REJECTED` | Admin rejects | Sets `rejectionReason`. |
| `REJECTED` | `PENDING_REVIEW` | Operator resubmits | Clears `rejectionReason`. |
| `APPROVED` | `SUSPENDED` | Admin suspends | Sets `disabledAt = NOW()`. |
| `SUSPENDED` | `APPROVED` | Admin reinstates | Clears `disabledAt`. |

### Side Effects

- Each transition enqueues two NotificationLog rows: SMS + email (template per target state).
- AdminAuditLog entry written inside the same `$transaction` when `actor` is present.

### Capability Map

Derived from `lib/onboarding/operatorCapabilities.ts`:

| Status | canLogin | searchVisible | canSell | canResubmit | listingsHidden |
|--------|---------|---------------|---------|-------------|---------------|
| `PENDING_REVIEW` | yes | no | no | no | no |
| `UNDER_REVIEW` | yes | no | no | no | no |
| `APPROVED` | yes | yes | yes | no | no |
| `REJECTED` | yes | no | no | yes | no |
| `SUSPENDED` | yes | no | no | no | yes |

`SEARCH_VISIBLE_STATUSES` and `BOOKABLE_STATUSES` are both effectively `['APPROVED']` only.

---

## 6. OTP Lifecycle

Implicit states derived from `OtpAttempt` row fields (no explicit status enum).

**Logical states**:
- **Active**: `consumed = false`, `expiresAt > NOW()`, `attemptCount < MAX`
- **Consumed (success)**: `consumed = true`, `consumedAt` set (normal verification success)
- **Expired**: `consumed = false`, `expiresAt <= NOW()`
- **Lockout sentinel**: `consumed = true`, `attemptCount >= 3`, `expiresAt = NOW() + 15min` (repurposed row)
- **Attempt-capped**: `consumed = false`, `attemptCount >= MAX_OTP_ATTEMPTS` (5 for auth, 3 for account-management)

### Transition Table

| From | To | Trigger | Details |
|------|----|---------|---------|
| (creation) | Active | `generateCode()` | Salted SHA-256 hash of 6-digit code. `ON CONFLICT (phone) WHERE consumed = false DO UPDATE` supersedes any prior active row for same phone. |
| Active | Consumed | Correct verify | CAS UPDATE: `WHERE consumed = false AND expiresAt > NOW() AND codeHash = $hash` -> `consumed = true, consumedAt = NOW()`. Returns `otpProof` JWT. |
| Active | Active (attempt incremented) | Wrong verify (below cap) | Increment `attemptCount`. Return mismatch error with remaining attempts. |
| Active | Lockout sentinel | Wrong verify (cap reached) | Set `consumed = true`, extend `expiresAt = NOW() + 15min`. Return mismatch with `retryAfter`. |
| Active | Expired | TTL passes (5 minutes) | No explicit transition -- detected by `expiresAt <= NOW()` check on next access. |

### Lockout Detection

`findLockoutSentinel(phone)` queries `consumed = true AND attemptCount >= 3 AND expiresAt > NOW()`. Called BEFORE both the send-OTP and verify-OTP paths. If a sentinel is found, returns `locked_out` with `retryAfter` timestamp. The sentinel row's dual meaning (consumed OTP vs. lockout marker) is documented in model comments.

---

## 7. EInvoice Status

**States**: `pending` | `issued` | `sent` | `failed` | `cancelled`

### Transition Table

| From | To | Trigger | Details |
|------|----|---------|---------|
| (creation) | `pending` | Booking reaches paid status | Initial state. |
| `pending` | `issued` | Submitted to MISA meInvoice | Sets `invoiceNumber`, `issuedAt`. |
| `issued` | `sent` | Delivery confirmed | |
| `pending` | `failed` | Submission failure | |
| `issued` | `failed` | Delivery failure | |
| `issued` | `cancelled` | Voided (correction flow) | A new EInvoice row is created for the corrected invoice. |
| `sent` | `cancelled` | Voided (correction flow) | A new EInvoice row is created for the corrected invoice. |

### Notes

- Vietnam compliance per Circular 32/2025/TT-BTC (GDT electronic invoicing; replaces Circular 78/2021).
- `vendorRef` tracks the MISA-side reference for reconciliation.
- Cancellation creates a new row (correction invoice) rather than modifying the existing row, consistent with the immutability principle for financial records.

---

## 8. CharterRequest Status

**States**: `SUBMITTED` | `ADMIN_REVIEW` | `ASSIGNED_DIRECT` | `PUBLISHED` | `ACCEPTED` | `DECLINED` | `REJECTED` | `EXPIRED` | `COMPLETED` | `CANCELLED`

**Terminal states**: `REJECTED`, `COMPLETED`, `CANCELLED`

### Transition Table

Defined in `lib/charter/charterStatus.ts` as `LEGAL_CHARTER_TRANSITIONS`:

| From | To | Trigger | Details |
|------|----|---------|---------|
| `SUBMITTED` | `ADMIN_REVIEW` | Admin picks up request | |
| `SUBMITTED` | `CANCELLED` | Customer cancels | |
| `ADMIN_REVIEW` | `ASSIGNED_DIRECT` | Admin assigns to specific operator | Sets `assigneeOperatorId`, `acceptByAt`. |
| `ADMIN_REVIEW` | `PUBLISHED` | Admin publishes for operator claim | Sets `publishedAt`, `claimByAt`. |
| `ADMIN_REVIEW` | `REJECTED` | Admin rejects | Sets `rejectionReason`. Terminal. |
| `ADMIN_REVIEW` | `CANCELLED` | Customer cancels | |
| `ASSIGNED_DIRECT` | `ACCEPTED` | Operator accepts | Triggers customer "match" notification (SMS + email with operator name). |
| `ASSIGNED_DIRECT` | `DECLINED` | Operator declines | Clears `assigneeOperatorId`. |
| `ASSIGNED_DIRECT` | `ADMIN_REVIEW` | Timeout re-route | Clears `assigneeOperatorId`, `acceptByAt`, `claimByAt`. |
| `ASSIGNED_DIRECT` | `CANCELLED` | Customer cancels | |
| `PUBLISHED` | `ACCEPTED` | Operator claims | Via `claimCharter`. Triggers customer notification. |
| `PUBLISHED` | `EXPIRED` | Claim deadline passes | Via `charterExpirySweeper` job. |
| `PUBLISHED` | `CANCELLED` | Customer cancels | |
| `DECLINED` | `ADMIN_REVIEW` | Admin re-routes | Clears `assigneeOperatorId`, `acceptByAt`, `claimByAt`. |
| `EXPIRED` | `ADMIN_REVIEW` | Admin re-routes | Clears `assigneeOperatorId`, `acceptByAt`, `claimByAt`. |
| `ACCEPTED` | `COMPLETED` | Off-platform settlement confirmed | Terminal. |
| `ACCEPTED` | `CANCELLED` | Customer or admin cancels | Terminal. |

### Customer Cancellation

`CUSTOMER_CANCELLABLE_STATUSES`: `Set(['SUBMITTED', 'ADMIN_REVIEW', 'ASSIGNED_DIRECT', 'PUBLISHED'])`. Customers can only cancel BEFORE the charter is `ACCEPTED` -- once an operator has accepted, cancellation requires admin intervention.

### Implementation Pattern

Uses discriminated result pattern (`{ ok: true, ... }`), not thrown sentinel errors. Supports `requiredAssigneeOperatorId` for TOCTOU-safe operator ownership verification (the operator claiming/declining must be the assigned operator, checked under `SELECT FOR UPDATE`).
