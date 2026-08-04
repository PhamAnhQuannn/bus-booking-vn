# 16 -- Small lib/ Utility Domains

Covers every `lib/` domain **not** documented in files 06--15. Each section: overview, exports table, barrel re-exports, and test inventory.

---

## Table of Contents

1. [lib/api/](#1-libapi)
2. [lib/analytics/](#2-libanalytics)
3. [lib/audit/](#3-libaudit)
4. [lib/account/](#4-libaccount)
5. [lib/einvoice/](#5-libeinvoice)
6. [lib/flags/](#6-libflags)
7. [lib/format/](#7-libformat)
8. [lib/geo/](#8-libgeo)
9. [lib/home/](#9-libhome)
10. [lib/observability/](#10-libobservability)
11. [lib/places/](#11-libplaces)
12. [lib/ratelimit/](#12-libratelimit)
13. [lib/reports/](#13-libreports)
14. [lib/search/](#14-libsearch)
15. [lib/security/](#15-libsecurity)
16. [lib/seo/](#16-libseo)
17. [lib/state/](#17-libstate)
18. [lib/stores/](#18-libstores)
19. [lib/storage/](#19-libstorage)
20. [lib/text/](#20-libtext)

---

## 1. lib/api/

Client-side `fetch` wrappers for the operator and customer API surface. Every non-GET wrapper sends `X-CSRF-Token` via `readCsrfToken()` (from `lib/auth/csrfClient`) so `proxy.ts` admits the request through the CSRF double-submit gate. All wrappers use `credentials: 'same-origin'`. On failure, non-GET wrappers throw `Object.assign(new Error(label), { status, data })` so callers can map `data.error` to a localized message.

**Barrel:** `lib/api/index.ts`

### holdsClient.ts -- Customer Hold Creation

| Export | Kind | Signature | Description |
|--------|------|-----------|-------------|
| `HoldRequestBody` | interface | `{ tripId, ticketCount, buyerName, buyerPhone, buyerEmail, pickupKind?, pickupAreaId?, pickupDetail? }` | POST body for `/api/holds` |
| `HoldSuccess` | interface | `{ ok: true, holdId, expiresAt }` | Successful hold response |
| `HoldError` | interface | `{ ok: false, code: 'SOLD_OUT'\|'TOO_MANY_REQUESTS'\|'INVALID'\|'PICKUP_INVALID'\|'NETWORK_ERROR', retryAfter? }` | Error result |
| `HoldResult` | type | `HoldSuccess \| HoldError` | Discriminated union |
| `createHoldRequest` | function | `(body: HoldRequestBody) => Promise<HoldResult>` | POST `/api/holds`; maps 200/409/429/422 to typed results |

### bookingsClient.ts -- Operator Booking Queue

| Export | Kind | Signature | Description |
|--------|------|-----------|-------------|
| `ListBookingsParams` | interface | `{ busId?, serviceDate?, routeId?, contactStatus?, cursor? }` | Query params |
| `ListBookingsResult` | interface | `{ rows: BookingQueueRow[], nextCursor }` | Paginated result |
| `listBookingsApi` | function | `(params?) => Promise<ListBookingsResult>` | GET `/api/op/bookings` (no CSRF, safe method) |

### tripsClient.ts -- Operator Trip + Template Management

| Export | Kind | Signature | Description |
|--------|------|-----------|-------------|
| `listTripsApi` | function | `(params?) => Promise<{ trips: TripDto[] }>` | GET `/api/op/trips` with optional routeId/date/status filters |
| `createTripApi` | function | `(body) => Promise<{ trip: TripDto }>` | POST `/api/op/trips` |
| `getTripApi` | function | `(id) => Promise<{ trip: TripDto }>` | GET `/api/op/trips/[id]` (not re-exported via barrel) |
| `patchTripApi` | function | `(id, body) => Promise<{ trip: TripDto }>` | PATCH `/api/op/trips/[id]` (not re-exported via barrel) |
| `setTripPickupAreasApi` | function | `(id, pickupAreaIds) => Promise<{ areas }>` | PATCH `/api/op/trips/[id]/pickup-areas` |
| `reassignBusApi` | function | `(id, busId) => Promise<{ trip: TripDto }>` | POST `/api/op/trips/[id]/reassign-bus` |
| `cancelTripApi` | function | `(id, reason) => Promise<{ ok, cancelledBookings, cancelledHolds, notificationsEnqueued }>` | POST `/api/op/trips/[id]/cancel` |
| `salesToggleApi` | function | `(id, salesClosed) => Promise<{ trip: TripDto }>` | POST `/api/op/trips/[id]/sales-toggle` |
| `departTripApi` | function | `(id) => Promise<{ ok, alreadyDeparted, trip }>` | POST `/api/op/trips/[id]/depart` |
| `completeTripApi` | function | `(id) => Promise<{ ok, alreadyCompleted, trip, payoutJobsEnqueued }>` | POST `/api/op/trips/[id]/complete` |
| `listTemplatesApi` | function | `() => Promise<{ templates: TemplateDto[] }>` | GET `/api/op/trip-templates` (not re-exported via barrel) |
| `getTemplateApi` | function | `(id) => Promise<{ template: TemplateDto }>` | GET `/api/op/trip-templates/[id]` (not re-exported via barrel) |
| `createTemplateApi` | function | `(body) => Promise<{ template: TemplateDto }>` | POST `/api/op/trip-templates` |
| `patchTemplateApi` | function | `(id, body) => Promise<{ template: TemplateDto }>` | PATCH `/api/op/trip-templates/[id]` |

### busesClient.ts -- Operator Fleet Management (Issue 011)

| Export | Kind | Signature | Description |
|--------|------|-----------|-------------|
| `MaintenanceWindow` | interface | `{ id, startAt, endAt, reason }` | Maintenance window shape |
| `listBusesApi` | function | `(activeOnly?) => Promise<{ buses: OperatorBusListItem[] }>` | GET `/api/op/buses` |
| `getBusApi` | function | `(id) => Promise<{ bus: OperatorBusListItem & { maintenances } }>` | GET `/api/op/buses/[id]` |
| `createBusApi` | function | `(body) => Promise<{ bus }>` | POST `/api/op/buses` |
| `patchCapacityApi` | function | `(id, capacity) => Promise<{ bus }>` | PATCH `/api/op/buses/[id]` |
| `deactivateBusApi` | function | `(id) => Promise<{ ok }>` | POST `/api/op/buses/[id]/deactivate` |
| `addMaintenanceApi` | function | `(id, body) => Promise<{ maintenance, conflictingTrips? }>` | POST `/api/op/buses/[id]/maintenance` |
| `deleteMaintenanceApi` | function | `(id, mid) => Promise<{ ok }>` | DELETE `/api/op/buses/[id]/maintenance/[mid]` |

### staffClient.ts -- Operator Staff Management (Issue 017)

| Export | Kind | Signature | Description |
|--------|------|-----------|-------------|
| `listStaffApi` | function | `() => Promise<{ staff: StaffDto[] }>` | GET `/api/op/staff` |
| `createStaffApi` | function | `(body) => Promise<{ staff }>` | POST `/api/op/staff` |
| `renameStaffApi` | function | `(staffId, name) => Promise<{ staff }>` | PATCH `/api/op/staff/[id]` |
| `disableStaffApi` | function | `(staffId) => Promise<{ staff }>` | POST `/api/op/staff/[id]/disable` |
| `assignServiceApi` | function | `(staffId, tripId) => Promise<{ staff }>` | POST `/api/op/staff/[id]/assign-service` |

### reportsClient.ts -- Operator Payout Reports

| Export | Kind | Signature | Description |
|--------|------|-----------|-------------|
| `listPayoutsApi` | function | `() => Promise<{ rows: PayoutReportRow[] }>` | GET `/api/op/reports/payouts` (not re-exported via barrel) |
| `retryPayoutApi` | function | `(payoutId) => Promise<{ ok }>` | POST `/api/op/reports/payouts/[id]/retry` |

### routesClient.ts -- Operator Route Management (Issue 012)

| Export | Kind | Signature | Description |
|--------|------|-----------|-------------|
| `RouteItem` | interface | `{ id, operatorId, origin, destination, durationMinutes, deactivatedAt, createdAt, updatedAt }` | Route shape |
| `listRoutesApi` | function | `() => Promise<{ routes: RouteItem[] }>` | GET `/api/op/routes` |
| `createRouteApi` | function | `(body) => Promise<{ route }>` | POST `/api/op/routes` |
| `patchRouteApi` | function | `(id, body) => Promise<{ route }>` | PATCH `/api/op/routes/[id]` |
| `deactivateRouteApi` | function | `(id) => Promise<{ route }>` | POST `/api/op/routes/[id]/deactivate` |
| `getRoutePickupAreasApi` | function | `(id) => Promise<{ areas: PickupAreaItem[] }>` | GET `/api/op/routes/[id]/pickup-areas` (Issue 113) |
| `setRoutePickupAreasApi` | function | `(id, areaIds) => Promise<{ areas }>` | PUT `/api/op/routes/[id]/pickup-areas` |

### pickupAreasClient.ts -- Operator Pickup Area Management (Issue 105)

| Export | Kind | Signature | Description |
|--------|------|-----------|-------------|
| `PickupAreaItem` | interface | `{ id, provinceCode, districtCode, districtName, wardCode, wardName, name, addressLine, label, kind, isActive, displayOrder }` | Area shape; `kind` is `'station'\|'pickup'` (Issue 110) |
| `listPickupAreasApi` | function | `() => Promise<{ areas: PickupAreaItem[] }>` | GET `/api/op/pickup-areas` |
| `createPickupAreaApi` | function | `(body) => Promise<{ area }>` | POST `/api/op/pickup-areas` |
| `updatePickupAreaApi` | function | `(id, body) => Promise<{ area }>` | PATCH `/api/op/pickup-areas/[id]` |
| `deactivatePickupAreaApi` | function | `(id) => Promise<{ area }>` | POST `/api/op/pickup-areas/[id]/deactivate` |

**Tests:** `__tests__/holdsClient.test.ts`, `__tests__/csrfWrappers.test.ts`

---

## 2. lib/analytics/

Platform-wide conversion-funnel analytics. Fire-and-forget event logging (never throws, never blocks request path) and date-windowed aggregate queries for the admin overview dashboard.

**Barrel:** `lib/analytics/index.ts` -- re-exports `getAdminMetrics`, `track`, `sessionIdFromRequest`, `sessionIdForBooking`.

### track.ts -- Funnel Event Logging

| Export | Kind | Signature | Description |
|--------|------|-----------|-------------|
| `FUNNEL_STEPS` | const | `['search_performed', 'hold_created', 'payment_initiated', 'booking_paid'] as const` | Ordered funnel step names |
| `FunnelStep` | type | Union of `FUNNEL_STEPS` entries | Step discriminant |
| `TrackInput` | interface | `{ sessionId, tripId?, bookingId?, context? }` | Event input; skips write when `sessionId` is absent |
| `sessionIdFromRequest` | function | `(req) => string \| null` | Read `bb_sid` cookie from a request |
| `sessionIdForBooking` | function | `(bookingId) => Promise<string \| null>` | Resolve session that initiated a booking (for webhook correlation) |
| `track` | function | `(step, input) => Promise<void>` | Fire-and-forget insert into `FunnelEvent` table |

### getAdminMetrics.ts -- Admin Overview KPIs

| Export | Kind | Signature | Description |
|--------|------|-----------|-------------|
| `AdminMetrics` | interface | `{ customers, operators: { total, approved }, bookings, gmvVnd, revenueVnd, funnel }` | Full admin metrics shape |
| `GetAdminMetricsInput` | interface | `{ dateFrom, dateTo }` (YYYY-MM-DD) | Date window input |
| `getAdminMetrics` | function | `(input, prisma?) => Promise<AdminMetrics>` | Aggregates customers, operators, paid bookings, GMV (SQL SUM), platform revenue (BigInt domain), and funnel |

### getFunnel.ts -- Funnel Step Aggregation

| Export | Kind | Signature | Description |
|--------|------|-----------|-------------|
| `FunnelStepResult` | interface | `{ step, label, sessions, conversionPct, dropPct }` | Per-step result with Vietnamese labels |
| `GetFunnelInput` | interface | `{ dateFrom, dateTo }` | Date window |
| `getFunnel` | function | `(input) => Promise<FunnelStepResult[]>` | Distinct-session counts per funnel step with conversion and drop-off rates |

**Tests:** `__tests__/getAdminMetrics.test.ts`

---

## 3. lib/audit/

Append-only audit trail for platform-admin write actions and PII redaction utilities. The Prisma client is taken as a parameter (reuse-by-param) so the module works under the node-only CLI without importing the app's singleton.

**Barrel:** `lib/audit/index.ts` -- re-exports `writeAdminAuditLog`, `AdminAuditLogClient`, `redactPhone`.

### adminAuditLog.ts

| Export | Kind | Signature | Description |
|--------|------|-----------|-------------|
| `AdminAuditLogClient` | interface | `{ adminAuditLog: { create } }` | Minimal Prisma surface for DI |
| `AdminAuditLogInput` | interface | `{ actor, action, target, argsRedacted? }` | Audit entry input |
| `writeAdminAuditLog` | function | `(prisma, input) => Promise<void>` | Append one audit row |

### redactPhone.ts

| Export | Kind | Signature | Description |
|--------|------|-----------|-------------|
| `redactPhone` | function | `(phone: string) => string` | Mask phone keeping last 4 digits, replacing preceding digits with `x`. Example: `+84901234567` -> `+xxxxxxx4567`. Uses `x` mask to escape `.gitleaks.toml` PII regex. |

**Tests:** `__tests__/adminAuditImmutability.int.test.ts` (integration)

---

## 4. lib/account/

Customer self-service account management: password change/reset, phone change, display name update, account deletion (soft-delete + anonymize), and OTP utilities with lockout. All functions enforce soft-delete (`deletedAt IS NULL`) and revoke sessions on credential changes.

**Barrel:** `lib/account/index.ts` -- re-exports `deleteAccount`, `GUEST_PII_RETENTION_DAYS`, `KYB_DOC_RETENTION_DAYS`, `changePassword`, `ChangePasswordError`, `changePhone`, `ChangePhoneError`, `sendCustomerAccountOtp`, `verifyCustomerAccountOtp`, `forgotPassword`, `resetPassword`, `ResetPasswordError`, `updateName`, `UpdateNameError`.

### anonymizeCustomer.ts -- Account Deletion (Issue 008 AC5, Issue 090 AC4)

| Export | Kind | Signature | Description |
|--------|------|-----------|-------------|
| `DeleteAccountResult` | interface | `{ customer: { id, deletedAt, anonymizedAt, phone }, alreadyDeleted }` | Discriminated result for idempotent 200 |
| `deleteAccount` | function | `(customerId) => Promise<DeleteAccountResult>` | Soft-delete + anonymize: NULLs phone, revokes sessions, scrubs buyer PII snapshots on bookings (buyerName/buyerPhone/buyerEmail), stamps `snapshotAnonymizedAt`. Financial columns retained (S04). |

### changePassword.ts -- Password Change (Issue 008 AC2)

| Export | Kind | Signature | Description |
|--------|------|-----------|-------------|
| `ChangePasswordErrorCode` | type | `'CURRENT_PASSWORD_WRONG' \| 'PASSWORD_REUSED' \| 'CUSTOMER_NOT_FOUND'` | Error codes |
| `ChangePasswordError` | class | `extends Error { code }` | Tagged error |
| `changePassword` | function | `(customerId, currentPassword, newPassword) => Promise<void>` | Verify current, reject reuse, hash new, revoke all sessions in `$transaction` |

### changePhone.ts -- Phone Change (Issue 008 AC3)

| Export | Kind | Signature | Description |
|--------|------|-----------|-------------|
| `ChangePhoneErrorCode` | type | `'PHONE_TAKEN' \| 'CUSTOMER_NOT_FOUND'` | Error codes |
| `ChangePhoneError` | class | `extends Error { code }` | Tagged error |
| `ChangePhoneResult` | interface | `{ id, phone }` | Result |
| `changePhone` | function | `(customerId, rawNewPhone) => Promise<ChangePhoneResult>` | `SELECT ... FOR UPDATE` in `$transaction`; P2002 -> `PHONE_TAKEN` (non-enumerating) |

### forgotPassword.ts -- Forgot Password (Issue 008 AC1)

| Export | Kind | Signature | Description |
|--------|------|-----------|-------------|
| `ForgotPasswordResult` | interface | `{ ok: true, retryAfter? }` | Always `ok: true` to prevent phone enumeration |
| `forgotPassword` | function | `(rawPhone) => Promise<ForgotPasswordResult>` | Sends OTP if customer exists; dummy delay if not (timing safety) |

### resetPassword.ts -- OTP-Based Reset (Issue 008 AC1)

| Export | Kind | Signature | Description |
|--------|------|-----------|-------------|
| `ResetPasswordErrorCode` | type | `'INVALID_PROOF' \| 'CUSTOMER_NOT_FOUND' \| 'PASSWORD_REUSED'` | Error codes |
| `ResetPasswordError` | class | `extends Error { code }` | Tagged error |
| `resetPassword` | function | `(otpProof, newPassword) => Promise<void>` | Verify `reset_password` OTP proof JWT, reject reuse, hash, revoke sessions |

### updateName.ts -- Display Name Update (Issue 008 AC4)

| Export | Kind | Signature | Description |
|--------|------|-----------|-------------|
| `UpdateNameErrorCode` | type | `'DISPLAY_NAME_TOO_SHORT' \| 'DISPLAY_NAME_TOO_LONG' \| 'CUSTOMER_NOT_FOUND'` | Error codes |
| `UpdateNameError` | class | `extends Error { code }` | Tagged error |
| `UpdateNameResult` | interface | `{ id, displayName }` | Result |
| `updateName` | function | `(customerId, rawName) => Promise<UpdateNameResult>` | Validates via `validateDisplayName`, then updates |

### validateDisplayName.ts -- Name Validation

| Export | Kind | Signature | Description |
|--------|------|-----------|-------------|
| `DISPLAY_NAME_MIN` | const | `4` | Min grapheme clusters |
| `DISPLAY_NAME_MAX` | const | `100` | Max grapheme clusters |
| `DisplayNameError` | type | `'TOO_SHORT' \| 'TOO_LONG'` | Error discriminant |
| `validateDisplayName` | function | `(name) => DisplayNameError \| null` | `Intl.Segmenter`-based grapheme count validation |
| `graphemeLength` | function | `(s) => number` | Count Unicode grapheme clusters in a string |

### customerOtp.ts -- Account OTP with Lockout (Issue 008)

| Export | Kind | Signature | Description |
|--------|------|-----------|-------------|
| `MAX_VERIFY_FAILURES` | const | `3` | Failures before lockout |
| `LOCKOUT_WINDOW_MS` | const | `900000` (15 min) | Lockout duration |
| `findCustomerLockoutSentinel` | function | `(phone) => Promise<{ expiresAt } \| null>` | Query OtpAttempt for active lockout sentinel (consumed=true, attemptCount>=3, expiresAt>NOW) |
| `SendCustomerOtpResult` | type | `{ ok: true } \| { ok: false, reason, retryAfter }` | Send result |
| `sendCustomerAccountOtp` | function | `(rawPhone) => Promise<SendCustomerOtpResult>` | Send OTP; lockout check -> rate-limit check (3/15min) -> ON CONFLICT supersede -> SMS send |
| `VerifyCustomerOtpResult` | interface | `{ status: 'ok'\|'mismatch'\|'gone'\|'attempt_cap'\|'locked_out', otpId? }` | Verify result |
| `verifyCustomerAccountOtp` | function | `(rawPhone, plainCode) => Promise<VerifyCustomerOtpResult>` | Atomic verify with timing-safe compare; 3rd failure writes lockout sentinel (extends `expiresAt` to now+15min) |

### retentionPolicy.ts -- Retention Windows (Issue 090)

| Export | Kind | Signature | Description |
|--------|------|-----------|-------------|
| `GUEST_PII_RETENTION_DAYS` | const | `365` | Guest buyer PII snapshot retention (1 year post-departure) |
| `KYB_DOC_RETENTION_DAYS` | const | `90` | KYB document storage retention (90 days post-rejection/deactivation) |

**Tests:** `__tests__/validateDisplayName.test.ts`, `__tests__/anonymizeCustomer.int.test.ts`, `__tests__/changePassword.int.test.ts`, `__tests__/changePhone.int.test.ts`, `__tests__/forgotPassword.int.test.ts`, `__tests__/lockout.int.test.ts`

---

## 5. lib/einvoice/

Vietnamese e-invoice issuance (Circular 78/2021). Follows the `*_STUB` pattern: `EINVOICE_ENABLED=stub` (default) logs and returns a fake invoice number; `EINVOICE_ENABLED=misa` calls the MISA meInvoice REST API.

**Barrel:** `lib/einvoice/index.ts` -- re-exports `getEInvoiceProvider`, `_resetEInvoiceProvider`, `issueInvoice`, `InvoiceRequest`, `InvoiceResult`, `EInvoiceProvider`.

### types.ts

| Export | Kind | Signature | Description |
|--------|------|-----------|-------------|
| `InvoiceRequest` | interface | `{ bookingId, operatorId, buyerName, buyerEmail?, buyerTaxCode?, amount, description }` | Input to issue an invoice |
| `InvoiceResult` | interface | `{ ok, invoiceNumber?, vendorRef?, error? }` | Result |
| `EInvoiceProvider` | interface | `{ issueInvoice(req) }` | Provider contract |

### misaClient.ts

| Export | Kind | Signature | Description |
|--------|------|-----------|-------------|
| `getEInvoiceProvider` | function | `() => EInvoiceProvider` | Lazy singleton; returns `MisaStubProvider` or `MisaRealProvider` based on `EINVOICE_ENABLED` env |
| `_resetEInvoiceProvider` | function | `() => void` | Test helper: reset the singleton |

### issueInvoice.ts

| Export | Kind | Signature | Description |
|--------|------|-----------|-------------|
| `issueInvoice` | function | `(req: InvoiceRequest) => Promise<InvoiceResult>` | High-level orchestrator: gets provider, issues invoice |

**Tests:** None.

---

## 6. lib/flags/

DB-backed feature-flag store with in-process TTL cache (Issue 060). Resolution order: env override (`FEATURE_*`) -> cached DB row -> default. Used for payment-rail toggles and kill-switches only. NOT for env `*_STUB` infra toggles or FeeConfig.

**Barrel:** `lib/flags/index.ts` -- re-exports `getFlag`, `getFlagValue`, `setFlag`, `envKey`, `__clearFlagCache`, `FLAG_CACHE_TTL_MS`, `FeatureFlagReader`, `FeatureFlagWriter`, `FLAG_KEYS`, `FlagKey`.

### flags.ts

| Export | Kind | Signature | Description |
|--------|------|-----------|-------------|
| `FLAG_CACHE_TTL_MS` | const | `30000` (30s) | In-process cache TTL |
| `FeatureFlagReader` | interface | `{ featureFlag: { findUnique } }` | Minimal Prisma surface for reads |
| `FeatureFlagWriter` | interface | `{ $transaction }` | Minimal Prisma surface for writes |
| `envKey` | function | `(key: string) => string` | Translate flag key to env variable name. `rail.momo.enabled` -> `FEATURE_RAIL_MOMO_ENABLED` |
| `getFlag` | function | `(key, opts?, client?) => Promise<boolean>` | Resolve boolean flag: env override -> DB cached -> default |
| `getFlagValue` | function | `(key, client?) => Promise<string \| null>` | Resolve optional structured `value` (DB only, no env override for value) |
| `setFlag` | function | `(client, input) => Promise<void>` | Upsert flag + audit log in one transaction; invalidates cache entry |
| `__clearFlagCache` | function | `() => void` | Test helper: clear entire flag cache |

### keys.ts

| Export | Kind | Signature | Description |
|--------|------|-----------|-------------|
| `FLAG_KEYS` | const object | `{ RAIL_MOMO_ENABLED, RAIL_ZALOPAY_ENABLED, RAIL_CARD_ENABLED, KILLSWITCH_BOOKING, KILLSWITCH_SEARCH }` | Known flag key constants (compile-time safety) |
| `FlagKey` | type | Union of `FLAG_KEYS` values | e.g. `'rail.momo.enabled' \| 'killswitch.booking' \| ...` |

**Tests:** `__tests__/flags.test.ts`

---

## 7. lib/format/

Pure, client-safe currency formatters. No server-only dependencies -- safe to import from `'use client'` components.

**Barrel:** `lib/format/index.ts` -- re-exports `formatVnd`.

### vnd.ts

| Export | Kind | Signature | Description |
|--------|------|-----------|-------------|
| `formatVnd` | function | `(v: number) => string` | Format integer VND amount using `vi-VN` locale. Example: `250000` -> `"250.000 ₫"` |

**Tests:** None.

---

## 8. lib/geo/

Vietnam 3-tier administrative unit lookup (Province -> District -> Ward). Loads a vendored ~690 KB JSON dataset at module init; O(1) lookups via pre-built `Map` indexes. **Server-side only** -- must NOT be imported from `'use client'` components (would bloat the browser bundle). Client code uses GET `/api/geo` instead.

**Barrel:** `lib/geo/index.ts` -- re-exports `listProvinces`, `listDistricts`, `listWards`, `getProvince`, `getDistrict`, `getWard`, `isValidSelection`, `resolveLabel`, `Province`, `District`, `Ward`, `AreaSelection`.

### vnAdmin.ts

| Export | Kind | Signature | Description |
|--------|------|-----------|-------------|
| `Province` | interface | `{ code, name }` | Province shape |
| `District` | interface | `{ code, name, provinceCode }` | District shape |
| `Ward` | interface | `{ code, name, districtCode }` | Ward shape |
| `AreaSelection` | interface | `{ provinceCode, districtCode, wardCode }` | Code triple |
| `listProvinces` | function | `() => Province[]` | All 63 provinces in dataset order |
| `listDistricts` | function | `(provinceCode) => District[]` | Districts in a province |
| `listWards` | function | `(districtCode) => Ward[]` | Wards in a district |
| `getProvince` | function | `(code) => Province \| null` | Single province lookup |
| `getDistrict` | function | `(code) => District \| null` | Single district lookup |
| `getWard` | function | `(code) => Ward \| null` | Single ward lookup |
| `isValidSelection` | function | `(sel: AreaSelection) => boolean` | Validate code triple consistency (ward in district in province) |
| `resolveLabel` | function | `(sel: AreaSelection) => string \| null` | Resolve to human label: `"Phuong X, Quan Y, Thanh pho Z"` |

**Tests:** `__tests__/vnAdmin.test.ts`

---

## 9. lib/home/

Home-page trust-strip metrics. Three independent live counts in one round-trip. The UI threshold-gates each number (shows qualitative copy below a floor) so the page never claims scale it doesn't have.

**Barrel:** `lib/home/index.ts` -- re-exports `getHomeMetrics`, `HomeMetrics`.

### getHomeMetrics.ts

| Export | Kind | Signature | Description |
|--------|------|-----------|-------------|
| `HomeMetrics` | interface | `{ operators, routes, trips }` | Scale metric shape |
| `getHomeMetrics` | function | `() => Promise<HomeMetrics>` | Count search-visible operators (APPROVED, not disabled), active non-moderated routes, and upcoming scheduled sales-open trips |

**Tests:** None.

---

## 10. lib/observability/

Request-id correlation and error-reporting abstraction. Sentry SDK is deferred (not installed); the seam ships now with a structured-logger fallback sink. Both `captureException` and `captureMessage` are synchronous, non-throwing, and PII-scrub all context before emit.

**Barrel:** `lib/observability/index.ts` -- re-exports `captureException`, `captureMessage`, `scrubPii`, `REQUEST_ID_HEADER`, `getOrCreateRequestId`, `loggerForRequest`.

### requestId.ts -- Request-ID Correlation (Issue 061 AC2/AC3)

| Export | Kind | Signature | Description |
|--------|------|-----------|-------------|
| `REQUEST_ID_HEADER` | const | `'x-request-id'` | Canonical correlation header |
| `getOrCreateRequestId` | function | `(headers: Headers) => string` | Read inbound `x-request-id` or mint a fresh UUID via `crypto.randomUUID()` |
| `loggerForRequest` | function | `(requestId) => Logger` | Pino child logger bound to `{ requestId }` |

### sentry.ts -- Error Reporting Abstraction (Issue 061 AC4/AC5)

| Export | Kind | Signature | Description |
|--------|------|-----------|-------------|
| `scrubPii` | function | `(value, seen?) => unknown` | Deep-clone value replacing sensitive keys with `[REDACTED]`. Cycle-safe (WeakSet). Matches pino redact list keys (30+ keys including phone, password, otpProof, cookie, etc.) |
| `captureException` | function | `(err, context?) => void` | Report exception; PII-scrubbed; SENTRY_DSN set -> forward sink (deferred), unset -> logger fallback. Never throws. |
| `captureMessage` | function | `(message, context?) => void` | Report message; PII-scrubbed. Same sink logic. Never throws. |

**Tests:** `__tests__/requestId.test.ts`, `__tests__/sentry.test.ts`

---

## 11. lib/places/

Global canonical place registry for bookable locations. Places are NOT tenant-scoped -- `"Ha Noi"` is the same place regardless of operator. Used by search-form typeahead and route creation.

**Barrel:** `lib/places/index.ts` -- re-exports `resolveOrCreatePlace`, `listSearchablePlaces`, `ResolvedPlace`, `getSearchablePlaces`.

### placeRepo.ts

| Export | Kind | Signature | Description |
|--------|------|-----------|-------------|
| `ResolvedPlace` | interface | `{ id, canonicalName }` | Resolved place |
| `resolveOrCreatePlace` | function | `(name) => Promise<ResolvedPlace>` | Case-insensitive match on `canonicalName` or `aliases[]`; creates new Place if no match. Tolerates race-condition duplicates (non-unique `canonicalName`). |
| `listSearchablePlaces` | function | `() => Promise<string[]>` | All searchable strings: `canonicalName UNION aliases`, distinct, sorted ASC. Feeds typeahead datalist. |

### getSearchablePlaces.ts

| Export | Kind | Signature | Description |
|--------|------|-----------|-------------|
| `getSearchablePlaces` | function | `() => Promise<string[]>` | Thin wrapper over `listSearchablePlaces()`. Signature unchanged from pre-Issue-044 for backward compatibility. |

**Tests:** `__tests__/placeRepo.test.ts`

---

## 12. lib/ratelimit/

Ratelimit factory with three backend implementations. Selection by `REDIS_PROVIDER` env var: `ioredis` -> self-hosted Redis (TCP, Lua sliding window), `upstash` -> Upstash REST, default -> in-memory Map. Fail-open on Redis connection errors (rate-limiting must not break requests).

**Barrel:** `lib/ratelimit/index.ts` (single file, barrel IS the implementation).

### index.ts

| Export | Kind | Signature | Description |
|--------|------|-----------|-------------|
| `RatelimitResult` | interface | `{ allowed, remaining, retryAfter }` | Limit check result |
| `Ratelimit` | interface | `{ limit(identifier) }` | Provider contract |
| `InMemoryRatelimitOptions` | interface | `{ limit, windowMs }` | Configuration |
| `InMemoryRatelimit` | class | implements `Ratelimit` | Map-based, single-process, for dev/CI |
| `UpstashRatelimit` | class | implements `Ratelimit` | `@upstash/ratelimit` sliding window via HTTP REST. Lazy-imports SDK. |
| `IoRedisRatelimit` | class | implements `Ratelimit` | ioredis TCP + atomic Lua `INCR`-first script. Fail-open on error, auto-reconnect. |
| `createRatelimit` | function | `(options) => Ratelimit` | Factory: selects backend by `REDIS_PROVIDER` env |

**Named limiter instances:**

| Export | Limit | Window | Key Pattern | Purpose |
|--------|-------|--------|-------------|---------|
| `ratelimit` | 60/min | 60s | (default) | Default shared 60 req/min/IP |
| `opForgotPasswordRatelimit` | 3/15min | 15min | per phone | Operator forgot-password OTP send (Issue 010) |
| `opRegisterRatelimit` | 5/hr | 60min | `op-register:<ip>` | Self-serve operator registration abuse guard (Issue 076) |
| `charterRatelimit` | 5/hr | 60min | `charter:<ip>` | Public charter request submit (Issue 082) |
| `adminTotpRatelimit` | 10/min | 60s | `admin-totp:<adminId>` | Admin TOTP verify throttle (Issue 055) |
| `adminTotpLockout` | 5/15min | 15min | `admin-totp-fail:<adminId>` | Admin TOTP consecutive-failure lockout (Issue 055) |
| `opLoginRatelimit` | 10/min | 60s | `op-login:<ip>` | Operator login per-IP throttle |
| `opLoginLockout` | 5/15min | 15min | `op-login-fail:<username>` | Operator login consecutive-failure lockout |

**Tests:** `__tests__/factory.test.ts`

---

## 13. lib/reports/

Operator-facing reporting aggregations: per-bus performance and headline KPIs. All queries are tenant-isolated by `operatorId`. Date windows use VN timezone (`Asia/Ho_Chi_Minh`, UTC+7).

**Barrel:** `lib/reports/index.ts` -- re-exports `getBusPerformance`, `getOperatorKpis`.

### getBusPerformance.ts -- Per-Bus Metrics

| Export | Kind | Signature | Description |
|--------|------|-----------|-------------|
| `BusPerformanceRow` | interface | `{ busId, licensePlate, busType, capacity, tripsCount, seatsSold, capacityTotal, grossRevenueVnd, occupancyPct }` | Per-bus row |
| `GetBusPerformanceInput` | interface | `{ operatorId, dateFrom, dateTo }` | Input |
| `getBusPerformance` | function | `(input) => Promise<BusPerformanceRow[]>` | Single raw-SQL aggregation: Bus LEFT JOIN Trip LEFT JOIN Booking. Groups by bus, sums paid booking tickets + totals. Includes idle buses (LEFT JOIN). Ordered by revenue DESC. |

### getOperatorKpis.ts -- Dashboard Headline KPIs

| Export | Kind | Signature | Description |
|--------|------|-----------|-------------|
| `OperatorKpis` | interface | `{ periodTrips, seatsSold, grossRevenueVnd, netPayoutVnd, capacityTotal, occupancyPct, totalBookings, paidBookings, paidRatePct, statusBreakdown, dailyRevenue, revenueDeltaPct }` | Full KPI shape |
| `GetOperatorKpisInput` | interface | `{ operatorId, dateFrom, dateTo }` | Input |
| `getOperatorKpis` | function | `(input) => Promise<OperatorKpis>` | Reuses `getRevenueReport` from `lib/ledger`; adds booking-status breakdown, capacity/occupancy, daily revenue sparkline array, and period-over-period revenue delta % |

**Tests:** None.

---

## 14. lib/search/

Pure, in-memory trip filter/sort/facet layer and search URL builder. No DB access -- operates on results already fetched by `searchTrips`. Client-safe.

**Barrel:** `lib/search/index.ts` -- re-exports `applyTripFilters`, `TripFacets`, `searchHref`.

### applyTripFilters.ts

| Export | Kind | Signature | Description |
|--------|------|-----------|-------------|
| `vnHour` | function | `(iso: string) => number` | Hour (0-23) of an ISO instant in `Asia/Ho_Chi_Minh` wall-clock |
| `windowOf` | function | `(hour: number) => TimeWindow` | Map hour to time-window bucket: morning (5-10), afternoon (11-16), evening (17-21), night (22-4) |
| `TripFacets` | interface | `{ operators, busTypes, windows, priceRange, durationRange }` | Facet options derived from base set |
| `FilteredTrips` | interface | `{ trips, facets, totalBeforeFilters }` | Result shape |
| `applyTripFilters` | function | `(base: TripResult[], filters: SearchFilters) => FilteredTrips` | Filter by operator/busType/price/duration/window, sort by departure/price/duration, compute facets from unfiltered base |

### searchHref.ts

| Export | Kind | Signature | Description |
|--------|------|-----------|-------------|
| `todayVN` | function | `() => string` | Today as `YYYY-MM-DD` in `Asia/Ho_Chi_Minh` via `Intl.DateTimeFormat('en-CA', ...)` |
| `searchHref` | function | `(origin, destination) => string` | Build `/search?origin=...&destination=...&date=today&ticketCount=1` URL |

**Tests:** `__tests__/applyTripFilters.test.ts`

---

## 15. lib/security/

HMAC-SHA256 signed cookie utilities for the `bb_hold` seat-hold cookie.

**Barrel:** `lib/security/index.ts` -- re-exports `buildSetCookieHeader`, `extractHoldCookie`, `verifyCookieValue`.

### holdCookie.ts

| Export | Kind | Signature | Description |
|--------|------|-----------|-------------|
| `COOKIE_NAME` | const | `'bb_hold'` | Cookie name |
| `COOKIE_MAX_AGE` | const | `720` (12 min) | Max-Age in seconds, matches hold TTL |
| `buildCookieValue` | function | `(holdId, expiresAtISO) => string` | Serialize signed value: `<holdId>.<expiresAtISO>.<base64url(HMAC)>` (not re-exported via barrel) |
| `buildSetCookieHeader` | function | `(holdId, expiresAtISO) => string` | Full `Set-Cookie` header string with HttpOnly, SameSite=Lax, Secure (prod only) |
| `VerifiedHold` | interface | `{ holdId, expiresAtISO }` | Verified result |
| `verifyCookieValue` | function | `(cookieValue) => VerifiedHold \| null` | Parse and verify with `crypto.timingSafeEqual`; returns null on any failure |
| `extractHoldCookie` | function | `(cookieHeader) => VerifiedHold \| null` | Extract `bb_hold` from a Cookie header string, verify, and return |

**Tests:** `__tests__/holdCookie.test.ts`, `__tests__/responseShape.test.ts`, `__tests__/tenantIsolation.int.test.ts`; helper: `__tests__/forbiddenFields.ts`

---

## 16. lib/seo/

Canonical site origin and JSON-LD structured-data builders for SEO. Pure + client-safe (no server-only dependencies). `SITE_URL` is the single source for the public origin.

**Barrel:** `lib/seo/index.ts` (single file, barrel IS the implementation).

### index.ts

| Export | Kind | Signature | Description |
|--------|------|-----------|-------------|
| `SITE_URL` | const | `process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3001'` | Canonical site origin; drives `metadataBase`, `robots.ts`, `sitemap.ts`, JSON-LD URLs |
| `organizationLd` | function | `() => object` | `schema.org/Organization` JSON-LD (name: `BBVN`, url, logo) |
| `busTripLd` | function | `(t) => object` | `schema.org/BusTrip` + `Offer` JSON-LD for public trip pages |
| `breadcrumbLd` | function | `(items) => object` | `schema.org/BreadcrumbList` JSON-LD from `{name, url}[]` |

**Tests:** None.

---

## 17. lib/state/

Client-side Zustand stores for the customer booking funnel. `'use client'` only.

**Barrel:** `lib/state/index.ts` -- re-exports `useBookingStore`, `useHoldTimerStore`.

### bookingStore.ts

| Export | Kind | Signature | Description |
|--------|------|-----------|-------------|
| `BookingState` | interface | `{ tripId, ticketCount, holdId, expiresAt, buyerName, buyerPhone, buyerEmail, setTrip, setHold, setBuyerInfo, clearBooking }` | Full store shape |
| `useBookingStore` | Zustand hook | `create<BookingState>(...)` | In-progress booking state across the funnel; cleared on payment or expiry |

### holdTimerStore.ts

| Export | Kind | Signature | Description |
|--------|------|-----------|-------------|
| `HoldTimerState` | interface | `{ remainingMs, isWarning, isExpired, expiresAtMs, startTimer, stopTimer, _tick }` | Timer store shape |
| `useHoldTimerStore` | Zustand hook | `create<HoldTimerState>(...)` | Countdown for hold expiry; ticks every 1s via `setInterval`; `isWarning` at T-2min; auto-stops at 0 |

**Tests:** `__tests__/bookingStore.test.ts`, `__tests__/holdTimerStore.test.ts`

---

## 18. lib/stores/

Client-side Zustand store for trip search query persistence. Separate from `lib/state/` (which holds booking-funnel state).

**Barrel:** `lib/stores/index.ts` -- re-exports `useSearchStore`, `SearchQuery`.

### searchStore.ts

| Export | Kind | Signature | Description |
|--------|------|-----------|-------------|
| `SearchQuery` | interface | `{ origin, destination, date, ticketCount }` | Search form state shape |
| `useSearchStore` | Zustand hook | `create<SearchStore>()(persist(...))` | localStorage-persisted under key `bbvn-search-query`; `skipHydration: true` for SSR safety; methods: `setOrigin`, `setDestination`, `setDate`, `setTicketCount`, `setQuery`, `reset` |

**Tests:** None.

---

## 19. lib/storage/

Object-storage URL minting layer (Issue 059). Server mints signed PUT/GET URLs; DB stores object keys, never bytes. Branches on `STORAGE_STUB` env: `true` -> HMAC-signed stub URLs pointing at the dev stub-storage route; `false` -> real S3 (NOT YET IMPLEMENTED, throws `StorageError('s3_not_implemented')`). The Prisma client is injected via parameter.

**Barrel:** `lib/storage/index.ts` -- re-exports `createSignedUploadUrl`, `createSignedDownloadUrl`, `putObject`, `deleteObject`, `verifyStubSignature`, `StorageClient`, `StoredObjectRow`, `CreateSignedUploadUrlInput`, `CreateSignedUploadUrlResult`, `CreateSignedDownloadUrlOptions`, `CreateSignedDownloadUrlResult`, `StorageError`, `StorageErrorCode`, `STORAGE_POLICIES`, `PII_PURPOSES`, `isStoragePurpose`, `StoragePurpose`, `StoragePolicy`.

### storage.ts

| Export | Kind | Signature | Description |
|--------|------|-----------|-------------|
| `StoredObjectRow` | interface | `{ id, key, contentType, sizeBytes, purpose, uploadedBy, createdAt }` | DB row shape |
| `StorageClient` | interface | extends `AdminAuditLogClient` + `{ storedObject: { create, findUnique, upsert, deleteMany } }` | Minimal Prisma DI surface |
| `CreateSignedUploadUrlInput` | interface | `{ purpose, contentType, sizeBytes, uploadedBy?, keyHint?, baseUrl? }` | Upload input |
| `CreateSignedUploadUrlResult` | interface | `{ key, uploadUrl, expiresAt }` | Upload result |
| `CreateSignedDownloadUrlOptions` | interface | `{ actor, baseUrl? }` | Download options |
| `CreateSignedDownloadUrlResult` | interface | `{ downloadUrl, expiresAt }` | Download result |
| `createSignedUploadUrl` | function | `(prisma, input) => Promise<CreateSignedUploadUrlResult>` | Validate against per-purpose policy, persist pointer row, mint signed PUT URL (15min TTL) |
| `putObject` | function | `(prisma, key, contentType, bytes) => Promise<void>` | Server-side direct upload (Issue 074); upserts pointer row; stub mode -> in-memory store |
| `deleteObject` | function | `(prisma, key) => Promise<void>` | Delete blob + pointer row (Issue 090 retention purge); idempotent |
| `createSignedDownloadUrl` | function | `(prisma, key, options) => Promise<CreateSignedDownloadUrlResult>` | Mint signed GET URL (5min TTL); PII audit for `kyb_doc` purpose |
| `verifyStubSignature` | function | `(key, method, exp, sig, now?) => boolean` | Constant-time stub URL signature + expiry validation |

### errors.ts

| Export | Kind | Signature | Description |
|--------|------|-----------|-------------|
| `StorageErrorCode` | type | `'invalid_content_type' \| 'too_large' \| 'invalid_purpose' \| 'not_found' \| 's3_not_implemented'` | Error discriminants |
| `StorageError` | class | `extends Error { code: StorageErrorCode }` | Tagged error for route handler mapping |

### types.ts

| Export | Kind | Signature | Description |
|--------|------|-----------|-------------|
| `StoragePurpose` | type | `'kyb_doc' \| 'ticket_pdf'` | Purpose taxonomy |
| `StoragePolicy` | interface | `{ maxBytes, allowedContentTypes }` | Per-purpose upload policy |
| `STORAGE_POLICIES` | const | `{ kyb_doc: { 10MB, [jpeg,png,webp,pdf] }, ticket_pdf: { 5MB, [pdf] } }` | Policy table |
| `PII_PURPOSES` | const Set | `Set(['kyb_doc'])` | Purposes whose downloads require PII access audit (AC5) |
| `isStoragePurpose` | function | `(value) => value is StoragePurpose` | Type guard |

### stubStore.ts

| Export | Kind | Signature | Description |
|--------|------|-----------|-------------|
| `StubBlob` | interface | `{ contentType, bytes: Buffer }` | In-memory blob shape |
| `STUB_BLOBS` | const Map | `Map<string, StubBlob>` | Process-wide stub blob store; pinned to `globalThis` to survive Next.js hot-reload |
| `putStubBlob` | function | `(key, contentType, bytes) => void` | Write blob to shared store |
| `getStubBlob` | function | `(key) => StubBlob \| undefined` | Read blob from shared store |
| `removeStubBlob` | function | `(key) => boolean` | Remove blob (idempotent); returns whether a blob was present |

**Tests:** `__tests__/storage.test.ts`, `__tests__/storage.int.test.ts`

---

## 20. lib/text/

Vietnamese diacritic-insensitive text normalization. Pure functions, safe in any context. Used by command palette search and Vietnamese-text matching paths.

**Barrel:** `lib/text/index.ts` -- re-exports `normalizeVi`, `fuzzyMatchVi`.

### normalize.ts

| Export | Kind | Signature | Description |
|--------|------|-----------|-------------|
| `normalizeVi` | function | `(s: string) => string` | Strip diacritics via NFD decomposition, replace `d/D` for Vietnamese, lowercase, trim. Example: `'Tong quan'` from `'Tong quan'`, `'dat ve'` from `'Dat ve'` |
| `fuzzyMatchVi` | function | `(query, index) => boolean` | Token-prefix match: every whitespace-split token in normalized `query` must appear in `index` |

**Tests:** None.
