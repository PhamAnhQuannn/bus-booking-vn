# 21 - Operator API Routes

Generated: 2026-06-21

All operator API routes live under `/api/op/`. Authentication uses JWT-based operator sessions (`bb_op_access` / `bb_op_refresh` cookies) unless noted otherwise.

**Auth guards:**
- `requireOperatorAuth({})` -- standard operator auth, blocks when `requiresPasswordChange=true`
- `requireOperatorAuth({ adminOnly: true })` -- operator-admin only (staff role gets 403)
- `requireOperatorAuth({ staffTripScope: fn })` -- staff scoped to their assigned trip
- Manual JWT verify via `verifyOperatorAccess` -- used when the route must work during password-change flow
- None -- public endpoints (register, forgot-password, login)

**Note:** Operator login is at `POST /api/auth/login` (shared endpoint, `scope: 'operator'`), not under `/api/op/`.

---

## Auth

Operator login lives at the shared `/api/auth/login` endpoint. The routes below handle session lifecycle and password management.

| Method | Path | Auth | Request | Response (success) | Status Codes | Service Function |
|--------|------|------|---------|-------------------|-------------|-----------------|
| POST | `/api/auth/login` | None (rate-limited) | `{ username, password, scope: 'operator' }` | `{ accessToken, operator, requiresPasswordChange }` + sets `bb_op_access` (15min) + `bb_op_refresh` (30d) cookies | 200, 400, 401, 410, 429 | `operatorLogin` from `@/lib/auth` |
| POST | `/api/op/auth/forgot-password` | None | `{ phone }` | `{ message: 'accepted' }` (anti-enumeration: always 202) | 202, 400, 429 | `sendOperatorPasswordResetOtp` from `@/lib/auth` |
| POST | `/api/op/auth/forgot-password/verify` | None | `{ phone, code }` | `{ otpProof }` (HS256 JWT, 5min TTL) | 200, 400, 429 | `verifyOperatorOtp`, `issueOtpProof` from `@/lib/auth` |
| POST | `/api/op/auth/forgot-password/reset` | OTP proof in body | `{ otpProof, newPassword }` | 204 No Content | 204, 400, 401 | `verifyOtpProof`, `hash` from `@/lib/auth`; `revokeAllOperatorSessions` |
| POST | `/api/op/auth/logout` | Cookie `bb_op_refresh` | None | 204 No Content; clears cookies | 204 | `verifyOpRefreshToken`, `revokeOperatorSession` from `@/lib/auth` |
| POST | `/api/op/auth/refresh` | Cookie `bb_op_refresh` | None | `{ accessToken }` + rotates cookies | 200, 401 | `verifyOpRefreshToken`, `rotateOperatorRefresh` from `@/lib/auth` |
| POST | `/api/op/auth/password/change` | Manual JWT verify (`bb_op_access`) | `{ currentPassword, newPassword }` | 204 No Content; reissues cookies | 204, 400, 401, 409 | `verifyOperatorAccess`, `verify`, `hash`, `issueOperatorSession` from `@/lib/auth` |

**Login status codes detail:**
- 200 -- success
- 400 -- malformed body
- 401 -- `invalid_credentials`
- 410 -- `customer_login_disabled` (non-operator scope; customer login paused)
- 429 -- `RATE_LIMITED` (per-IP) or `LOCKED_OUT` (per-username consecutive failures)

**Refresh 401 variants:** `NO_SESSION`, `INVALID_SESSION`, `SESSION_REUSE` (family revoked)

**Password change 409:** `SAME_AS_OLD` (new password hashes to same value)

---

## Buses

| Method | Path | Auth | Request | Response (success) | Status Codes | Service Function |
|--------|------|------|---------|-------------------|-------------|-----------------|
| GET | `/api/op/buses` | `requireOperatorAuth({})` | Query: `activeOnly` (`'0'`\|`'1'`, default `'1'`) | `{ buses: BusDto[] }` | 200 | `listOperatorBuses` from `@/lib/catalog` |
| POST | `/api/op/buses` | `requireOperatorAuth({})` | `{ licensePlate, capacity, busType }` | `{ bus: BusDto }` | 201, 400, 422 | `createBus` from `@/lib/catalog` |
| GET | `/api/op/buses/[id]` | `requireOperatorAuth({})` | Path: `id` | `{ bus: BusDto }` (includes maintenance windows) | 200, 404 | `getOperatorBus` from `@/lib/catalog` |
| PATCH | `/api/op/buses/[id]` | `requireOperatorAuth({})` | `{ licensePlate?, capacity?, busType? }` | `{ bus }` | 200, 400, 404, 422 | `canReduceCapacity` from `@/lib/catalog`; `prisma.$transaction` with `SELECT ... FOR UPDATE` |
| POST | `/api/op/buses/[id]/deactivate` | `requireOperatorAuth({})` | None | `{ ok: true, deactivatedAt }` | 200, 404, 422 | `deactivateBus` from `@/lib/catalog` |
| POST | `/api/op/buses/[id]/maintenance` | `requireOperatorAuth({})` | `{ startAt, endAt, reason? }` | `{ maintenance, conflictingTrips }` | 201, 400, 404, 409, 422 | `findMaintenanceOverlaps`, `findTripOverlaps` from `@/lib/catalog` |
| DELETE | `/api/op/buses/[id]/maintenance/[mid]` | `requireOperatorAuth({})` | Path: `id`, `mid` | `{ ok: true }` | 200, 404 | Direct Prisma delete |

**PATCH buses/[id] 422 variants:** `plate_in_use`, `reactivation_not_supported`, `capacity_reduction_blocked` (with `violatingTrips`)

**POST buses/[id]/deactivate 422 variants:** `reactivation_not_supported` (already deactivated), `future_trips_assigned` (with `tripIds`)

**POST maintenance 409:** `maintenance_overlap` (hard block, with `overlapping` array). Trip overlaps are soft warnings returned in the 201 body as `conflictingTrips`.

---

## Routes

| Method | Path | Auth | Request | Response (success) | Status Codes | Service Function |
|--------|------|------|---------|-------------------|-------------|-----------------|
| GET | `/api/op/routes` | `requireOperatorAuth({})` | None | `{ routes }` | 200 | `listRoutes` from `@/lib/catalog` |
| POST | `/api/op/routes` | `requireOperatorAuth({})` | Body validated by `routeCreateSchema` | `{ route }` | 201, 400, 422 | `createRoute` from `@/lib/catalog` |
| GET | `/api/op/routes/[id]` | `requireOperatorAuth({})` | Path: `id` | `{ route }` (with pickup points) | 200, 404 | `getRouteById` from `@/lib/catalog` |
| PATCH | `/api/op/routes/[id]` | `requireOperatorAuth({})` | Body validated by `routePatchSchema` | `{ route }` | 200, 400, 404, 422 | `updateRoute` from `@/lib/catalog` |
| POST | `/api/op/routes/[id]/deactivate` | `requireOperatorAuth({})` | None | `{ route }` | 200, 404, 422 | `deactivateRoute` from `@/lib/catalog` |
| GET | `/api/op/routes/[id]/pickup-areas` | `requireOperatorAuth({})` | Path: `id` | `{ areas }` | 200 | `listRoutePickupAreas` from `@/lib/catalog` |
| PUT | `/api/op/routes/[id]/pickup-areas` | `requireOperatorAuth({})` | `{ areaIds: string[] }` (max 100) | `{ areas }` | 200, 400, 404, 422 | `setRoutePickupAreas` from `@/lib/catalog` |

**PATCH routes/[id] 422 variants:** `invalid_input` (zod), `reactivation_not_supported`

**POST routes/[id]/deactivate 422:** `already_deactivated`

**PUT routes/[id]/pickup-areas 422:** `validation_failed` (zod), `invalid_pickup_area` (area not in operator's active set)

---

## Trips

| Method | Path | Auth | Request | Response (success) | Status Codes | Service Function |
|--------|------|------|---------|-------------------|-------------|-----------------|
| GET | `/api/op/trips` | `requireOperatorAuth({})` | Query: `routeId?`, `fromDate?`, `toDate?`, `status?` | `{ trips }` | 200 | `listTrips` from `@/lib/trips` |
| POST | `/api/op/trips` | `requireOperatorAuth({})` | `{ routeId, busId, departureAt, price, blockedSeats?, pickupAreaIds? }` | `{ trip }` | 201, 400, 404, 409, 422 | `createTrip` from `@/lib/trips` |
| GET | `/api/op/trips/upcoming` | `requireOperatorAuth({})` | Query: `routeId?`, `limit?`, `cursor?` | `{ trips, nextCursor? }` | 200, 422 | `listUpcomingForOperator` from `@/lib/trips` |
| GET | `/api/op/trips/[id]` | `requireOperatorAuth({})` | Path: `id` | `{ trip }` | 200, 404 | `getTrip` from `@/lib/trips` |
| PATCH | `/api/op/trips/[id]` | `requireOperatorAuth({})` | `{ price?, salesClosed?, blockedSeats? }` | `{ trip }` | 200, 400, 404, 422 | `prisma.$transaction` with `SELECT ... FOR UPDATE`; `toTripDto` |
| POST | `/api/op/trips/[id]/cancel` | `requireOperatorAuth({})` | `{ reason }` | `{ trip, ok, already_cancelled, cancelledBookings, cancelledHolds, notificationsEnqueued }` | 200, 400, 404, 422 | `cancelTrip` from `@/lib/trips` |
| POST | `/api/op/trips/[id]/depart` | `requireOperatorAuth({ staffTripScope })` | None | `{ ok, alreadyDeparted, trip }` | 200, 404, 422 | `markDeparted` from `@/lib/trips` |
| POST | `/api/op/trips/[id]/complete` | `requireOperatorAuth({ staffTripScope })` | None | `{ ok, alreadyCompleted, trip, payoutJobsEnqueued }` | 200, 404, 422 | `markCompleted` from `@/lib/trips` |
| POST | `/api/op/trips/[id]/sales-toggle` | `requireOperatorAuth({})` | `{ salesClosed: boolean }` | `{ trip }` | 200, 400, 404, 422 | `salesToggle` from `@/lib/trips` |
| POST | `/api/op/trips/[id]/reassign-bus` | `requireOperatorAuth({})` | `{ busId }` | `{ trip }` | 200, 400, 404, 409, 422 | `reassignBus` from `@/lib/trips` |
| PATCH | `/api/op/trips/[id]/pickup-areas` | `requireOperatorAuth({})` | `{ pickupAreaIds: string[] }` (max 50) | `{ areas }` | 200, 400, 404, 422 | `setTripPickupAreas` from `@/lib/trips` |

**POST trips 409:** `bus_overlap`. **POST trips 422 variants:** `validation_failed`, `bus_in_maintenance`, `bus_deactivated`, `invalid_pickup_area`

**PATCH trips/[id] 422 variants:** `validation_failed`, `already_cancelled`, `price_locked_after_sale`

**Cancel is idempotent:** second cancel returns 200 with `already_cancelled: true`

**Depart/complete are idempotent:** re-depart returns `alreadyDeparted: true`, re-complete returns `alreadyCompleted: true`

**Depart 422:** `trip_cancelled`. **Complete 422:** `trip_cancelled`, `trip_not_departed`

**Reassign-bus 409:** `bus_overlap_with_outbound`. **Reassign-bus 422:** `capacity_too_small` (with `required`, `provided`), `bus_deactivated`, `bus_in_maintenance`

---

## Trip Templates

| Method | Path | Auth | Request | Response (success) | Status Codes | Service Function |
|--------|------|------|---------|-------------------|-------------|-----------------|
| GET | `/api/op/trip-templates` | `requireOperatorAuth({})` | None | `{ templates }` | 200 | `listTemplates` from `@/lib/trips` |
| POST | `/api/op/trip-templates` | `requireOperatorAuth({})` | `{ routeId, busId, price, departureLocalTime, daysOfMask, validFrom, validUntil, pickupAreaIds? }` | `{ template }` | 201, 400, 422 | `createTemplate` from `@/lib/trips` |
| GET | `/api/op/trip-templates/[id]` | `requireOperatorAuth({})` | Path: `id` | `{ template }` | 200, 404 | `getTemplate` from `@/lib/trips` |
| PATCH | `/api/op/trip-templates/[id]` | `requireOperatorAuth({})` | `{ price?, departureLocalTime?, daysOfMask?, validFrom?, validUntil?, busId?, deactivatedAt? }` | `{ template }` | 200, 400, 404, 422 | `patchTemplate` from `@/lib/trips` |

**daysOfMask bitmask:** Mon=1, Tue=2, Wed=4, Thu=8, Fri=16, Sat=32, Sun=64 (range 1-127)

**departureLocalTime format:** `HH:MM`

---

## Bookings

| Method | Path | Auth | Request | Response (success) | Status Codes | Service Function |
|--------|------|------|---------|-------------------|-------------|-----------------|
| GET | `/api/op/bookings` | `requireOperatorAuth({})` | Query: `busId?`, `serviceDate?`, `routeId?`, `tripId?`, `contactStatus?`, `limit?` (1-100, default 50), `cursor?` | `{ rows: BookingQueueRow[], nextCursor }` | 200, 404, 422 | `listOperatorBookings` from `@/lib/booking` |
| GET | `/api/op/bookings/[id]` | `requireOperatorAuth({})` | Path: `id` | `{ booking: BookingDto }` | 200, 404 | `getOperatorBooking` from `@/lib/booking` |
| POST | `/api/op/bookings/[id]/check-in` | `requireOperatorAuth({ staffTripScope })` | None | `{ ok: true, alreadyCheckedIn }` | 200, 404 | `checkInBooking` from `@/lib/booking` |
| POST | `/api/op/bookings/[id]/no-show` | `requireOperatorAuth({ staffTripScope })` | None | `{ ok: true }` | 200, 404, 422 | `markNoShow` from `@/lib/booking` |

**BookingQueueRow fields:** `id`, `bookingRef`, `buyerName`, `buyerPhone`, `ticketCount`, `contactStatus`, `pickupAreaLabel`, `paymentStatus`, `departureAt`, `escalatedAt`, `manualFlag`

**contactStatus enum:** `'pending' | 'reached' | 'no_answer' | 'callback'`

**Check-in is idempotent:** second scan returns `alreadyCheckedIn: true`

**No-show 422:** `already_checked_in`

**Staff scoping:** check-in and no-show resolve booking-to-trip via `resolveBookingTripId`, ensuring staff can only act on bookings for their assigned trip.

---

## Manifest

| Method | Path | Auth | Request | Response (success) | Status Codes | Service Function |
|--------|------|------|---------|-------------------|-------------|-----------------|
| GET | `/api/op/manifest/[tripId]` | `requireOperatorAuth({ staffTripScope })` | Path: `tripId` | `{ tripId, rows: ManifestRow[], generatedAt }` | 200, 404 | `getManifest` from `@/lib/booking` |

**ManifestRow fields:** `bookingId`, `bookingRef`, `name`, `phone`, `ticketCount`, `pickupKind`, `pickupAreaLabel`, `pickupDetail`, `customPickupRequested`, `contactStatus`, `paymentStatus`, `pickedUpAt`, `escalatedAt`, `checkedInAt`, `noShowAt`, `manualFlag`

**pickupKind enum:** `'station' | 'point' | 'custom'`

---

## Staff

| Method | Path | Auth | Request | Response (success) | Status Codes | Service Function |
|--------|------|------|---------|-------------------|-------------|-----------------|
| GET | `/api/op/staff` | `requireOperatorAuth({ adminOnly: true })` | None | `{ staff }` | 200 | `listStaff` from `@/lib/staff` |
| POST | `/api/op/staff` | `requireOperatorAuth({ adminOnly: true })` | `{ name, phone }` | `{ staff }` | 201, 400, 409 | `createStaff` from `@/lib/staff` |
| PATCH | `/api/op/staff/[id]` | `requireOperatorAuth({ adminOnly: true })` | `{ name }` | `{ staff }` | 200, 400, 404 | `updateStaff` from `@/lib/staff` |
| POST | `/api/op/staff/[id]/disable` | `requireOperatorAuth({ adminOnly: true })` | None | `{ staff }` (idempotent) | 200, 404 | `disableStaff` from `@/lib/staff` |
| POST | `/api/op/staff/[id]/assign-service` | `requireOperatorAuth({ adminOnly: true })` | `{ tripId }` | `{ staff }` (idempotent, replaces prior assignment) | 200, 400, 404, 422 | `assignService` from `@/lib/staff` |

**POST staff 409:** `phone_in_use`

**Assign-service 404 variants:** `not_found` (staff), `trip_not_found` (trip). **422:** `trip_not_assignable` (cancelled/departed/completed)

---

## Charter

All charter routes require `requireOperatorAuth({})` plus `assertOperatorApproved` (operator must be in APPROVED status).

| Method | Path | Auth | Request | Response (success) | Status Codes | Service Function |
|--------|------|------|---------|-------------------|-------------|-----------------|
| POST | `/api/op/charter/[id]/claim` | Operator auth + approved | None | `{ ok: true }` | 200, 403, 404, 409 | `claimCharter` from `@/lib/charter` |
| POST | `/api/op/charter/[id]/accept` | Operator auth + approved | None | `{ ok: true }` | 200, 403, 404, 422 | `transitionCharterRequest` from `@/lib/charter` |
| POST | `/api/op/charter/[id]/decline` | Operator auth + approved | `{ reason? }` | `{ ok: true, to }` | 200, 403, 404, 422 | `declineCharter` from `@/lib/charter` |

**Claim 409:** `already_claimed`

**Accept/decline 422:** `ILLEGAL_TRANSITION`

**403:** `NOT_APPROVED` (operator not in APPROVED status)

---

## Money

| Method | Path | Auth | Request | Response (success) | Status Codes | Service Function |
|--------|------|------|---------|-------------------|-------------|-----------------|
| POST | `/api/op/money/withdraw` | `requireOperatorAuth({})` | `{ amountMinor }` + header `Idempotency-Key` (optional; UUID generated if absent) | `{ payoutId }` | 200, 400, 422 | `requestWithdrawal` from `@/lib/ledger` |

**422 variants:** `validation_failed` (zod), `below_min`, `insufficient_available`, `invalid_amount`

---

## Reports

| Method | Path | Auth | Request | Response (success) | Status Codes | Service Function |
|--------|------|------|---------|-------------------|-------------|-----------------|
| GET | `/api/op/reports/revenue` | `requireOperatorAuth({})` | Query: `dateFrom` (YYYY-MM-DD), `dateTo` (YYYY-MM-DD), `routeId?` | `{ rows: RevenueRow[] }` | 200, 400 | `getRevenueReport` from `@/lib/ledger` |
| GET | `/api/op/reports/revenue.csv` | `requireOperatorAuth({})` | Query: `dateFrom` (YYYY-MM-DD), `dateTo` (YYYY-MM-DD), `routeId?` | UTF-8 BOM CSV file download | 200, 400 | `getBookingRevenueRows`, `buildBookingRevenueCsv` from `@/lib/ledger` |
| GET | `/api/op/reports/payouts` | `requireOperatorAuth({})` | None | `{ rows: PayoutReportRow[] }` | 200 | `getPayoutReport` from `@/lib/ledger` |
| POST | `/api/op/reports/payouts/[id]/retry` | `requireOperatorAuth({})` | Path: `id` | `{ payout }` | 200, 404, 409 | `retryPayout` from `@/lib/ledger` |

**Revenue 400:** `validation_failed` (zod; `dateFrom <= dateTo` enforced)

**Payout retry 404:** payout not found or cross-operator. **409:** `not_failed` (payout not in failed state)

---

## Profile

| Method | Path | Auth | Request | Response (success) | Status Codes | Service Function |
|--------|------|------|---------|-------------------|-------------|-----------------|
| GET | `/api/op/profile` | Manual JWT verify | None | `{ phone, contactPhone, notificationPhone, displayName, requiresPasswordChange }` | 200, 401, 403 | `verifyOperatorAccess` from `@/lib/auth`; direct Prisma query |
| PATCH | `/api/op/profile` | Manual JWT verify | `{ contactPhone?, notificationPhone?, displayName? }` | 204 No Content | 204, 400, 401, 403, 409 | `verifyOperatorAccess` from `@/lib/auth`; `normalizePhone`; direct Prisma update |

**GET 403:** `PASSWORD_CHANGE_REQUIRED`

**PATCH 400 variants:** `INVALID` (unparseable/empty), `INVALID_PHONE` (normalization failure)

**PATCH 409:** `PHONES_MUST_DIFFER` (contactPhone === notificationPhone)

Profile uses manual JWT verification (not `requireOperatorAuth`) because it must be accessible during the password-change flow. It checks `disabledAt` and `requiresPasswordChange` manually.

---

## Pickup Areas

| Method | Path | Auth | Request | Response (success) | Status Codes | Service Function |
|--------|------|------|---------|-------------------|-------------|-----------------|
| GET | `/api/op/pickup-areas` | `requireOperatorAuth({})` | None | `{ areas }` | 200 | `listOperatorPickupAreas` from `@/lib/catalog` |
| POST | `/api/op/pickup-areas` | `requireOperatorAuth({})` | Body validated by `operatorPickupAreaCreateSchema` | `{ area }` | 201, 400, 422 | `createOperatorPickupArea` from `@/lib/catalog` |
| PATCH | `/api/op/pickup-areas/[id]` | `requireOperatorAuth({})` | Body validated by `operatorPickupAreaUpdateSchema` | `{ area }` | 200, 400, 404, 422 | `updateOperatorPickupArea` from `@/lib/catalog` |
| POST | `/api/op/pickup-areas/[id]/deactivate` | `requireOperatorAuth({})` | None | `{ area }` | 200, 404, 422 | `deactivateOperatorPickupArea` from `@/lib/catalog` |

**POST 422 variants:** `invalid_input` (zod), `invalid_area`, `duplicate_area`

**Deactivate 422:** `already_inactive`

---

## Payout Account

| Method | Path | Auth | Request | Response (success) | Status Codes | Service Function |
|--------|------|------|---------|-------------------|-------------|-----------------|
| GET | `/api/op/payout-account` | `requireOperatorAuth({})` | None | `{ account }` (accountNumber masked to last 4 digits) | 200, 404 | `getPayoutAccount` from `@/lib/onboarding` |
| POST | `/api/op/payout-account` | `requireOperatorAuth({})` | `{ bankName, accountNumber, accountHolderName }` | `{ ok: true }` | 200, 400, 422 | `setPayoutAccount` from `@/lib/onboarding` |

---

## KYB (Know Your Business)

| Method | Path | Auth | Request | Response (success) | Status Codes | Service Function |
|--------|------|------|---------|-------------------|-------------|-----------------|
| POST | `/api/op/kyb/submit` | `requireOperatorAuth({})` | None (operatorId from JWT) | `{ ok: true }` | 200, 404, 422 | `submitForReview` from `@/lib/onboarding` |
| POST | `/api/op/kyb/upload-url` | `requireOperatorAuth({})` | `{ type, contentType, sizeBytes }` | `{ uploadUrl, key, kybDocumentId }` | 200, 400, 422 | `requestKybUploadUrl` from `@/lib/onboarding` |

**KYB submit 422:** `ILLEGAL_TRANSITION` (not in correct state)

**Upload-url `type` enum:** `'business_license' | 'identity' | 'payout_account'`

**Upload-url 422 variants:** `INVALID_TYPE` (KybError), `INVALID_CONTENT_TYPE` (StorageError), `TOO_LARGE` (StorageError)

---

## Registration & Onboarding

| Method | Path | Auth | Request | Response (success) | Status Codes | Service Function |
|--------|------|------|---------|-------------------|-------------|-----------------|
| POST | `/api/op/register` | None (public; rate-limited 5/hr per IP; CSRF required) | `{ brandName, legalName, contactName, contactPhone, contactEmail, address, routesSummary, provinceCode?, provinceName? }` | `{ applicationRef }` | 201, 400, 429 | `registerOperator` from `@/lib/onboarding` |
| POST | `/api/op/resubmit` | `requireOperatorAuth({})` | None (operatorId from JWT) | `{ ok: true }` | 200, 404, 422 | `transitionOperatorStatus` from `@/lib/onboarding` |

**Register 429:** `TOO_MANY_REQUESTS` (with `Retry-After` header)

**Resubmit 422:** `ILLEGAL_TRANSITION` (operator not in REJECTED status). Transitions REJECTED to PENDING_REVIEW.

---

## Activity Feed

| Method | Path | Auth | Request | Response (success) | Status Codes | Service Function |
|--------|------|------|---------|-------------------|-------------|-----------------|
| GET | `/api/op/activity` | `requireOperatorAuth()` | Query: `limit?` (1-100, default 30) | `{ events }` | 200 | `getActivityFeed` from `@/lib/op` |

---

## Scan (Ticket Verification)

| Method | Path | Auth | Request | Response (success) | Status Codes | Service Function |
|--------|------|------|---------|-------------------|-------------|-----------------|
| POST | `/api/op/scan` | `requireOperatorAuth({})` + inline staff-trip-scope check | `{ token }` (signed ticket JWT from passenger QR code) | `{ booking }` (boarding view) | 200, 404, 422 | `scanTicket` from `@/lib/booking` |

**404 variants:** `invalid_token`, `wrong_operator`, staff-trip mismatch (staff can only scan bookings for their assigned trip)

**422 variants:** `validation_failed` (missing/empty token), `not_paid` (booking not in paid status)

---

## Route Count Summary

| Group | Routes | Total Endpoints |
|-------|--------|----------------|
| Auth (incl. shared login) | 7 | 7 POST |
| Buses | 5 | 2 GET, 2 POST, 1 PATCH, 1 DELETE |
| Routes | 5 | 3 GET, 1 POST, 1 PATCH, 1 PUT |
| Trips | 9 | 3 GET, 5 POST, 2 PATCH |
| Trip Templates | 2 | 2 GET, 1 POST, 1 PATCH |
| Bookings | 4 | 2 GET, 2 POST |
| Manifest | 1 | 1 GET |
| Staff | 4 | 1 GET, 1 POST, 1 PATCH, 2 POST |
| Charter | 3 | 3 POST |
| Money | 1 | 1 POST |
| Reports | 4 | 3 GET, 1 POST |
| Profile | 1 | 1 GET, 1 PATCH |
| Pickup Areas | 3 | 1 GET, 2 POST, 1 PATCH |
| Payout Account | 1 | 1 GET, 1 POST |
| KYB | 2 | 2 POST |
| Register/Resubmit | 2 | 2 POST |
| Activity | 1 | 1 GET |
| Scan | 1 | 1 POST |
| **Total** | **56** | |
