# 08 -- lib/booking/ Domain Module

> Generated: 2026-06-21
> Covers: `lib/booking/` -- the booking domain public API

## Overview

The `lib/booking/` module owns the entire booking lifecycle: hold-to-booking conversion, payment gateway orchestration, state transitions, operator queue/manifest views, customer booking history, check-in/no-show boarding operations, ticket PDF generation, and guest-to-customer attachment.

All cross-domain consumers import through the barrel (`lib/booking/index.ts`). Client components (`'use client'`) must NOT import the barrel (it pulls server-only transitives); they use deep imports to client-safe submodules only.

---

## Directory Layout

```
lib/booking/
  index.ts                        Barrel (public API)
  initiateOnlineBooking.ts        Full online booking orchestrator
  initiateMomoBooking.ts          MoMo-specific thin wrapper
  bookingRef.ts                   Human-readable booking reference generator
  bookingDto.ts                   BookingDto type definitions
  toBookingDto.ts                 Prisma row -> BookingDto mapper
  toBookingQueueRow.ts            Prisma row -> BookingQueueRow mapper
  bookingSelects.ts               Prisma select shapes (UI contract)
  bookingRepo.ts                  Low-level atomic DB operations
  transitions.ts                  Booking status state machine
  getHoldDetails.ts               Hold info for review page
  getCustomerBookingDetail.ts     Customer single-booking detail
  getOperatorBooking.ts           Operator single-booking detail
  getBookingDetailPage.ts         Operator booking detail page bundle
  listCustomerBookings.ts         Customer booking history (paginated)
  listOperatorBookings.ts         Operator booking queue (paginated)
  getUnviewedPaidCount.ts         Unread paid-booking badge count
  getManifest.ts                  Trip boarding manifest
  checkIn.ts                      Check-in, no-show, scan ticket
  attachGuestBooking.ts           Guest booking attachment placeholder
  attachGuestBookingByPhone.ts    Phone-match guest-to-customer linking
  confirmationToken.ts            Opaque confirmation token generator
  consent.ts                      Checkout consent constants (VN copy)
  ticketPdf.tsx                   React PDF ticket renderer with QR
  touchLastViewed.ts              Operator last-viewed timestamp
  resolveBookingTripId.ts         Booking -> tripId resolver (staff scope)
  pickupSelection.ts              Pickup point validation
  __tests__/                      Unit + integration tests
```

---

## File-by-File Reference

### index.ts

**Path:** `lib/booking/index.ts`
**Purpose:** Barrel file -- public API surface for cross-domain consumers (SYS20 rule 3).

| Export | Source Module |
|--------|-------------|
| `backfillGuestBookingsForCustomer` | `attachGuestBookingByPhone.ts` |
| `renderTicketPdf` | `ticketPdf.tsx` |
| `customerBookingDetailSelect` | `getCustomerBookingDetail.ts` |
| `BookingDto` (type) | `bookingDto.ts` |
| `BookingPaymentStatus` (type) | `bookingDto.ts` |
| `getBookingByConfirmationToken` | `bookingRepo.ts` |
| `checkInBooking` | `checkIn.ts` |
| `markNoShow` | `checkIn.ts` |
| `scanTicket` | `checkIn.ts` |
| `CONSENT_VERSION` | `consent.ts` |
| `CONSENT_TEXT` | `consent.ts` |
| `validatePickupSelection` | `pickupSelection.ts` |
| `PickupSelection` (type) | `pickupSelection.ts` |
| `PickupCheck` (type) | `pickupSelection.ts` |
| `getBookingDetailPage` | `getBookingDetailPage.ts` |
| `getCustomerBookingDetail` | `getCustomerBookingDetail.ts` |
| `CustomerBookingDetail` (type) | `getCustomerBookingDetail.ts` |
| `getHoldDetails` | `getHoldDetails.ts` |
| `getManifest` | `getManifest.ts` |
| `ManifestRow` (type) | `getManifest.ts` |
| `getOperatorBooking` | `getOperatorBooking.ts` |
| `getUnviewedPaidCount` | `getUnviewedPaidCount.ts` |
| `initiateOnlineBooking` | `initiateOnlineBooking.ts` |
| `listCustomerBookings` | `listCustomerBookings.ts` |
| `ListCustomerBookingsParamsSchema` | `listCustomerBookings.ts` |
| `CustomerBookingRow` (type) | `listCustomerBookings.ts` |
| `listOperatorBookings` | `listOperatorBookings.ts` |
| `ListOperatorBookingsParamsSchema` | `listOperatorBookings.ts` |
| `resolveBookingTripId` | `resolveBookingTripId.ts` |
| `BookingQueueRow` (type) | `toBookingQueueRow.ts` |
| `touchLastViewed` | `touchLastViewed.ts` |
| `legalPredecessors` | `transitions.ts` |

---

### initiateOnlineBooking.ts

**Path:** `lib/booking/initiateOnlineBooking.ts`
**Purpose:** Orchestrates the full online (pay-first) booking flow for all gateways (momo, zalopay, card). Pipeline: validate hold -> idempotency check -> pre-check departure -> atomic INSERT via `createOnlineBookingFromHold` -> call payment gateway -> compensate on failure.

| Export | Kind | Description |
|--------|------|-------------|
| `InitiateOnlineBookingInput` | interface | `{ holdId, baseUrl, method, customerId?, consentVersion, gateway? }` |
| `InitiateOnlineBookingResult` | type | Discriminated union: `{ ok: true, bookingId, confirmationToken, payUrl }` or `{ ok: false, error, gatewayMessage? }` |
| `initiateOnlineBooking` | async function | `(input: InitiateOnlineBookingInput) => Promise<InitiateOnlineBookingResult>` |

**Error codes:** `hold_not_found`, `hold_expired`, `trip_departed`, `operator_not_bookable`, `ref_collision`, `gateway_error`.

**Key behaviors:**
- Re-checks operator bookable status (Issue 046 defense-in-depth).
- Idempotent: returns existing booking if one already exists for the holdId.
- On gateway failure: compensating transaction DELETEs booking row and reverts hold to `active`.
- Gateway is injectable for testing; defaults to `getGatewayFor(method, baseUrl)`.
- Calls `attachGuestBooking` on success (currently a no-op placeholder).

---

### initiateMomoBooking.ts

**Path:** `lib/booking/initiateMomoBooking.ts`
**Purpose:** Thin wrapper over `initiateOnlineBooking` pinned to method `'momo'`. Preserved for existing callers and tests.

| Export | Kind | Description |
|--------|------|-------------|
| `InitiateMomoBookingInput` | interface | `{ holdId, baseUrl, consentVersion?, gateway? }` |
| `InitiateMomoBookingResult` | type | Alias for `InitiateOnlineBookingResult` |
| `initiateMomoBooking` | async function | `(input: InitiateMomoBookingInput) => Promise<InitiateMomoBookingResult>` |

---

### bookingRef.ts

**Path:** `lib/booking/bookingRef.ts`
**Purpose:** Generates human-readable booking references in format `BB-YYYY-XXXX-XXXX` where YYYY is the 4-digit year in Asia/Ho_Chi_Minh timezone and XXXX-XXXX is 8 random lowercase base36 characters from `crypto.randomBytes`.

| Export | Kind | Description |
|--------|------|-------------|
| `generateBookingRef` | function | `(now?: Date) => string` -- generates a booking reference |
| `BOOKING_REF_REGEX` | RegExp | `/^BB-\d{4}-[0-9a-z]{4}-[0-9a-z]{4}$/` -- validation pattern |

**Note:** Collisions are possible -- the DB unique index is the source of truth; callers retry on P2002 up to 5 times.

---

### bookingDto.ts

**Path:** `lib/booking/bookingDto.ts`
**Purpose:** Canonical DTO shape for operator booking API responses (Issue 014). Fields mirror Booking model columns in schema.prisma order. No seat-number field (AC6).

| Export | Kind | Description |
|--------|------|-------------|
| `BookingPaymentStatus` | type | `'awaiting_payment' \| 'paid' \| 'completed' \| 'cancelled' \| 'trip_cancelled' \| 'no_show' \| 'payment_failed_expired' \| 'refunded'` |
| `BookingContactStatus` | type | `'pending' \| 'reached' \| 'no_answer' \| 'callback'` |
| `BookingDto` | interface | Full booking DTO with nested `trip` object (see fields below) |

**BookingDto fields:**
`id`, `bookingRef`, `tripId`, `holdId`, `customerId`, `buyerName`, `buyerPhone`, `ticketCount`, `totalVnd`, `paymentMethod` (`'momo' | 'zalopay' | 'card'`), `paymentExternalRef`, `status`, `isManual`, `createdAt`, `contactStatus`, `pickupKind`, `pickupAreaLabel`, `pickupDetail`, `pickedUpAt`, `escalationNote`, `escalatedAt`, `refundedAt`, `trip: { id, departureAt, price, departedAt, completedAt, route: { origin, destination }, bus: { licensePlate } }`.

---

### toBookingDto.ts

**Path:** `lib/booking/toBookingDto.ts`
**Purpose:** Converts a Prisma Booking row (with includes) to `BookingDto`. Centralises field mapping to avoid drift between route handlers and pages.

| Export | Kind | Description |
|--------|------|-------------|
| `BookingDtoRow` | interface | Input shape: raw Prisma row with `Date` fields and nested `trip` |
| `toBookingDto` | function | `(row: BookingDtoRow) => BookingDto` -- converts dates to ISO 8601 strings |

---

### toBookingQueueRow.ts

**Path:** `lib/booking/toBookingQueueRow.ts`
**Purpose:** Lean queue row shape for the operator booking list (Issue 014). AC6: NO seat-number column.

| Export | Kind | Description |
|--------|------|-------------|
| `BookingQueueRow` | interface | `{ id, bookingRef, buyerName, buyerPhone, ticketCount, contactStatus, pickupAreaLabel, paymentStatus, departureAt, escalatedAt, manualFlag }` |
| `BookingQueueRawRow` | interface | Raw Prisma shape input (Date fields, nested trip) |
| `toBookingQueueRow` | function | `(row: BookingQueueRawRow) => BookingQueueRow` |

---

### bookingSelects.ts

**Path:** `lib/booking/bookingSelects.ts`
**Purpose:** Prisma `select` shapes for Booking queries. Extracted so unit tests can assert UI-contract fields without pulling the Prisma client. Rule: select whitelist == exactly the UI contract fields.

| Export | Kind | Description |
|--------|------|-------------|
| `bookingDetailSelect` | const (Prisma.BookingSelect) | Select shape for confirmation-token-based detail lookup. Includes `trip.route`, `trip.bus.operator` |
| `BookingFullDetails` | type | `Prisma.BookingGetPayload<{ select: typeof bookingDetailSelect }>` |

---

### bookingRepo.ts

**Path:** `lib/booking/bookingRepo.ts`
**Purpose:** Atomic online-booking creation and confirmation lookup. Race-safe, idempotent INSERT using `ON CONFLICT ("holdId") DO NOTHING`. Validates hold is active + unexpired and trip is scheduled + open. Uses UUIDv7 for booking IDs.

| Export | Kind | Description |
|--------|------|-------------|
| `CreateMomoBookingInput` | interface | `{ holdId, buyerName, buyerPhone, buyerEmail?, customerId?, consentVersion }` |
| `OnlineBookingMethod` | type | `'momo' \| 'zalopay' \| 'card' \| 'vnpay'` |
| `CreateOnlineBookingInput` | interface | `{ holdId, buyerName, buyerPhone, buyerEmail?, customerId?, consentVersion }` |
| `CreateCashBookingResult` | type | `{ ok: true, booking } \| { ok: false, reason }` |
| `BookingRow` | interface | Raw booking row shape returned from INSERT |
| `createOnlineBookingFromHold` | async function | `(input: CreateOnlineBookingInput, method: OnlineBookingMethod) => Promise<CreateCashBookingResult>` |
| `createMomoBookingFromHold` | async function | Thin wrapper: delegates to `createOnlineBookingFromHold` with method `'momo'` |
| `getBookingByConfirmationToken` | async function | `(confirmationToken: string) => Promise<BookingFullDetails \| null>` |
| `getBookingByHoldId` | async function | `(holdId: string) => Promise<{ id, confirmationToken } \| null>` |
| `bookingDetailSelect` | re-export | From `bookingSelects.ts` |
| `BookingFullDetails` | re-export (type) | From `bookingSelects.ts` |

**Key behaviors:**
- Trip row locked `FOR UPDATE` before insert (Issue 036 defense-in-depth).
- Retries up to 5 times on bookingRef unique constraint collision (P2002).
- Creates two `ConsentRecord` rows (no_refund + pii_storage) in the same transaction (Issue 089).
- Marks hold as `consumed` after successful insert.

---

### transitions.ts

**Path:** `lib/booking/transitions.ts`
**Purpose:** Booking-status state machine -- the single source of truth for legal forward moves (Issue 034).

| Export | Kind | Description |
|--------|------|-------------|
| `LEGAL_BOOKING_TRANSITIONS` | const (Record) | Maps each `BookingStatus` to its legal successor states |
| `isLegalTransition` | function | `(from: BookingStatus, to: BookingStatus) => boolean` |
| `legalPredecessors` | function | `(to: BookingStatus) => BookingStatus[]` -- all states that may transition INTO `to` |

**State machine:**

| From | Legal Successors |
|------|-----------------|
| `awaiting_payment` | `paid`, `payment_failed_expired` |
| `paid` | `completed`, `trip_cancelled`, `no_show`, `refunded` |
| `completed` | _(terminal)_ |
| `cancelled` | _(terminal)_ |
| `trip_cancelled` | _(terminal)_ |
| `no_show` | _(terminal)_ |
| `payment_failed_expired` | _(terminal)_ |
| `refunded` | _(terminal)_ |

---

### getHoldDetails.ts

**Path:** `lib/booking/getHoldDetails.ts`
**Purpose:** Loads hold details for the review/initiate flow. Pure DB read -- callers must verify bb_hold cookie ownership before calling.

| Export | Kind | Description |
|--------|------|-------------|
| `HoldDetails` | interface | `{ tripId, ticketCount, expiresAt, unitPriceVND, totalVND, routeOrigin, routeDestination, departureAt, operatorLegalName, pickupKind, pickupAreaLabel, pickupDetail }` |
| `getHoldDetails` | async function | `(holdId: string) => Promise<HoldDetails \| null>` |

**Note:** `totalVND` is server-computed (`trip.price * ticketCount`) -- never trusts a client-supplied amount.

---

### getCustomerBookingDetail.ts

**Path:** `lib/booking/getCustomerBookingDetail.ts`
**Purpose:** Single booking detail for an authenticated customer (Issue 009). Query scoped by BOTH `id` AND `customerId` -- a customer can only read their own bookings.

| Export | Kind | Description |
|--------|------|-------------|
| `customerBookingDetailSelect` | const (Prisma.BookingSelect) | Select shape including trip, route, bus, operator |
| `CustomerBookingDetail` | interface | `{ id, bookingRef, buyerName, buyerPhone, ticketCount, totalVnd, paymentMethod, status, createdAt, route, departureAt, busLicensePlate, operator: { legalName, contactPhone } }` |
| `getCustomerBookingDetail` | async function | `(customerId: string, bookingId: string) => Promise<CustomerBookingDetail \| null>` |

---

### getOperatorBooking.ts

**Path:** `lib/booking/getOperatorBooking.ts`
**Purpose:** Fetch single booking with full `BookingDto` for operators (Issue 014). Tenant-isolated via `trip.operatorId` join.

| Export | Kind | Description |
|--------|------|-------------|
| `getOperatorBooking` | async function | `(operatorId: string, bookingId: string) => Promise<BookingDto \| null>` |

---

### getBookingDetailPage.ts

**Path:** `lib/booking/getBookingDetailPage.ts`
**Purpose:** Server-side bundle for the operator booking detail page (Issue 014). Called in-process by the page server component (never self-fetch -- Issue 002/003 hardened rule).

| Export | Kind | Description |
|--------|------|-------------|
| `BookingDetailPageData` | interface | `{ booking: BookingDto }` |
| `getBookingDetailPage` | async function | `(operatorId: string, bookingId: string) => Promise<BookingDetailPageData \| null>` |

---

### listCustomerBookings.ts

**Path:** `lib/booking/listCustomerBookings.ts`
**Purpose:** Paginated booking history for authenticated customers (Issue 009). Two tabs: `upcoming` (active + future departure) and `past` (past departure or terminal status). Cursor-based pagination on booking id.

| Export | Kind | Description |
|--------|------|-------------|
| `ListCustomerBookingsParamsSchema` | Zod schema | `{ tab: 'upcoming'\|'past', limit: 1-100, cursor?: string }` |
| `ListCustomerBookingsParams` | type | `z.input<typeof ListCustomerBookingsParamsSchema>` |
| `customerBookingSelect` | const (Prisma.BookingSelect) | Select shape for list rows |
| `CustomerBookingRow` | interface | `{ id, bookingRef, ticketCount, totalVnd, paymentMethod, status, createdAt, route, departureAt }` |
| `ListCustomerBookingsResult` | interface | `{ rows: CustomerBookingRow[], nextCursor: string \| null }` |
| `listCustomerBookings` | async function | `(customerId: string, params: ListCustomerBookingsParams) => Promise<ListCustomerBookingsResult>` |

**Active statuses:** `awaiting_payment`, `paid`.
**Terminal statuses:** `completed`, `cancelled`, `trip_cancelled`, `no_show`, `payment_failed_expired`.

---

### listOperatorBookings.ts

**Path:** `lib/booking/listOperatorBookings.ts`
**Purpose:** Paginated paid booking queue for operators (Issue 014 AC2). Filters by busId, serviceDate, routeId, tripId, contactStatus. Tenant-isolated via `trip.operatorId`.

| Export | Kind | Description |
|--------|------|-------------|
| `ListOperatorBookingsParamsSchema` | Zod schema | `{ busId?, serviceDate? (YYYY-MM-DD), routeId?, tripId?, contactStatus?, limit: 1-100, cursor? }` |
| `ListOperatorBookingsParams` | type | `z.input<typeof ListOperatorBookingsParamsSchema>` |
| `ListOperatorBookingsResult` | interface | `{ rows: BookingQueueRow[], nextCursor: string \| null }` |
| `listOperatorBookings` | async function | `(operatorId: string, params: ListOperatorBookingsParams) => Promise<ListOperatorBookingsResult>` |

**Key behaviors:**
- Only shows paid/completed statuses.
- serviceDate filter uses Vietnam UTC+7 timezone window (`T00:00:00+07:00` to `T23:59:59.999+07:00`).
- Sorted by `trip.departureAt ASC`, then `id ASC`.

---

### getUnviewedPaidCount.ts

**Path:** `lib/booking/getUnviewedPaidCount.ts`
**Purpose:** Counts paid bookings newer than the operator's `lastBookingsViewedAt` timestamp (Issue 014 AC1 badge).

| Export | Kind | Description |
|--------|------|-------------|
| `getUnviewedPaidCount` | async function | `(operatorUserId: string, operatorId: string) => Promise<number>` |

Returns 0 if the OperatorUser record is not found. If `lastBookingsViewedAt` is null (first visit), counts ALL paid bookings for the operator.

---

### getManifest.ts

**Path:** `lib/booking/getManifest.ts`
**Purpose:** Boarding manifest for a trip (Issue 014 AC6). Returns paid bookings with passenger info, pickup details, check-in state, and contact status. AC6: NO seatNumber field.

| Export | Kind | Description |
|--------|------|-------------|
| `ManifestRow` | interface | `{ bookingId, bookingRef, name, phone, ticketCount, pickupKind, pickupAreaLabel, pickupDetail, customPickupRequested, contactStatus, paymentStatus, pickedUpAt, escalatedAt, checkedInAt, noShowAt, manualFlag }` |
| `GetManifestResult` | interface | `{ tripId, rows: ManifestRow[], generatedAt }` |
| `getManifest` | async function | `(operatorId: string, tripId: string) => Promise<GetManifestResult \| null>` |

Tenant-isolated via `withOperatorScope`. Returns `null` if trip does not exist or belongs to another operator.

---

### checkIn.ts

**Path:** `lib/booking/checkIn.ts`
**Purpose:** Operator boarding operations (Issue 073): scan ticket, check-in, and no-show. All tenant-scoped on `Trip.operatorId`.

| Export | Kind | Description |
|--------|------|-------------|
| `BOARDABLE_STATUSES` | const | `['paid', 'completed']` |
| `ScanBooking` | interface | `{ id, bookingRef, ticketCount, buyerName, checkedInAt, noShowAt, status, tripId }` |
| `ScanReason` | type | `'invalid_token' \| 'wrong_operator' \| 'not_paid'` |
| `ScanResult` | type | `{ ok: true, booking: ScanBooking } \| { ok: false, reason: ScanReason }` |
| `CheckInResult` | type | `{ ok: true, alreadyCheckedIn: boolean } \| { ok: false, reason: 'not_found' }` |
| `NoShowResult` | type | `{ ok: true } \| { ok: false, reason: 'not_found' \| 'already_checked_in' }` |
| `scanTicket` | async function | `(db: Db, { token, operatorId }) => Promise<ScanResult>` |
| `checkInBooking` | async function | `(db: Db, { bookingId, operatorId }) => Promise<CheckInResult>` |
| `markNoShow` | async function | `(db: Db, { bookingId, operatorId }) => Promise<NoShowResult>` |

**Key behaviors:**
- `scanTicket`: Verifies ticket token, checks cross-operator isolation (AC4 -- no existence leak), checks boardable status.
- `checkInBooking`: Atomic conditional UPDATE (`SET checkedInAt = NOW() WHERE checkedInAt IS NULL`). Two concurrent scans: exactly one wins, the other gets idempotent `alreadyCheckedIn: true`.
- `markNoShow`: Pairs `status='no_show'` with `noShowAt=NOW()` in the same update (Issue 014 verb-At+status rule). Guarded: cannot no-show someone already checked in.
- All three accept a `Db` parameter (PrismaClient or tx handle).

---

### attachGuestBooking.ts

**Path:** `lib/booking/attachGuestBooking.ts`
**Purpose:** Placeholder for future "remember this booking on this device" wiring (Issue 009 guest booking history). Currently a no-op.

| Export | Kind | Description |
|--------|------|-------------|
| `attachGuestBooking` | async function | `(bookingId: string) => Promise<void>` -- intentionally does nothing |

---

### attachGuestBookingByPhone.ts

**Path:** `lib/booking/attachGuestBookingByPhone.ts`
**Purpose:** Links a guest booking to a registered Customer by matching `buyerPhone` to `Customer.phone` (Issue 009). Normalizes phone to E.164 before matching. Idempotent (only claims bookings where `customerId IS NULL`).

| Export | Kind | Description |
|--------|------|-------------|
| `attachGuestBookingByPhone` | async function | `(tx: Prisma.TransactionClient, bookingId, buyerPhone) => Promise<void>` |
| `backfillGuestBookingsForCustomer` | async function | `(tx: Prisma.TransactionClient, customerId, e164Phone) => Promise<number>` -- claims all unowned bookings matching the phone variants |

**Security note (Issue 031):** This function is NO LONGER called from any payment transition. Ownership now comes from (1) signed-in buyer's `Customer.id` stamped at initiate, and (2) OTP-proven register backfill. Retained as a building block for future OTP-gated attach flows.

---

### confirmationToken.ts

**Path:** `lib/booking/confirmationToken.ts`
**Purpose:** Generates opaque confirmation tokens for booking confirmation links. 192 bits (24 bytes) base64url-encoded, producing 32-character tokens. Must not leak booking ordering or creation time.

| Export | Kind | Description |
|--------|------|-------------|
| `generateConfirmationToken` | function | `() => string` -- 32-char base64url token |
| `CONFIRMATION_TOKEN_REGEX` | RegExp | `/^[A-Za-z0-9_-]{32}$/` |

---

### consent.ts

**Path:** `lib/booking/consent.ts`
**Purpose:** Checkout consent capture constants (Issue 089). Single source of truth for consent text version and Vietnamese copy shown at checkout. Two consents per booking: `no_refund` and `pii_storage`.

| Export | Kind | Description |
|--------|------|-------------|
| `CONSENT_VERSION` | const string | `'2026-06-01'` -- bump when CONSENT_TEXT copy changes |
| `CONSENT_TYPES` | const object | `{ noRefund: 'no_refund', piiStorage: 'pii_storage' }` |
| `ConsentType` | type | `'no_refund' \| 'pii_storage'` |
| `CONSENT_TEXT` | const object | `{ noRefund: '...' (VN), piiStorage: '...' (VN) }` |

---

### ticketPdf.tsx

**Path:** `lib/booking/ticketPdf.tsx`
**Purpose:** Server-side PDF ticket generation (Issue 009 story 17; QR added Issue 074). Renders an A5 page with booking ref, passenger name, ticket count, route, departure, operator contact, total, and a boarding QR code. Node-only (`@react-pdf/renderer` pulls in Node streams).

| Export | Kind | Description |
|--------|------|-------------|
| `renderTicketPdf` | async function | `(booking: CustomerBookingDetail, confirmationToken: string) => Promise<Buffer>` |

**Key behaviors:**
- QR encodes the Issue-071 tamper-evident lookup token (`{ ref, ct }` only, no PII).
- QR rendered natively via `@react-pdf/renderer` `<Svg>/<Rect>` primitives (one `<Rect>` per black module -- no raster image embedded).
- Dates formatted in `Asia/Ho_Chi_Minh` timezone.
- `confirmationToken` passed explicitly because `CustomerBookingDetail` deliberately omits it.

---

### touchLastViewed.ts

**Path:** `lib/booking/touchLastViewed.ts`
**Purpose:** Updates `OperatorUser.lastBookingsViewedAt` to now (Issue 014 AC7). Called when operator loads the booking queue page. Badge count resets relative to this timestamp.

| Export | Kind | Description |
|--------|------|-------------|
| `touchLastViewed` | async function | `(operatorUserId: string) => Promise<void>` |

---

### resolveBookingTripId.ts

**Path:** `lib/booking/resolveBookingTripId.ts`
**Purpose:** Resolves a booking ID to its tripId, tenant-scoped (Issue 073). Used by check-in/no-show routes' `requireOperatorAuth` staffTripScope option (Issue 018 pattern).

| Export | Kind | Description |
|--------|------|-------------|
| `resolveBookingTripId` | async function | `(operatorId: string, bookingId: string) => Promise<string \| null>` |

Returns `null` when booking is missing or belongs to a different operator.

---

### pickupSelection.ts

**Path:** `lib/booking/pickupSelection.ts`
**Purpose:** Pure validator for a traveler's pickup choice (Issue 107). Used both client-side (CustomerForm UX) and server-side (POST /api/holds).

| Export | Kind | Description |
|--------|------|-------------|
| `CUSTOM_PICKUP_MIN_DETAIL` | const number | `5` -- minimum trimmed chars for custom pickup detail |
| `PickupSelection` | interface | `{ kind: 'station' \| 'point' \| 'custom', areaId?, detail? }` |
| `PickupCheck` | type | Discriminated union: success variants per kind or `{ ok: false, code }` |
| `validatePickupSelection` | function | `(tripAreaIds: readonly string[], sel: PickupSelection) => PickupCheck` |

**Validation rules:**

| Kind | Rules |
|------|-------|
| `station` | Always valid; no detail required |
| `point` | `areaId` must be in `tripAreaIds`; detail is optional note |
| `custom` | No areaId; detail REQUIRED with minimum 5 trimmed chars |

**Error codes:** `pickup_area_invalid`, `pickup_custom_detail_required`.

---

## Test Files

| Test File | Type | Covers |
|-----------|------|--------|
| `__tests__/bookingRef.test.ts` | Unit | `generateBookingRef`, `BOOKING_REF_REGEX` |
| `__tests__/confirmationToken.test.ts` | Unit | `generateConfirmationToken`, `CONFIRMATION_TOKEN_REGEX` |
| `__tests__/transitions.test.ts` | Unit | `LEGAL_BOOKING_TRANSITIONS`, `isLegalTransition`, `legalPredecessors` |
| `__tests__/attachGuestBookingByPhone.test.ts` | Unit | `attachGuestBookingByPhone`, phone normalization |
| `__tests__/bookingDetailSelect.test.ts` | Unit | `bookingDetailSelect` shape assertions |
| `__tests__/checkIn.test.ts` | Unit | `scanTicket`, `checkInBooking`, `markNoShow` |
| `__tests__/getCustomerBookingDetail.test.ts` | Unit | `getCustomerBookingDetail` |
| `__tests__/initiateMomoBooking.test.ts` | Unit | `initiateMomoBooking` orchestration |
| `__tests__/listCustomerBookings.test.ts` | Unit | `listCustomerBookings` tab/pagination logic |
| `__tests__/ticketPdf.test.ts` | Unit | `renderTicketPdf` |
| `__tests__/pickupSelection.test.ts` | Unit | `validatePickupSelection` |
| `__tests__/bookingRepo.int.test.ts` | Integration | `createOnlineBookingFromHold`, `getBookingByConfirmationToken` |
| `__tests__/checkIn.int.test.ts` | Integration | `checkInBooking`, `markNoShow` against live DB |
| `__tests__/operatorBookingQueue.int.test.ts` | Integration | `listOperatorBookings` with serviceDate/timezone |

---

## Dependency Graph

```
initiateOnlineBooking.ts
  -> bookingRepo.ts (createOnlineBookingFromHold, getBookingByHoldId)
  -> attachGuestBooking.ts
  -> lib/payment (getGatewayFor, PaymentGateway)
  -> lib/onboarding (isBookable)
  -> lib/core/db/client (prisma)

initiateMomoBooking.ts
  -> initiateOnlineBooking.ts
  -> consent.ts (CONSENT_VERSION)

bookingRepo.ts
  -> bookingRef.ts (generateBookingRef)
  -> confirmationToken.ts (generateConfirmationToken)
  -> consent.ts (CONSENT_TYPES)
  -> bookingSelects.ts (bookingDetailSelect)
  -> lib/core/db/client (prisma)

checkIn.ts
  -> lib/ticketing (verifyTicketToken)

ticketPdf.tsx
  -> lib/ticketing (ticketQrMatrix, mintTicketToken)
  -> getCustomerBookingDetail.ts (CustomerBookingDetail type)

getManifest.ts
  -> lib/core/db (withOperatorScope)

attachGuestBookingByPhone.ts
  -> lib/core/validation/phone (normalizePhone)
  -> lib/logger

toBookingDto.ts -> bookingDto.ts
toBookingQueueRow.ts -> bookingDto.ts
getOperatorBooking.ts -> toBookingDto.ts, bookingDto.ts
getBookingDetailPage.ts -> getOperatorBooking.ts
listOperatorBookings.ts -> toBookingQueueRow.ts
```

---

## Cross-Domain Usage

| Consumer Domain | What It Imports |
|----------------|----------------|
| `app/api/bookings/` | `initiateOnlineBooking`, `getBookingByConfirmationToken`, `CONSENT_VERSION` |
| `app/api/payments/` | `legalPredecessors` (webhook transition guard) |
| `app/api/op/bookings/` | `listOperatorBookings`, `getOperatorBooking`, `getManifest`, `checkInBooking`, `markNoShow`, `scanTicket`, `touchLastViewed`, `getUnviewedPaidCount` |
| `app/api/customer/bookings/` | `listCustomerBookings`, `getCustomerBookingDetail` |
| `app/booking/review/` | `getHoldDetails` |
| `app/op/(console)/bookings/` | `getBookingDetailPage` |
| `lib/auth/` (register) | `backfillGuestBookingsForCustomer` |
| `lib/ticketing/` | `renderTicketPdf` (ticket generation job) |
| `lib/payment/` | `legalPredecessors`, `BookingDto` |
