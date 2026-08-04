# 03 -- Prisma Schema Reference

Generated from `prisma/schema.prisma` on 2026-06-21.

---

## 1. Generator & Datasource

```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "rhel-openssl-3.0.x"]
}

datasource db {
  provider = "postgresql"
}
```

- **Generator**: `prisma-client-js` with binary targets for local dev (`native`) and production Linux (`rhel-openssl-3.0.x`).
- **Datasource**: PostgreSQL. Connection URL is resolved from env (`DATABASE_URL`).

---

## 2. Enums

| Enum | Values | Purpose |
|------|--------|---------|
| `OperatorStatus` | `PENDING_REVIEW`, `UNDER_REVIEW`, `APPROVED`, `REJECTED`, `SUSPENDED` | Operator approval lifecycle (Issue 045). Only `APPROVED` operators are search-visible/bookable. `SUSPENDED` is the canonical freeze state. |
| `CharterStatus` | `SUBMITTED`, `ADMIN_REVIEW`, `ASSIGNED_DIRECT`, `PUBLISHED`, `ACCEPTED`, `DECLINED`, `REJECTED`, `EXPIRED`, `COMPLETED`, `CANCELLED` | Charter request lifecycle (Issue 081). State machine edges documented in `lib/charter/charterStatus.ts`. Terminal states: `REJECTED`, `COMPLETED`, `CANCELLED`. |
| `TaxClassification` | `company`, `individual_household` | Decree 117/2025 tax classification. `company` = exempt (self-files VAT/PIT); `individual_household` = 4.5% withheld. |
| `BusType` | `coach`, `sleeper`, `limousine` | Vehicle class for fleet management. |
| `TripStatus` | `scheduled`, `departed`, `completed`, `cancelled` | Trip lifecycle state machine. Transitions: scheduled -> departed -> completed; scheduled -> cancelled. |
| `HoldStatus` | `active`, `consumed`, `expired`, `cancelled_trip` | Seat-hold lifecycle. `active` = live hold; `consumed` = converted to booking; `expired` = TTL elapsed; `cancelled_trip` = trip was cancelled. |
| `BookingStatus` | `awaiting_payment`, `paid`, `completed`, `cancelled`, `trip_cancelled`, `no_show`, `payment_failed_expired`, `refunded` | Booking payment + fulfilment lifecycle. `refunded` added Issue 100 for oversold-race refunds. |
| `ContactStatus` | `pending`, `reached`, `no_answer`, `callback` | Operator call-queue management (Issue 014). |
| `PaymentMethod` | `momo`, `zalopay`, `card`, `vnpay` | Supported payment rails. |
| `PickupPlaceKind` | `station`, `pickup` | Classifies an OperatorPickupArea. `station` = bus terminal; `pickup` = door-to-door collection point. |
| `PickupKind` | `station`, `point`, `custom` | How the traveler boards. `station` = at terminal; `point` = personal pickup in a listed area; `custom` = free-text request (operator phones back). |
| `NotificationChannel` | `sms`, `email` | Delivery channel for notifications. |
| `NotificationStatus` | `pending`, `sent`, `failed` | Notification delivery state. |
| `OperatorRole` | `admin`, `staff` | Operator user role within their org. |
| `AdminRole` | `SUPER_ADMIN`, `FINANCE`, `SUPPORT` | Platform admin role. |
| `AdminStatus` | `ACTIVE`, `DISABLED` | Admin account status. |
| `PayoutStatus` | `requested`, `processing`, `paid`, `failed` | Payout disbursement lifecycle. |
| `LedgerEntryType` | `booking_credit`, `platform_fee`, `refund_debit`, `refund_out`, `payout_debit`, `payout_reversal`, `chargeback`, `adjustment`, `tax_withheld` | Double-entry ledger event types (Issue 047). |
| `EInvoiceStatus` | `pending`, `issued`, `sent`, `failed`, `cancelled` | E-invoice (Circular 78/2021) lifecycle. |

---

## 3. Models by Domain

### 3.1 Auth -- Customer

#### Customer

| Field | Type | Nullable | Default | Constraints | Notes |
|-------|------|----------|---------|-------------|-------|
| `id` | String | No | `cuid()` | `@id` | |
| `phone` | String | Yes | -- | `@unique` | Set to NULL on soft-delete/anonymization; PG allows multiple NULLs on unique. |
| `email` | String | Yes | -- | | |
| `passwordHash` | String | Yes | -- | | |
| `displayName` | String | Yes | -- | | |
| `createdAt` | DateTime | No | `now()` | | |
| `updatedAt` | DateTime | No | `@updatedAt` | | |
| `lastLoginAt` | DateTime | Yes | -- | | |
| `deletedAt` | DateTime | Yes | -- | | Soft-delete timestamp (Issue 008). |
| `anonymizedAt` | DateTime | Yes | -- | | Set with `deletedAt` on account deletion. |
| `suspendedAt` | DateTime | Yes | -- | | Admin suspension (Issue 066). Sessions revoked at suspend time. |

**Relations:**
- 1-many -> `Session`
- 1-many -> `Booking`
- 1-many -> `CharterRequest`

**Indices:** None declared in DSL (partial unique `Customer_email_key WHERE email IS NOT NULL` is SQL-only in migration `20260519003311`).

#### Session

| Field | Type | Nullable | Default | Constraints | Notes |
|-------|------|----------|---------|-------------|-------|
| `id` | String | No | `cuid()` | `@id` | |
| `customerId` | String | No | -- | | FK -> Customer |
| `refreshTokenHash` | String | No | -- | `@unique` | |
| `tokenFamily` | String | No | -- | | Refresh-token family for rotation/reuse detection. |
| `rotationCount` | Int | No | `0` | | |
| `expiresAt` | DateTime | No | -- | | |
| `createdAt` | DateTime | No | `now()` | | |
| `revokedAt` | DateTime | Yes | -- | | |

**Relations:** many-1 -> `Customer` (onDelete: Cascade)

**Indices:** `@@index([customerId])`

#### OtpAttempt

| Field | Type | Nullable | Default | Constraints | Notes |
|-------|------|----------|---------|-------------|-------|
| `id` | String | No | `cuid()` | `@id` | |
| `phone` | String | No | -- | | |
| `codeHash` | String | No | -- | | |
| `salt` | String | No | -- | | |
| `expiresAt` | DateTime | No | -- | | Extended past OTP TTL for lockout sentinel (Issue 010). |
| `consumed` | Boolean | No | `false` | | Dual-purpose: OTP consumed OR lockout marker. |
| `consumedAt` | DateTime | Yes | -- | | |
| `attemptCount` | Int | No | `0` | | 3 failed verifications triggers 15-min lockout. |
| `createdAt` | DateTime | No | `now()` | | |
| `ipAddress` | String | Yes | -- | | |

**Relations:** None.

**Indices:** `@@index([phone, createdAt(sort: Desc)])`

SQL-only: partial unique `OtpAttempt_phone_active_key ON (phone) WHERE consumed = false` (migration `20260519003311`).

---

### 3.2 Auth -- Operator

#### OperatorUser

| Field | Type | Nullable | Default | Constraints | Notes |
|-------|------|----------|---------|-------------|-------|
| `id` | String | No | `cuid()` | `@id` | |
| `operatorId` | String | No | -- | | FK -> Operator |
| `username` | String | No | -- | `@unique` | Login key. Format: BRAND_ACRONYM-last4phone (uppercase, diacritics stripped). |
| `phone` | String | No | -- | `@unique` | |
| `contactPhone` | String | No | -- | | |
| `notificationPhone` | String | No | -- | | |
| `passwordHash` | String | No | -- | | |
| `requiresPasswordChange` | Boolean | No | `true` | | First-login gate; encoded in JWT claim for Edge middleware. |
| `displayName` | String | No | -- | | |
| `role` | OperatorRole | No | `admin` | | |
| `disabledAt` | DateTime | Yes | -- | | |
| `createdAt` | DateTime | No | `now()` | | |
| `updatedAt` | DateTime | No | `@updatedAt` | | |
| `lastBookingsViewedAt` | DateTime | Yes | -- | | Badge state for bookings queue (Issue 014). |
| `assignedTripId` | String | Yes | -- | | Staff trip assignment (Issue 017); null for admins. |

**Relations:**
- many-1 -> `Operator`
- many-1 -> `Trip` (via `assignedTripId`, named "StaffAssignment")
- 1-many -> `OperatorSession`

**Indices:** `@@index([createdAt])`, `@@index([operatorId])`, `@@index([assignedTripId])`

**SQL-only CHECK (DROPPED):** `OperatorUser_phones_differ` (`contactPhone <> notificationPhone`) was added in migration `20260519042906` and dropped in `20260520010000` (both phones are the same for a single person).

#### OperatorSession

| Field | Type | Nullable | Default | Constraints | Notes |
|-------|------|----------|---------|-------------|-------|
| `id` | String | No | `cuid()` | `@id` | |
| `operatorUserId` | String | No | -- | | FK -> OperatorUser |
| `refreshTokenHash` | String | No | -- | `@unique` | |
| `tokenFamily` | String | No | -- | | |
| `rotationCount` | Int | No | `0` | | |
| `expiresAt` | DateTime | No | -- | | |
| `createdAt` | DateTime | No | `now()` | | |
| `revokedAt` | DateTime | Yes | -- | | |

**Relations:** many-1 -> `OperatorUser` (onDelete: Cascade)

**Indices:** `@@index([operatorUserId])`

#### OperatorOtpAttempt

| Field | Type | Nullable | Default | Constraints | Notes |
|-------|------|----------|---------|-------------|-------|
| `id` | String | No | `cuid()` | `@id` | |
| `phone` | String | No | -- | | |
| `codeHash` | String | No | -- | | |
| `salt` | String | No | -- | | |
| `expiresAt` | DateTime | No | -- | | |
| `consumed` | Boolean | No | `false` | | |
| `consumedAt` | DateTime | Yes | -- | | |
| `attemptCount` | Int | No | `0` | | |
| `createdAt` | DateTime | No | `now()` | | |
| `ipAddress` | String | Yes | -- | | |

**Relations:** None.

**Indices:** `@@index([phone, createdAt(sort: Desc)])`

---

### 3.3 Auth -- Admin

#### AdminUser

| Field | Type | Nullable | Default | Constraints | Notes |
|-------|------|----------|---------|-------------|-------|
| `id` | String | No | `cuid()` | `@id` | |
| `email` | String | No | -- | `@unique` | |
| `passwordHash` | String | No | -- | | |
| `role` | AdminRole | No | -- | | SUPER_ADMIN / FINANCE / SUPPORT |
| `totpSecret` | String | Yes | -- | | TOTP 2FA secret. |
| `totpEnabledAt` | DateTime | Yes | -- | | |
| `invitedBy` | String | Yes | -- | | Actor ID of the admin who created this account. |
| `status` | AdminStatus | No | `ACTIVE` | | |
| `createdAt` | DateTime | No | `now()` | | |
| `updatedAt` | DateTime | No | `@updatedAt` | | |

**Relations:** 1-many -> `AdminSession`

**Indices:** `@@index([email])`

#### AdminSession

| Field | Type | Nullable | Default | Constraints | Notes |
|-------|------|----------|---------|-------------|-------|
| `id` | String | No | `cuid()` | `@id` | |
| `adminUserId` | String | No | -- | | FK -> AdminUser |
| `refreshTokenHash` | String | No | -- | `@unique` | |
| `tokenFamily` | String | No | -- | | |
| `rotationCount` | Int | No | `0` | | |
| `expiresAt` | DateTime | No | -- | | |
| `createdAt` | DateTime | No | `now()` | | |
| `revokedAt` | DateTime | Yes | -- | | |

**Relations:** many-1 -> `AdminUser` (onDelete: Cascade)

**Indices:** `@@index([adminUserId])`

---

### 3.4 Business -- Operator & Catalog

#### Operator

| Field | Type | Nullable | Default | Constraints | Notes |
|-------|------|----------|---------|-------------|-------|
| `id` | String | No | `cuid()` | `@id` | |
| `legalName` | String | No | -- | | |
| `brandName` | String | Yes | -- | | Public-facing trade name. Drives generated login username. |
| `contactName` | String | Yes | -- | | Application contact person. |
| `address` | String | Yes | -- | | Business address. |
| `routesSummary` | String | Yes | -- | | Free-text route description from application. |
| `provinceCode` | String | Yes | -- | | GSO code for base province (Issue 105). |
| `provinceName` | String | Yes | -- | | Denormalized province name. |
| `contactPhone` | String | No | -- | | |
| `contactEmail` | String | No | -- | | |
| `notificationPhone` | String | Yes | -- | | |
| `status` | OperatorStatus | No | `PENDING_REVIEW` | | Canonical approval state. |
| `rejectionReason` | String | Yes | -- | | Set on status -> REJECTED. |
| `disabledAt` | DateTime | Yes | -- | | Back-compat freeze flag synced from `status`. NOT source of truth. |
| `applicationRef` | String | Yes | `@unique` | | Human-friendly ref (e.g. OP-2026-AB12CD). Null for CLI-provisioned operators. |
| `taxClassification` | TaxClassification | No | `company` | | Decree 117/2025 withholding rate classification. |
| `createdAt` | DateTime | No | `now()` | | |

**Relations:**
- 1-many -> `Bus`, `OperatorUser`, `Route`, `Trip`, `RecurringTripTemplate`, `Payout`, `LedgerEntry`, `FeeConfig`, `KybDocument`, `OperatorPickupArea`, `EInvoice`
- 1-1 -> `PayoutAccount` (optional)
- 1-many -> `CharterRequest` (assigned charters)

**Indices:** `@@index([id])`, `@@index([status])`

#### Bus

| Field | Type | Nullable | Default | Constraints | Notes |
|-------|------|----------|---------|-------------|-------|
| `id` | String | No | `cuid()` | `@id` | |
| `operatorId` | String | No | -- | | FK -> Operator |
| `capacity` | Int | No | -- | | Seat count. |
| `licensePlate` | String | No | -- | | |
| `busType` | BusType | No | -- | | coach / sleeper / limousine |
| `deactivatedAt` | DateTime | Yes | -- | | Soft-deactivation (operator-owned). |
| `maintenanceStart` | DateTime | Yes | -- | | Legacy inline maintenance window. |
| `maintenanceEnd` | DateTime | Yes | -- | | |

**Relations:**
- many-1 -> `Operator`
- 1-many -> `Trip`, `BusMaintenance`, `RecurringTripTemplate`

**Indices:** `@@unique([operatorId, licensePlate])`

SQL-only: partial index `Bus_operatorId_active_idx ON (operatorId) WHERE deactivatedAt IS NULL` (migration `20260519043000`).

#### BusMaintenance

| Field | Type | Nullable | Default | Constraints | Notes |
|-------|------|----------|---------|-------------|-------|
| `id` | String | No | `cuid()` | `@id` | |
| `busId` | String | No | -- | | FK -> Bus |
| `startAt` | DateTime | No | -- | | |
| `endAt` | DateTime | No | -- | | |
| `reason` | String | Yes | -- | | |
| `createdAt` | DateTime | No | `now()` | | |

**Relations:** many-1 -> `Bus` (onDelete: Cascade)

**Indices:** `@@index([busId])`

#### Route

| Field | Type | Nullable | Default | Constraints | Notes |
|-------|------|----------|---------|-------------|-------|
| `id` | String | No | `cuid()` | `@id` | |
| `origin` | String | No | -- | | Free-text origin (back-compat shim). |
| `destination` | String | No | -- | | Free-text destination (back-compat shim). |
| `operatorId` | String | No | -- | | FK -> Operator |
| `durationMinutes` | Int | No | -- | | |
| `deactivatedAt` | DateTime | Yes | -- | | Operator-owned deactivation. |
| `moderatedAt` | DateTime | Yes | -- | | Admin moderation kill switch (Issue 069). |
| `createdAt` | DateTime | No | `now()` | | |
| `updatedAt` | DateTime | No | `@updatedAt` | | |
| `originPlaceId` | String | Yes | -- | | FK -> Place (Issue 044). |
| `destPlaceId` | String | Yes | -- | | FK -> Place (Issue 044). |

**Relations:**
- many-1 -> `Operator` (onDelete: Restrict)
- many-1 -> `Place` (origin, named "RouteOrigin", onDelete: SetNull)
- many-1 -> `Place` (dest, named "RouteDest", onDelete: SetNull)
- 1-many -> `Trip`, `RecurringTripTemplate`, `RoutePickupArea`

**Indices:** `@@index([origin, destination])`, `@@index([operatorId])`, `@@index([originPlaceId, destPlaceId])`

#### Place

| Field | Type | Nullable | Default | Constraints | Notes |
|-------|------|----------|---------|-------------|-------|
| `id` | String | No | `cuid()` | `@id` | |
| `canonicalName` | String | No | -- | | |
| `aliases` | String[] | No | -- | | Array of alias names for search matching. |
| `slug` | String | Yes | -- | `@unique` | URL slug. |
| `createdAt` | DateTime | No | `now()` | | |

**Relations:**
- 1-many -> `Route` (as origin, named "RouteOrigin")
- 1-many -> `Route` (as dest, named "RouteDest")
- 1-many -> `CharterRequest` (named "CharterOrigin")

**Indices:** `@@index([canonicalName])`

#### Trip

| Field | Type | Nullable | Default | Constraints | Notes |
|-------|------|----------|---------|-------------|-------|
| `id` | String | No | `cuid()` | `@id` | |
| `routeId` | String | No | -- | | FK -> Route |
| `busId` | String | No | -- | | FK -> Bus |
| `operatorId` | String | No | -- | | FK -> Operator |
| `departureAt` | DateTime | No | -- | | |
| `price` | Int | No | -- | | Minor units (VND). |
| `status` | TripStatus | No | `scheduled` | | |
| `salesClosed` | Boolean | No | `false` | | Blocks further bookings when true. |
| `blockedSeats` | Int | No | `0` | | |
| `cancelReason` | String | Yes | -- | | |
| `cancelledAt` | DateTime | Yes | -- | | |
| `moderatedAt` | DateTime | Yes | -- | | Admin moderation kill switch (Issue 069). |
| `departedAt` | DateTime | Yes | -- | | Timestamp when operator marked departed (Issue 014). |
| `completedAt` | DateTime | Yes | -- | | Timestamp when operator marked completed (Issue 014). |
| `recurringTemplateId` | String | Yes | -- | | FK -> RecurringTripTemplate; null for one-off trips. |
| `pairedTripId` | String | Yes | -- | | Self-referential FK for paired return trips. |
| `updatedAt` | DateTime | No | `@updatedAt` | | |

**Relations:**
- many-1 -> `Route`, `Bus`, `Operator`
- many-1 -> `RecurringTripTemplate` (optional)
- 1-1 -> `Trip` (self-ref "TripPair" via `pairedTripId`)
- 1-many -> `Trip` (reverse of TripPair, as `pairedByTrip`)
- 1-many -> `Hold`, `Booking`, `RecurringGenerationLog`, `Payout`, `TripPickupArea`
- many-many -> `OperatorUser` (named "StaffAssignment")

**Indices:** `@@index([status, departureAt])`, `@@index([routeId, departureAt])`, `@@index([operatorId])`, `@@index([recurringTemplateId])`, `@@index([pairedTripId])`

SQL-only: partial unique index `(recurringTemplateId, departureAt) WHERE recurringTemplateId IS NOT NULL` prevents duplicate generation.

#### RecurringTripTemplate

| Field | Type | Nullable | Default | Constraints | Notes |
|-------|------|----------|---------|-------------|-------|
| `id` | String | No | `cuid()` | `@id` | |
| `operatorId` | String | No | -- | | FK -> Operator |
| `routeId` | String | No | -- | | FK -> Route |
| `busId` | String | No | -- | | FK -> Bus |
| `price` | Int | No | -- | | Minor units (VND). |
| `departureLocalTime` | String | No | -- | | HH:MM in Asia/Ho_Chi_Minh. |
| `daysOfMask` | Int | No | -- | | Bitmask: Mon=1, Tue=2, Wed=4, Thu=8, Fri=16, Sat=32, Sun=64 (1-127). |
| `validFrom` | DateTime | No | -- | `@db.Date` | |
| `validUntil` | DateTime | No | -- | `@db.Date` | |
| `deactivatedAt` | DateTime | Yes | -- | | |
| `createdAt` | DateTime | No | `now()` | | |
| `updatedAt` | DateTime | No | `@updatedAt` | | |

**Relations:**
- many-1 -> `Operator`, `Route`, `Bus`
- 1-many -> `Trip`, `RecurringGenerationLog`, `TemplatePickupArea`

**Indices:** `@@index([operatorId])`, `@@index([routeId])`, `@@index([busId])`

#### RecurringGenerationLog

| Field | Type | Nullable | Default | Constraints | Notes |
|-------|------|----------|---------|-------------|-------|
| `id` | String | No | `cuid()` | `@id` | |
| `templateId` | String | No | -- | | FK -> RecurringTripTemplate |
| `tripId` | String | Yes | -- | | FK -> Trip (the generated trip, null on skip/fail). |
| `date` | DateTime | No | -- | `@db.Date` | Date being generated (YYYY-MM-DD key). |
| `status` | String | No | `"generated"` | | `'generated'` / `'skipped'` / `'failed'` |
| `skipReason` | String | Yes | -- | | |
| `createdAt` | DateTime | No | `now()` | | |

**Relations:**
- many-1 -> `RecurringTripTemplate` (onDelete: Cascade)
- many-1 -> `Trip` (optional, onDelete: SetNull)

**Indices:** `@@index([templateId])`, `@@index([date])`

---

### 3.5 Booking Models

#### Hold

| Field | Type | Nullable | Default | Constraints | Notes |
|-------|------|----------|---------|-------------|-------|
| `id` | String | No | `cuid()` | `@id` | |
| `tripId` | String | No | -- | | FK -> Trip |
| `ticketCount` | Int | No | -- | | |
| `customerPhone` | String | No | -- | | |
| `customerName` | String | No | -- | | |
| `customerEmail` | String | Yes | -- | | Issue 042: guest snapshot email. |
| `expiresAt` | DateTime | No | -- | | |
| `status` | HoldStatus | No | `active` | | |
| `createdAt` | DateTime | No | `now()` | | |
| `pickupKind` | PickupKind | No | `station` | | Traveler pickup selection (Issue 107). |
| `pickupAreaId` | String | Yes | -- | | FK -> OperatorPickupArea |
| `pickupAreaLabel` | String | Yes | -- | | |
| `pickupDetail` | String | Yes | -- | | Free-text detail for point/custom pickup. |
| `customPickupRequested` | Boolean | No | `false` | | True when pickupKind=custom. Indexed for manifest filtering. |

**Relations:**
- many-1 -> `Trip`
- many-1 -> `OperatorPickupArea` (optional, onDelete: SetNull)
- 1-1 -> `Booking` (optional, reverse side)

**Indices:** `@@index([tripId, status, expiresAt])`, `@@index([expiresAt])`

**SQL-only CHECK** (`Hold_custom_requires_detail`, migration `20260609040000`): when `customPickupRequested` is true, `pickupDetail` must be non-null with >= 5 trimmed chars.

#### Booking

| Field | Type | Nullable | Default | Constraints | Notes |
|-------|------|----------|---------|-------------|-------|
| `id` | String | No | -- | `@id @db.Uuid` | UUID (not CUID). |
| `bookingRef` | String | No | -- | `@unique` | Human-friendly ref (e.g. BB-2026-ab12-cd34). |
| `confirmationToken` | String | No | -- | `@unique` | Single-use confirmation token. |
| `tripId` | String | No | -- | | FK -> Trip |
| `holdId` | String | Yes | -- | `@unique` | FK -> Hold (1-1). |
| `customerId` | String | Yes | -- | | FK -> Customer (null for guest bookings). |
| `buyerName` | String | No | -- | | PII snapshot. |
| `buyerPhone` | String | No | -- | | PII snapshot. |
| `buyerEmail` | String | Yes | -- | | Issue 042: email for ticket delivery. |
| `ticketCount` | Int | No | -- | | |
| `totalVnd` | Int | No | -- | | Minor units (VND). |
| `paymentMethod` | PaymentMethod | No | -- | | |
| `paymentExternalRef` | String | Yes | -- | | PSP transaction reference. |
| `status` | BookingStatus | No | `awaiting_payment` | | |
| `isManual` | Boolean | No | `false` | | |
| `createdAt` | DateTime | No | `now()` | | |
| `contactStatus` | ContactStatus | No | `pending` | | Operator call-queue (Issue 014). |
| `pickupKind` | PickupKind | No | `station` | | Snapshotted from hold (Issue 104/107). |
| `pickupAreaId` | String | Yes | -- | | FK -> OperatorPickupArea |
| `pickupAreaLabel` | String | Yes | -- | | Denormalized snapshot. |
| `pickupDetail` | String | Yes | -- | | Free-text detail (PII -- location). Required >= 5 chars for custom. |
| `customPickupRequested` | Boolean | No | `false` | | True when pickupKind=custom. |
| `pickedUpAt` | DateTime | Yes | -- | | SET-TRUE-ONLY boarding timestamp. |
| `escalationNote` | String | Yes | -- | | Operator escalation note. |
| `escalatedAt` | DateTime | Yes | -- | | |
| `reminderSentAt` | DateTime | Yes | -- | | Issue 019: 24h SMS reminder sent timestamp. |
| `checkedInAt` | DateTime | Yes | -- | | Issue 073: single-use boarding check-in (SET-ONCE via atomic conditional UPDATE). |
| `noShowAt` | DateTime | Yes | -- | | Issue 073: no-show marker. Mutually exclusive with checkedInAt. |
| `ticketPdfKey` | String | Yes | -- | | Issue 074: S3 object key of generated ticket PDF. |
| `ticketPdfGeneratedAt` | DateTime | Yes | -- | | Paired with ticketPdfKey. |
| `snapshotAnonymizedAt` | DateTime | Yes | -- | | Issue 090: PII scrub timestamp. Sweep predicate + idempotency marker. |
| `refundedAt` | DateTime | Yes | -- | `@db.Timestamptz` | Issue 100: oversold-race refund instant. Paired with status='refunded'. |
| `einvoiceRef` | String | Yes | -- | | Circular 78/2021: e-invoice reference. |
| `einvoiceIssuedAt` | DateTime | Yes | -- | `@db.Timestamptz` | |

**Relations:**
- many-1 -> `Trip`
- 1-1 -> `Hold` (optional, onDelete: Restrict)
- many-1 -> `Customer` (optional, onDelete: SetNull)
- many-1 -> `OperatorPickupArea` (optional, onDelete: SetNull)
- 1-many -> `NotificationLog`, `PaymentEvent`, `LedgerEntry`, `EInvoice`, `ConsentRecord`

**Indices:** `@@index([tripId, status])`, `@@index([confirmationToken])`, `@@index([customerId])`, `@@index([tripId, contactStatus])`, `@@index([tripId, pickedUpAt])`, `@@index([tripId, customPickupRequested])`, `@@index([status, reminderSentAt])`, `@@index([buyerPhone])`, `@@index([snapshotAnonymizedAt])`, `@@index([status, refundedAt])`

**SQL-only CHECK** (`Booking_custom_requires_detail`, migration `20260609040000`): when `customPickupRequested` is true, `pickupDetail` must be non-null with >= 5 trimmed chars.

**SQL-only CHECK** (`Booking_einvoice_consistency`, migration `20260616020000`): `einvoiceRef IS NULL` must equal `einvoiceIssuedAt IS NULL` (both set or both null).

**SQL-only partial index** (`Booking_einvoiceRef_idx WHERE einvoiceRef IS NOT NULL`, migration `20260616020000`).

#### ConsentRecord

| Field | Type | Nullable | Default | Constraints | Notes |
|-------|------|----------|---------|-------------|-------|
| `id` | String | No | `cuid()` | `@id` | |
| `bookingId` | String | No | -- | `@db.Uuid` | FK -> Booking |
| `consentType` | String | No | -- | | Documented union: `'no_refund'` / `'pii_storage'`. |
| `version` | String | No | -- | | Consent text version (e.g. `'2026-06-01'`). |
| `consentedAt` | DateTime | No | `now()` | | |

**Relations:** many-1 -> `Booking` (onDelete: Cascade)

**Indices:** `@@index([bookingId])`, `@@index([consentType, version])`

**Append-only:** DB trigger `consent_record_no_update` (BEFORE UPDATE) and `consent_record_no_delete` (BEFORE DELETE) enforce immutability via SQL (migration `20260602220000`). See section 5.

---

### 3.6 Pickup Models

#### OperatorPickupArea

| Field | Type | Nullable | Default | Constraints | Notes |
|-------|------|----------|---------|-------------|-------|
| `id` | String | No | `cuid()` | `@id` | |
| `operatorId` | String | No | -- | | FK -> Operator |
| `provinceCode` | String | No | -- | | GSO code. |
| `districtCode` | String | No | -- | | GSO code. |
| `districtName` | String | No | -- | | |
| `wardCode` | String | No | -- | | GSO code. |
| `wardName` | String | No | -- | | |
| `name` | String | No | -- | | Named point (e.g. "Ben xe My Dinh"). |
| `addressLine` | String | Yes | -- | | Street/landmark. |
| `label` | String | No | -- | | Denormalized ward address for menu display. |
| `kind` | PickupPlaceKind | No | `station` | | `station` (bus terminal) or `pickup` (door-to-door). |
| `isActive` | Boolean | No | `true` | | Deactivate instead of delete (historical bookings keep label). |
| `displayOrder` | Int | No | -- | | |
| `createdAt` | DateTime | No | `now()` | | |
| `updatedAt` | DateTime | No | `@updatedAt` | | |

**Relations:**
- many-1 -> `Operator` (onDelete: Cascade)
- 1-many -> `TripPickupArea`, `TemplatePickupArea`, `RoutePickupArea`, `Hold`, `Booking`

**Indices:** `@@index([operatorId, isActive])`

#### TripPickupArea

| Field | Type | Nullable | Default | Constraints | Notes |
|-------|------|----------|---------|-------------|-------|
| `id` | String | No | `cuid()` | `@id` | |
| `tripId` | String | No | -- | | FK -> Trip |
| `operatorPickupAreaId` | String | No | -- | | FK -> OperatorPickupArea |
| `label` | String | No | -- | | Snapshot (survives later menu edits). |
| `kind` | PickupPlaceKind | No | `pickup` | | Snapshot of area kind. |
| `displayOrder` | Int | No | -- | | |

**Relations:**
- many-1 -> `Trip` (onDelete: Cascade)
- many-1 -> `OperatorPickupArea` (onDelete: Cascade)

**Indices:** `@@unique([tripId, operatorPickupAreaId])`, `@@index([tripId, displayOrder])`

#### TemplatePickupArea

| Field | Type | Nullable | Default | Constraints | Notes |
|-------|------|----------|---------|-------------|-------|
| `id` | String | No | `cuid()` | `@id` | |
| `recurringTemplateId` | String | No | -- | | FK -> RecurringTripTemplate |
| `operatorPickupAreaId` | String | No | -- | | FK -> OperatorPickupArea |
| `label` | String | No | -- | | |
| `kind` | PickupPlaceKind | No | `pickup` | | Snapshot propagated into generated trips. |
| `displayOrder` | Int | No | -- | | |

**Relations:**
- many-1 -> `RecurringTripTemplate` (onDelete: Cascade)
- many-1 -> `OperatorPickupArea` (onDelete: Cascade)

**Indices:** `@@unique([recurringTemplateId, operatorPickupAreaId])`, `@@index([recurringTemplateId, displayOrder])`

#### RoutePickupArea

| Field | Type | Nullable | Default | Constraints | Notes |
|-------|------|----------|---------|-------------|-------|
| `id` | String | No | `cuid()` | `@id` | |
| `routeId` | String | No | -- | | FK -> Route |
| `operatorPickupAreaId` | String | No | -- | | FK -> OperatorPickupArea |
| `displayOrder` | Int | No | -- | | |

**Relations:**
- many-1 -> `Route` (onDelete: Cascade)
- many-1 -> `OperatorPickupArea` (onDelete: Cascade)

**Indices:** `@@unique([routeId, operatorPickupAreaId])`, `@@index([routeId, displayOrder])`

---

### 3.7 Financial Models

#### LedgerEntry

| Field | Type | Nullable | Default | Constraints | Notes |
|-------|------|----------|---------|-------------|-------|
| `id` | String | No | `cuid()` | `@id` | |
| `operatorId` | String | No | -- | | FK -> Operator |
| `bookingId` | String | Yes | -- | `@db.Uuid` | FK -> Booking |
| `payoutId` | String | Yes | -- | | Plain column (NO FK in Prisma; decoupled from Payout model). |
| `type` | LedgerEntryType | No | -- | | Event type driving ledger semantics. |
| `amount` | BigInt | No | -- | | Signed minor units (VND). Positive = credit to operator; negative = debit. |
| `currency` | String | No | `"VND"` | | |
| `sourceEventId` | String | No | -- | `@@unique` | Idempotency key. Duplicate appends are no-ops. |
| `createdAt` | DateTime | No | `now()` | | |

**Relations:**
- many-1 -> `Operator`
- many-1 -> `Booking` (optional, onDelete: Restrict)

**Indices:** `@@unique([sourceEventId])`, `@@index([operatorId])`, `@@index([bookingId])`, `@@index([payoutId])`

**Append-only:** DB triggers enforce immutability. See section 5.

#### FeeConfig

| Field | Type | Nullable | Default | Constraints | Notes |
|-------|------|----------|---------|-------------|-------|
| `id` | String | No | `cuid()` | `@id` | |
| `operatorId` | String | Yes | -- | | NULL = global default; non-null = per-operator override. |
| `ratePpm` | Int | No | -- | | Fee rate in parts-per-million (60000 = 6%). All-BigInt math. |
| `effectiveFrom` | DateTime | No | -- | | |
| `effectiveTo` | DateTime | Yes | -- | | NULL = open-ended (current). |
| `createdBy` | String | Yes | -- | | Actor ID. Nullable for seeded cutover row. |
| `createdAt` | DateTime | No | `now()` | | |

**Relations:** many-1 -> `Operator` (optional, onDelete: Restrict)

**Indices:** `@@index([operatorId, effectiveFrom])`, `@@index([effectiveFrom])`

**Effective-dated + append-audited:** rate changes create a NEW row (optionally closing the prior row's `effectiveTo`), never in-place edits. Resolution: per-operator override -> global default.

#### Payout

| Field | Type | Nullable | Default | Constraints | Notes |
|-------|------|----------|---------|-------------|-------|
| `id` | String | No | `cuid()` | `@id` | |
| `tripId` | String | Yes | -- | | FK -> Trip. Nullable for on-demand WITHDRAWAL payouts (Issue 053). |
| `operatorId` | String | No | -- | | FK -> Operator |
| `gross` | Int | No | -- | | Minor units (VND). |
| `platformFee` | Int | No | -- | | |
| `net` | Int | No | -- | | |
| `taxVat` | Int | No | `0` | | |
| `taxPit` | Int | No | `0` | | |
| `taxTotal` | Int | No | `0` | | |
| `status` | PayoutStatus | No | `requested` | | |
| `scheduledAt` | DateTime | No | -- | | |
| `settledAt` | DateTime | Yes | -- | | |
| `failureReason` | String | Yes | -- | | |
| `createdAt` | DateTime | No | `now()` | | |
| `updatedAt` | DateTime | No | `@updatedAt` | | |

**Relations:**
- many-1 -> `Trip` (optional, onDelete: Restrict)
- many-1 -> `Operator`

**Indices:** `@@index([tripId])`, `@@index([status, scheduledAt])`, `@@index([operatorId, status])`

#### PayoutAccount

| Field | Type | Nullable | Default | Constraints | Notes |
|-------|------|----------|---------|-------------|-------|
| `id` | String | No | `cuid()` | `@id` | |
| `operatorId` | String | No | -- | `@unique` | One payout account per operator. |
| `bankName` | String | No | -- | | |
| `accountNumber` | String | No | -- | | PII -- masked to last 4 on display. |
| `accountHolderName` | String | No | -- | | |
| `verifiedAt` | DateTime | Yes | -- | | Set on verify; RESET to null on any account edit. |
| `verifyMethod` | String | Yes | -- | | `'name_match'` / `'micro_deposit'`. |
| `createdAt` | DateTime | No | `now()` | | |
| `updatedAt` | DateTime | No | `@updatedAt` | | |

**Relations:** 1-1 -> `Operator`

**Indices:** `operatorId @unique` (implicit unique index).

#### EInvoice

| Field | Type | Nullable | Default | Constraints | Notes |
|-------|------|----------|---------|-------------|-------|
| `id` | String | No | `cuid()` | `@id` | |
| `bookingId` | String | No | -- | `@db.Uuid` | FK -> Booking |
| `operatorId` | String | No | -- | | FK -> Operator |
| `invoiceNumber` | String | Yes | -- | | |
| `status` | EInvoiceStatus | No | `pending` | | |
| `vendorRef` | String | Yes | -- | | E-invoice provider reference. |
| `rawResponse` | String | Yes | -- | | |
| `issuedAt` | DateTime | Yes | -- | `@db.Timestamptz` | |
| `createdAt` | DateTime | No | `now()` | | |

**Relations:**
- many-1 -> `Booking` (onDelete: Restrict)
- many-1 -> `Operator` (onDelete: Restrict)

**Indices:** `@@index([bookingId])`, `@@index([operatorId, createdAt])`, `@@index([status])`

**SQL-only partial unique** (`EInvoice_invoiceNumber_key WHERE invoiceNumber IS NOT NULL`, migration `20260616020000`).

#### PaymentEvent

| Field | Type | Nullable | Default | Constraints | Notes |
|-------|------|----------|---------|-------------|-------|
| `id` | String | No | `dbgenerated("gen_random_uuid()")` | `@id @db.Uuid` | |
| `bookingId` | String | No | -- | `@db.Uuid` | FK -> Booking |
| `adapter` | String | No | -- | | PSP adapter name. |
| `providerTxnId` | String | No | -- | | |
| `currency` | String | No | `"VND"` | | |
| `rawBody` | String | No | -- | `@db.Text` | Raw webhook/IPN body. |
| `receivedAt` | DateTime | No | `now()` | | |

**Relations:** many-1 -> `Booking`

**Indices:** `@@unique([adapter, providerTxnId])`, `@@index([bookingId])`

---

### 3.8 Notification Models

#### NotificationLog

| Field | Type | Nullable | Default | Constraints | Notes |
|-------|------|----------|---------|-------------|-------|
| `id` | String | No | `cuid()` | `@id` | |
| `bookingId` | String | Yes | -- | `@db.Uuid` | FK -> Booking |
| `channel` | NotificationChannel | No | `sms` | | |
| `template` | String | No | -- | | Template key. |
| `recipient` | String | No | -- | | Phone or email. |
| `payload` | String | No | -- | | Serialized payload. |
| `status` | NotificationStatus | No | `pending` | | |
| `externalRef` | String | Yes | -- | | Provider message ID. |
| `sentAt` | DateTime | Yes | -- | | |
| `scheduledFor` | DateTime | Yes | -- | | S19 cron dispatch time (e.g. completedAt + 3 days for payout). Top-level indexed column (not in JSON payload). |
| `attemptCount` | Int | No | `0` | | Issue 058: retry count. |
| `nextAttemptAt` | DateTime | Yes | -- | | Exponential backoff. NULL = due now. |
| `lastError` | String | Yes | -- | | Last delivery error (ops debugging). |
| `createdAt` | DateTime | No | `now()` | | |

**Relations:** many-1 -> `Booking` (optional, onDelete: Cascade)

**Indices:** `@@unique([bookingId, template])`, `@@index([bookingId])`, `@@index([template, scheduledFor])`, `@@index([status, nextAttemptAt])`

---

### 3.9 Admin Models

#### AdminAuditLog

| Field | Type | Nullable | Default | Constraints | Notes |
|-------|------|----------|---------|-------------|-------|
| `id` | String | No | `cuid()` | `@id` | |
| `actor` | String | No | -- | | Plain string (OS user / jumpbox identity), not FK. |
| `action` | String | No | -- | | CLI command name. |
| `target` | String | No | -- | | Target entity ID or descriptor. |
| `argsRedacted` | String | Yes | -- | | Command args with phones masked (last 4). |
| `timestamp` | DateTime | No | `now()` | | |

**Relations:** None.

**Indices:** `@@index([timestamp])`, `@@index([action, timestamp])`

**Append-only:** DB triggers enforce immutability. See section 5.

#### FeatureFlag

| Field | Type | Nullable | Default | Constraints | Notes |
|-------|------|----------|---------|-------------|-------|
| `key` | String | No | -- | `@id` | Flag key (e.g. `'rail.momo.enabled'`, `'killswitch.booking'`). Natural PK. |
| `enabled` | Boolean | No | `false` | | |
| `value` | String | Yes | -- | | Optional JSON string for non-boolean flags. |
| `updatedBy` | String | Yes | -- | | Actor ID of last setter. |
| `updatedAt` | DateTime | No | `@updatedAt` | | |

**Relations:** None.

**Indices:** None (PK on `key`).

#### ContentReport

| Field | Type | Nullable | Default | Constraints | Notes |
|-------|------|----------|---------|-------------|-------|
| `id` | String | No | `cuid()` | `@id` | |
| `targetType` | String | No | -- | | `'trip'` / `'route'` / `'operator'`. |
| `targetId` | String | No | -- | | |
| `reason` | String | No | -- | | |
| `reportedBy` | String | Yes | -- | | |
| `status` | String | No | `"open"` | | `'open'` / `'resolved'`. |
| `resolvedBy` | String | Yes | -- | | |
| `resolvedAt` | DateTime | Yes | -- | | |
| `createdAt` | DateTime | No | `now()` | | |

**Relations:** None.

**Indices:** `@@index([status, createdAt])`

#### JobRunLog

| Field | Type | Nullable | Default | Constraints | Notes |
|-------|------|----------|---------|-------------|-------|
| `id` | String | No | `cuid()` | `@id` | |
| `jobName` | String | No | -- | | Cron job identifier. |
| `startedAt` | DateTime | No | -- | | |
| `endedAt` | DateTime | Yes | -- | | |
| `status` | String | No | -- | | `'success'` / `'failed'` / `'skipped_locked'`. |
| `rowsAffected` | Int | No | `0` | | |
| `errorMessage` | String | Yes | -- | | |
| `createdAt` | DateTime | No | `now()` | | |

**Relations:** None.

**Indices:** `@@index([jobName, startedAt])`

---

### 3.10 Other Models

#### FunnelEvent

| Field | Type | Nullable | Default | Constraints | Notes |
|-------|------|----------|---------|-------------|-------|
| `id` | String | No | `cuid()` | `@id` | |
| `sessionId` | String | No | -- | | Random cookie value (no PII). |
| `step` | String | No | -- | | `search_performed` / `hold_created` / `payment_initiated` / `booking_paid`. |
| `tripId` | String | Yes | -- | | |
| `bookingId` | String | Yes | -- | | |
| `context` | Json | Yes | -- | | |
| `createdAt` | DateTime | No | `now()` | | |

**Relations:** None. Written fire-and-forget (never blocks request path).

**Indices:** `@@index([step, createdAt])`, `@@index([sessionId])`

#### StoredObject

| Field | Type | Nullable | Default | Constraints | Notes |
|-------|------|----------|---------|-------------|-------|
| `id` | String | No | `cuid()` | `@id` | |
| `key` | String | No | -- | `@unique` | S3 object key. DB stores KEY, never bytes. |
| `contentType` | String | No | -- | | MIME type. |
| `sizeBytes` | Int | No | -- | | |
| `purpose` | String | No | -- | | Documented union: `'kyb_doc'` / `'ticket_pdf'`. |
| `uploadedBy` | String | Yes | -- | | Actor ID. Nullable for system-generated uploads. |
| `createdAt` | DateTime | No | `now()` | | |

**Relations:** None.

**Indices:** `@@index([purpose])`

#### KybDocument

| Field | Type | Nullable | Default | Constraints | Notes |
|-------|------|----------|---------|-------------|-------|
| `id` | String | No | `cuid()` | `@id` | |
| `operatorId` | String | No | -- | | FK -> Operator |
| `type` | String | No | -- | | `'business_license'` / `'identity'` / `'payout_account'`. |
| `storageKey` | String | No | -- | | S3 object key (via lib/storage). |
| `status` | String | No | `"submitted"` | | `'submitted'` / `'accepted'` / `'rejected'`. |
| `uploadedAt` | DateTime | No | `now()` | | |
| `purgedAt` | DateTime | Yes | -- | | Issue 090: storage object purge timestamp. Sweep predicate. |

**Relations:** many-1 -> `Operator` (onDelete: Restrict)

**Indices:** `@@index([operatorId])`, `@@index([purgedAt])`

#### CharterRequest

| Field | Type | Nullable | Default | Constraints | Notes |
|-------|------|----------|---------|-------------|-------|
| `id` | String | No | `cuid()` | `@id` | |
| `ref` | String | No | -- | `@unique` | Charter-scoped human ref CH-YYYY-XXXXXX. |
| `customerId` | String | Yes | -- | | FK -> Customer (null for guest charters). |
| `contactName` | String | No | -- | | |
| `contactPhone` | String | No | -- | | |
| `contactEmail` | String | No | -- | | |
| `originPlaceId` | String | Yes | -- | | FK -> Place (named "CharterOrigin"). |
| `destinations` | Json | No | -- | | Array of `{ placeId?, name }`. Not FK-enforced. |
| `startDate` | DateTime | No | -- | | |
| `endDate` | DateTime | Yes | -- | | |
| `durationDays` | Int | Yes | -- | | |
| `passengers` | Int | No | -- | | |
| `vehicleType` | String | No | -- | | `'coach'` / `'sleeper'` / `'limousine'` (String, not enum). |
| `budgetVnd` | Int | Yes | -- | | |
| `notes` | String | Yes | -- | | |
| `status` | CharterStatus | No | `SUBMITTED` | | |
| `assigneeOperatorId` | String | Yes | -- | | FK -> Operator. Set on ASSIGNED_DIRECT or ACCEPTED. |
| `publishedAt` | DateTime | Yes | -- | | Set on -> PUBLISHED (public pool). |
| `claimByAt` | DateTime | Yes | -- | | Public-pool claim deadline. |
| `acceptByAt` | DateTime | Yes | -- | | Direct-assign accept deadline. |
| `rejectionReason` | String | Yes | -- | | Set on -> REJECTED. |
| `createdAt` | DateTime | No | `now()` | | |
| `updatedAt` | DateTime | No | `@updatedAt` | | |

**Relations:**
- many-1 -> `Customer` (optional, onDelete: SetNull)
- many-1 -> `Place` (optional, named "CharterOrigin", onDelete: SetNull)
- many-1 -> `Operator` (optional, as assignee, onDelete: SetNull)

**Indices:** `@@index([status, createdAt])`, `@@index([assigneeOperatorId])`, `@@index([status, acceptByAt])`, `@@index([status, claimByAt])`

---

## 4. Soft-Delete Patterns

Several models use nullable `DateTime` columns to implement soft-delete or deactivation instead of physical row removal:

| Model | Column | Semantics |
|-------|--------|-----------|
| `Customer` | `deletedAt` | Soft-delete. Phone set to NULL (releases the unique constraint). Paired with `anonymizedAt`. |
| `Customer` | `anonymizedAt` | PII scrub timestamp. Set together with `deletedAt`. |
| `Customer` | `suspendedAt` | Admin suspension (distinct from deletion). All sessions revoked at suspend time. |
| `Bus` | `deactivatedAt` | Operator-owned fleet deactivation. Partial index `Bus_operatorId_active_idx WHERE deactivatedAt IS NULL`. |
| `Route` | `deactivatedAt` | Operator-owned route deactivation. |
| `Route` | `moderatedAt` | Admin moderation kill switch. Distinct from operator-owned `deactivatedAt`. |
| `Trip` | `moderatedAt` | Admin moderation kill switch. Distinct from operator-owned `salesClosed`. |
| `RecurringTripTemplate` | `deactivatedAt` | Template deactivation (stops future generation). |
| `OperatorUser` | `disabledAt` | Account deactivation. |
| `OperatorPickupArea` | `isActive` (Boolean) | Deactivate instead of delete so historical bookings keep their snapshotted label. |
| `Operator` | `disabledAt` | Back-compat freeze flag. NOT source of truth -- `status` (SUSPENDED) is canonical. |
| `Booking` | `snapshotAnonymizedAt` | PII snapshot scrub (guest buyerName/Phone/Email masked). Money/audit columns retained. |
| `KybDocument` | `purgedAt` | Storage object purge timestamp. Row retained as audit trail; S3 object removed. |

---

## 5. Append-Only / Immutable Patterns

Three models enforce append-only immutability via PostgreSQL triggers (Prisma DSL cannot model triggers):

### LedgerEntry

- **Trigger `ledger_entry_no_update`**: `BEFORE UPDATE ON "LedgerEntry"` -- raises exception, preventing any row modification.
- **Trigger `ledger_entry_no_delete`**: `BEFORE DELETE ON "LedgerEntry"` -- raises exception, preventing any row deletion.
- **Idempotency**: `sourceEventId` is `@@unique`; duplicate appends are no-ops (caught by unique constraint).
- **Sign convention**: positive = credit TO operator balance, negative = debit FROM it.
- **Migration**: `20260602020000_ledger_entry`

### AdminAuditLog

- **Trigger `admin_audit_log_no_update`**: `BEFORE UPDATE ON "AdminAuditLog"` -- raises exception.
- **Trigger `admin_audit_log_no_delete`**: `BEFORE DELETE ON "AdminAuditLog"` -- raises exception.
- **Actor field**: plain string (OS user / jumpbox identity), not an FK. The CLI runs outside the app's auth context.
- **Migration**: `20260602110000_admin_audit_immutable`

### ConsentRecord

- **Trigger `consent_record_no_update`**: `BEFORE UPDATE ON "ConsentRecord"` -- raises exception.
- **Trigger `consent_record_no_delete`** (implied by the migration pattern): BEFORE DELETE -- raises exception.
- **Purpose**: compliance audit trail for checkout consent capture (no-refund + PII storage).
- **Migration**: `20260602220000_consent_record`

### FeeConfig (Effective-Dated Append)

Not trigger-enforced, but the documented convention is **append-only**: a rate change creates a NEW row (optionally closing the prior row's `effectiveTo`), never in-place edits of `ratePpm`. This preserves the full historical rate timeline for audit and payout math.

### FunnelEvent (Convention-Only)

Append-only by convention (no triggers). Written fire-and-forget for conversion analytics.

---

## 6. Key Enums as State Machines

### OperatorStatus (Operator approval lifecycle)

```
PENDING_REVIEW -> UNDER_REVIEW -> APPROVED
                               -> REJECTED
                 APPROVED      -> SUSPENDED
                 SUSPENDED     -> APPROVED (reinstate)
```

Only `APPROVED` operators are search-visible and bookable. `SUSPENDED` is the canonical freeze state (synced to legacy `disabledAt`). Transition map in `lib/operator/` or the operator admin service.

### CharterStatus (Charter request lifecycle)

```
SUBMITTED -> ADMIN_REVIEW -> ASSIGNED_DIRECT -> ACCEPTED -> COMPLETED
                          -> PUBLISHED       -> ACCEPTED -> CANCELLED
                          -> REJECTED (terminal)
          ASSIGNED_DIRECT -> DECLINED -> ADMIN_REVIEW (re-route)
          PUBLISHED       -> EXPIRED  -> ADMIN_REVIEW (re-route)
          ACCEPTED        -> COMPLETED (terminal)
          ACCEPTED        -> CANCELLED (terminal)
```

Transition map in `lib/charter/charterStatus.ts`. Terminal states: REJECTED, COMPLETED, CANCELLED.

### TripStatus (Trip lifecycle)

```
scheduled -> departed -> completed
scheduled -> cancelled
```

Paired timestamp columns (`departedAt`, `completedAt`, `cancelledAt`) must be written in the same `tx.model.update` call as the status transition (Issue 014 rule).

### BookingStatus (Booking payment + fulfilment lifecycle)

```
awaiting_payment -> paid -> completed
                        -> cancelled
                        -> trip_cancelled
                        -> no_show
awaiting_payment -> payment_failed_expired
paid             -> refunded (oversold-race, Issue 100)
```

### HoldStatus (Seat-hold lifecycle)

```
active -> consumed (converted to booking)
active -> expired (TTL elapsed, cron sweeper)
active -> cancelled_trip (trip was cancelled)
```

### PayoutStatus (Payout disbursement lifecycle)

```
requested -> processing -> paid
                        -> failed
```

### NotificationStatus (Notification delivery)

```
pending -> sent
pending -> failed (retry via attemptCount + nextAttemptAt backoff)
```
