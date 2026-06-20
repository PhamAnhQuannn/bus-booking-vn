# Key Business Event Flows

> Traced through actual route handlers and service files. Research date: 2026-06-17.

---

## Flow 1: Search -> Hold -> Book -> Pay -> Ticket

The primary customer journey from finding a trip to receiving a ticket.

### Step 1: Search

**Route**: `app/api/trips/search/route.ts` -> `lib/trips/searchTrips.ts`

**Input**: origin, destination, date (YYYY-MM-DD in Asia/Ho_Chi_Minh timezone), ticketCount

**Actions**:
1. Normalize search terms via `unaccent_immutable ILIKE` for diacritics-safe matching
2. Filter trips: `status = 'scheduled'`, `salesClosed = false`, `moderatedAt IS NULL`, operator `status = 'APPROVED'`, `departureAt > NOW()`
3. Exclude trips with maintenance overlap: `maintenanceStart IS NULL OR maintenanceEnd < startUtc OR maintenanceStart > endUtc` (window-vs-window, not point-in-time)
4. Compute available seats per trip: `capacity - active_holds - paid_bookings` (3 queries, no N+1 -- see Mistake Log Issue 001)
5. Filter: available seats >= ticketCount

**Output**: Array of trip results with availability counts

**Side effects**: `FunnelEvent(search_performed)` tracked via `lib/analytics/track.ts`

---

### Step 2: Hold

**Route**: `app/api/holds/route.ts` -> `lib/core/db/holdRepo.ts:createHold`

**Input**: tripId, ticketCount, customerPhone, customerName, customerEmail, pickup selection (pickupKind, pickupAreaId, pickupDetail)

**Actions**:
1. Acquire phone-level pg advisory lock: `pg_advisory_xact_lock(hashtext('hold-phone:' || phone))` -- prevents exceeding `CONCURRENT_HOLD_CAP`
2. Check active hold count for phone against cap
3. Acquire trip-level pg advisory lock: `pg_advisory_xact_lock(hashtext('hold:' || tripId))` -- serializes concurrent hold attempts on the same trip
4. Conditional INSERT: create Hold with `status = 'active'`, `expiresAt = NOW() + 10min` only if:
   - Trip `status = 'scheduled'` AND `salesClosed = false`
   - `capacity - active_holds(expiresAt > NOW()) - paid_bookings - awaiting_payment_bookings(createdAt > NOW() - PSP_WINDOW_MINUTES) >= ticketCount`
5. Derive `customPickupRequested = (pickupKind === 'custom')`

**Output**: `{ holdId, expiresAt }` on success, `null` on sold-out/trip-unavailable

**Side effects**:
- Sets `bb_hold` cookie (signed holdId, 12-min expiry) on the HTTP response
- `FunnelEvent(hold_created)`

---

### Step 3: Hold Review

**Route**: `app/booking/review/page.tsx` -> `lib/booking/getHoldDetails.ts`

**Input**: holdId from `bb_hold` cookie

**Actions**:
1. Server component reads hold details in-process via `getHoldDetails` (no self-fetch -- see Mistake Log Issue 003)
2. Validates hold is still active and not expired
3. Pickup selection validated via `lib/booking/pickupSelection.ts`
4. Renders review page with trip details, pricing, and pickup confirmation

**Output**: Rendered review page with booking form

---

### Step 4: Initiate Booking

**Route**: `app/api/bookings/route.ts` -> `lib/booking/initiateOnlineBooking.ts`

**Input**: holdId (from cookie), buyer details, pickup confirmation, consent acknowledgements

**Actions**:
1. Validate hold is `active` and not expired
2. Re-verify operator `status IN ['APPROVED']` (closes suspend-after-search race)
3. `$transaction`:
   a. `SELECT FOR UPDATE` on Trip (defense-in-depth)
   b. Atomic `INSERT ... ON CONFLICT ("holdId") DO NOTHING` with guards: hold active + not expired, trip `status = 'scheduled'` + `salesClosed = false` + `departureAt > NOW()`
   c. Set `Booking.status = 'awaiting_payment'`, compute `totalVnd = Trip.price * ticketCount`
   d. Write two `ConsentRecord` rows: `no_refund` + `pii_storage`
   e. Mark hold as `consumed`
4. Call `gateway.createPayment(...)` for PSP payment URL
5. On gateway failure: compensating transaction (DELETE booking, revert hold to `active`)

**Output**: `{ payUrl, confirmationToken }`

**Side effects**: `FunnelEvent(payment_initiated)`

---

### Step 5: Payment Webhook

**Route**: `app/api/payments/[method]/webhook/route.ts` -> `lib/payment/processWebhook.ts`

**Input**: Raw webhook body from PSP (MoMo, VNPay, or stub)

**Actions**:
1. Adapter verifies HMAC signature; return 400 on failure
2. Adapter normalizes raw result to canonical `{ status, providerTxnId, amount, currency }`
3. Look up Booking by `bookingRef`; return 200 no-op if not found (no enumeration leak)
4. `$transaction`:
   a. INSERT `PaymentEvent` (idempotent via `@@unique([adapter, providerTxnId])`; P2002 duplicate -> 200 no-op)
   b. **If status = 'paid'**:
      - Currency guard: reject non-VND (no transition, log warning)
      - Amount guard: reject `amount < booking.totalVnd` (underpay, no transition)
      - Overpay: log warning, still mark paid, capture overpay amount for post-commit refund
      - `applyPaidStatusTransition(tx, bookingId, providerTxnId)`: UPDATE Booking SET `status = 'paid'` WHERE `status IN legalPredecessors('paid')`
      - `SELECT FOR UPDATE` on Trip + paid-seat count; if `paid > capacity` -> `status = 'refunded'` (oversold race)
      - If not oversold: `appendBookingPaidLedger` writes two LedgerEntry rows: `booking_credit` (+gross) and `platform_fee` (-fee)
      - Enqueue NotificationLog: `customerBookingPaid` + `operatorNewBooking`
   c. **If status = 'failed'**: transition to `payment_failed_expired` (guarded by `legalPredecessors`)
   d. **If status = 'pending' or 'unknown'**: no transition (PaymentEvent recorded only)
5. Post-commit via `after()`: overpay refund (`overpay_difference` key) and/or oversold refund (`oversold_race` key) via `refundOut()`

**Output**: Always HTTP 200 to gateway (except 400 for invalid signature)

**Side effects**: `FunnelEvent(booking_paid)` with `gmvVnd`

---

### Step 6: Ticket

**Trigger**: Cron job generates ticket PDF

**Actions**:
1. PDF generation via `lib/booking/ticketPdf.tsx`
2. Upload to object storage
3. Set `Booking.ticketPdfKey` to the storage path

**Output**: Customer views ticket at `/booking/confirmation/[confirmationToken]`

---

## Flow 2: Operator Creates Trip

**Route**: `app/api/op/trips/route.ts` -> `lib/trips/createTrip.ts`

**Input**: routeId, busId, departureAt, price, optional pickup areas

**Actions**:
1. Validate operator scope via `withOperatorScope` (tenant isolation)
2. Verify Route belongs to operator and is not deactivated/moderated
3. `$transaction`:
   a. `SELECT FOR UPDATE` on Bus row
   b. Guard: `bus.deactivatedAt IS NULL`
   c. Guard: no maintenance window overlap (`maintenanceStart <= departureAt < maintenanceEnd`)
   d. Guard: no bus time-window overlap via `busHasOverlappingTrip` (`[departureAt, departureAt + durationMinutes + 60min buffer]`)
   e. INSERT Trip with `status = 'scheduled'`, `salesClosed = false`, `price = <operator-supplied>` (I7-exempt: operator IS price authority)
   f. Optional: create `TripPickupArea` rows linking to `OperatorPickupArea`

**Output**: Created Trip DTO

**Notes**:
- For recurring trips: `generateFromTemplate` uses the same core logic, deduplicating via partial unique index in `RecurringGenerationLog`
- Paired return trips (`pairedReturn`) use the same bus-overlap guard with a `bus_overlap_with_outbound` error code

---

## Flow 3: Cancellation + Refund

> **Update (2026-06-20):** Customer-initiated cancellation is now fully specified in DS-007 (Refund Flow) and FD-018 (Cancellation & Refund UX). Five refund triggers (customer self-cancel with CPL 2023 Art. 29 3-day window, operator trip cancel, oversold race, overpay difference, admin manual), tiered fee schedule (0/10/20%), and PSP refund APIs (MoMo/VNPay/manual bank transfer) are designed. Verify implementation status against DS-007 before go-live.

Previously: no customer-initiated cancellation was implemented; only operators/system could cancel. Legal opinion on CPL 2023 Art. 29 was pending.

### Operator Trip Cancellation

**Route**: `app/api/op/trips/[id]/route.ts` (DELETE) -> `lib/trips/cancelTrip.ts`

**Input**: tripId, cancelReason (operator-supplied)

**Actions**:
1. `$transaction` + `SELECT FOR UPDATE` on Trip
2. **Idempotency check**: if `status === 'cancelled'`, return `{ alreadyCancelled: true, cancelledBookings: 0 }` with HTTP 200 (no throw -- discriminated result pattern)
3. UPDATE Trip: `status = 'cancelled'`, `cancelledAt = NOW()`, `cancelReason`
4. Bulk UPDATE Booking: `status -> 'trip_cancelled'` where status IN `['awaiting_payment', 'paid', 'completed']`
5. Bulk UPDATE Hold: `status -> 'cancelled_trip'` where `status = 'active'`
6. INSERT NotificationLog per affected booking (template: `trip_cancelled`, channel: SMS)
7. Post-commit: `refundOut()` per paid booking, keyed `cancel:<tripId>:<bookingId>` (best-effort, logged on failure)

**Output**: `{ trip: TripDto, alreadyCancelled: boolean, cancelledBookings: number, cancelledHolds: number, notificationsEnqueued: number }`

### refundOut

**Service**: `lib/ledger/refund.ts`

**Actions**:
1. Replay guard: check for existing `refund_out:<key>` LedgerEntry (idempotent)
2. Call PSP refund via gateway adapter
3. `$transaction`: write `refund_debit` (-amount) and `refund_out` (-amount) LedgerEntry rows

---

## Flow 4: Payout (T+1 Settlement)

### Trip Completion

**Service**: `lib/trips/completeTripCore.ts` (called by operator or `autoCompleteTrips` cron)

**Actions**:
1. `$transaction` + `SELECT FOR UPDATE` on Trip
2. Guard: not cancelled, `departedAt IS NOT NULL` (`trip_not_departed` error otherwise)
3. **Idempotency**: `completedAt IS NOT NULL` -> return existing result with `alreadyCompleted: true`
4. UPDATE Trip: `status = 'completed'`, `completedAt = NOW()`
5. Create NotificationLog rows (template: `payout_scheduled`, channel: SMS) per paid booking, with `scheduledFor = completedAt + 1 day` as a **top-level column** (not in JSON payload -- see Mistake Log Issue 014)
6. Compute payout amounts via `calcPayout({ grossPaidBookings })` using BigInt arithmetic
7. Create Payout row: `{ tripId, operatorId, gross, platformFee, net, status: 'requested', scheduledAt: completedAt + 1 day }` (idempotent via `findFirst`)

### Settlement

Settlement delay: `SETTLEMENT_DELAY_DAYS = 1` (T+1), configured in `lib/ledger/constants.ts` with SQL interval `'1 day'`.

Revenue becomes available (settlement-eligible) only when `Trip.completedAt + '1 day' <= NOW()`.

### Balance Derivation

**Service**: `lib/ledger/balance.ts` -> `getOperatorBalance(operatorId)`

**Returns**: `{ pending, available, paidOut }` (all BigInt, converted from Postgres `::text` casts)

| Component | Derivation |
|-----------|-----------|
| `settled_eligible` | SUM of non-payout/non-tax entries where linked trip `status = 'completed'` AND `completedAt + '1 day' <= NOW()` |
| `pending` | SUM of non-payout/non-tax entries where trip NOT yet settlement-eligible |
| `paid_out` | Negated SUM of `payout_debit` + `tax_withheld` entries (stored negative, reported as positive magnitude) |
| `available` | `settled_eligible - paid_out` |

**Included entry types**: `booking_credit`, `platform_fee`, `refund_debit`, `payout_debit`, `payout_reversal`, `chargeback`, `adjustment`, `tax_withheld`. Excluded: `refund_out` (platform-float, already accounted via paired `refund_debit`).

### Withdrawal

**Service**: `lib/ledger/withdrawal.ts` -> `requestWithdrawal({ operatorId, amountMinor, idempotencyKey })`

**Actions**:
1. Validate: positive integer, >= `MIN_WITHDRAW_THRESHOLD_VND` (100,000 VND)
2. Layer-1 idempotency: check for existing `withdraw-key:<idempotencyKey>` marker in LedgerEntry; if found, return its `payoutId`
3. `$transaction` with `SELECT FOR UPDATE` on Operator row:
   a. Layer-2 re-probe of marker under lock (concurrent same-key guard)
   b. Verify `PayoutAccount.verifiedAt IS NOT NULL` (`payout_account_unverified` if not)
   c. Recompute available balance under lock
   d. Guard: `available >= amountMinor` (`insufficient_available` if not)
   e. Create Payout: `{ tripId: null, operatorId, gross: amountMinor, platformFee: 0, net: amountMinor, status: 'requested', scheduledAt: NOW() }`
   f. Append `payout_debit` LedgerEntry (negative amount, keyed `payout_debit:<payoutId>`)
   g. Append zero-amount `adjustment` marker (keyed `withdraw-key:<idempotencyKey>`, carries `payoutId` for replay)

**Output**: `{ ok: true, payoutId }` or `{ ok: false, reason: 'below_min' | 'insufficient_available' | 'invalid_amount' | 'payout_account_unverified' }`

### Payout Processing Pipeline

`requested -> processing -> paid | failed`

- `processing`: payout processor begins bank transfer (via `settlePayout`)
- `paid`: bank transfer confirmed, sets `settledAt`
- `failed`: bank transfer rejected, sets `failureReason`; admin can retry via `retryPayout` (`failed -> requested`)

---

## Flow 5: Operator Approval Lifecycle

**Service**: `lib/onboarding/operatorStatus.ts` -> `transitionOperatorStatus`

**Actions**:
1. `$transaction` + `SELECT FOR UPDATE` on Operator row
2. Validate transition is legal per `LEGAL_OPERATOR_TRANSITIONS` map
3. Apply side effects per target state:
   - `APPROVED`: clear `disabledAt`
   - `REJECTED`: set `rejectionReason`
   - `PENDING_REVIEW` (resubmit): clear `rejectionReason`
   - `SUSPENDED`: set `disabledAt = NOW()`
4. Enqueue NotificationLog rows (SMS + email) per transition
5. Write AdminAuditLog entry (when `actor` is present)

**Impact on other contexts**: Only `APPROVED` operators appear in search (`SEARCH_VISIBLE_STATUSES`), can sell tickets (`BOOKABLE_STATUSES`), and can manage fleet. Suspended operators have `listingsHidden = true` and cannot sell.

---

## Flow 6: Charter Request Lifecycle

**Service**: `lib/charter/charterStatus.ts`, `lib/charter/claimCharter.ts`, `lib/charter/declineCharter.ts`

**Actions**:
1. Customer creates charter request via `createCharterRequest` -> status `SUBMITTED`
2. Admin reviews and either:
   a. Assigns directly to an operator (`ASSIGNED_DIRECT`, sets `assigneeOperatorId` + `acceptByAt`)
   b. Publishes for operator claim (`PUBLISHED`, sets `publishedAt` + `claimByAt`)
   c. Rejects (`REJECTED` -- terminal)
3. Operator accepts (`ACCEPTED`, triggers customer notification) or declines (`DECLINED`, clears assignee)
4. Declined/expired requests re-route to `ADMIN_REVIEW` for reassignment
5. Accepted requests -> `COMPLETED` (off-platform settlement) or `CANCELLED`
6. Customer can cancel from: `SUBMITTED`, `ADMIN_REVIEW`, `ASSIGNED_DIRECT`, `PUBLISHED` (not after `ACCEPTED`)
7. `charterExpirySweeper` job transitions stale requests past their deadline
