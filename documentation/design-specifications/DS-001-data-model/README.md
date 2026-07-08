# DS-001 -- Data Model Design

## 1. Overview

This document is the authoritative data model reference for the BusBooking platform -- a multi-tenant Vietnam bus booking marketplace. The persistence layer is PostgreSQL 16+ accessed via Prisma ORM (Prisma 7.x). All monetary values are stored as VND (Vietnamese Dong) integers with no decimal component: `Int` for per-record amounts (32-bit, max ~2.1 billion VND), `BigInt` for aggregates and signed ledger entries. The schema is partitioned into bounded contexts (Auth, Fleet/Catalog, Booking, Payment, Finance/Ledger, Notification, Admin, Analytics, KYB, Charter, E-Invoice, Feature Flags) with strict tenant isolation via `operatorId` foreign keys on all operator-scoped tables. Global entities (Customer, Place, PaymentEvent, AdminAuditLog, FunnelEvent) are shared across operators.

---

## 2. Entity Catalog

### 2.1 Auth Context -- Customer Realm

#### Customer

| Column | Prisma Type | Nullable | Default | Constraints / Notes |
|--------|-------------|----------|---------|---------------------|
| id | String | No | `@default(cuid())` | Primary key |
| phone | String | Yes | -- | `@unique`. Set to NULL on soft-delete. Partial unique index `Customer_email_key` is on email, not phone; Postgres allows multiple NULLs on `@unique`. Use `findFirst` (not `findUnique`) when filtering with `deletedAt: null`. |
| email | String | Yes | -- | Partial unique index `Customer_email_key` WHERE email IS NOT NULL (SQL-only) |
| passwordHash | String | Yes | -- | Optional; customers may be OTP-only |
| displayName | String | Yes | -- | |
| createdAt | DateTime | No | `@default(now())` | |
| updatedAt | DateTime | No | `@updatedAt` | |
| lastLoginAt | DateTime | Yes | -- | |
| deletedAt | DateTime | Yes | -- | Soft-delete timestamp; non-null = account deleted |
| anonymizedAt | DateTime | Yes | -- | Set together with deletedAt |
| suspendedAt | DateTime | Yes | -- | Admin suspension; non-null = suspended (fails requireCustomerAuth, sessions revoked) |

#### OtpAttempt

| Column | Prisma Type | Nullable | Default | Constraints / Notes |
|--------|-------------|----------|---------|---------------------|
| id | String | No | `@default(cuid())` | Primary key |
| phone | String | No | -- | Partial unique index `OtpAttempt_phone_active_key` WHERE consumed = false (SQL-only) |
| codeHash | String | No | -- | Salted SHA-256 hash of the OTP code |
| salt | String | No | -- | Per-OTP salt |
| expiresAt | DateTime | No | -- | 5-min TTL; extended to 15 min when repurposed as lockout sentinel |
| consumed | Boolean | No | `@default(false)` | |
| consumedAt | DateTime | Yes | -- | |
| attemptCount | Int | No | `@default(0)` | Incremented on each verify mismatch |
| createdAt | DateTime | No | `@default(now())` | |
| ipAddress | String | Yes | -- | Rate-limit correlation |

**Dual semantics:** When `consumed=false AND expiresAt > NOW()` the row is an active OTP. When `consumed=true AND attemptCount >= 3 AND expiresAt > NOW()` it is a lockout sentinel (15-min window).

#### Session

| Column | Prisma Type | Nullable | Default | Constraints / Notes |
|--------|-------------|----------|---------|---------------------|
| id | String | No | `@default(cuid())` | Primary key |
| customerId | String | No | -- | FK -> Customer |
| refreshTokenHash | String | No | -- | `@unique`. SHA-256 hash of the refresh token |
| tokenFamily | String | No | -- | Rotation family ID for reuse detection |
| rotationCount | Int | No | `@default(0)` | |
| expiresAt | DateTime | No | -- | |
| createdAt | DateTime | No | `@default(now())` | |
| revokedAt | DateTime | Yes | -- | |

### 2.2 Auth Context -- Operator Realm

#### OperatorUser

| Column | Prisma Type | Nullable | Default | Constraints / Notes |
|--------|-------------|----------|---------|---------------------|
| id | String | No | `@default(cuid())` | Primary key |
| operatorId | String | No | -- | FK -> Operator |
| username | String | No | -- | `@unique`. Format: BRAND_ACRONYM-last4phone (uppercase, diacritics stripped, collision suffix -N) |
| phone | String | No | -- | `@unique`. Login phone |
| contactPhone | String | No | -- | NOT NULL. Contact phone (may equal phone) |
| notificationPhone | String | No | -- | NOT NULL. Notification phone (may equal phone) |
| passwordHash | String | No | -- | bcrypt |
| requiresPasswordChange | Boolean | No | `@default(true)` | Encoded into JWT claim for Edge middleware gate |
| displayName | String | No | -- | |
| role | OperatorRole | No | `@default(admin)` | admin or staff |
| disabledAt | DateTime | Yes | -- | |
| createdAt | DateTime | No | `@default(now())` | |
| updatedAt | DateTime | No | `@updatedAt` | |
| lastBookingsViewedAt | DateTime | Yes | -- | Badge: last time operator viewed the bookings queue |

**Staff-trip assignment:** V1 `assignedTripId` FK replaced by `StaffTripAssignment` join table (section 2.17). Supports multi-trip assignment with role tagging.

#### OperatorSession

| Column | Prisma Type | Nullable | Default | Constraints / Notes |
|--------|-------------|----------|---------|---------------------|
| id | String | No | `@default(cuid())` | Primary key |
| operatorUserId | String | No | -- | FK -> OperatorUser |
| refreshTokenHash | String | No | -- | `@unique` |
| tokenFamily | String | No | -- | |
| rotationCount | Int | No | `@default(0)` | |
| expiresAt | DateTime | No | -- | |
| createdAt | DateTime | No | `@default(now())` | |
| revokedAt | DateTime | Yes | -- | |

#### OperatorOtpAttempt

| Column | Prisma Type | Nullable | Default | Constraints / Notes |
|--------|-------------|----------|---------|---------------------|
| id | String | No | `@default(cuid())` | Primary key |
| phone | String | No | -- | |
| codeHash | String | No | -- | Salted SHA-256 |
| salt | String | No | -- | |
| expiresAt | DateTime | No | -- | |
| consumed | Boolean | No | `@default(false)` | |
| consumedAt | DateTime | Yes | -- | |
| attemptCount | Int | No | `@default(0)` | |
| createdAt | DateTime | No | `@default(now())` | |
| ipAddress | String | Yes | -- | |

### 2.3 Auth Context -- Admin Realm

#### AdminUser

| Column | Prisma Type | Nullable | Default | Constraints / Notes |
|--------|-------------|----------|---------|---------------------|
| id | String | No | `@default(cuid())` | Primary key |
| email | String | No | -- | `@unique` |
| passwordHash | String | No | -- | |
| role | AdminRole | No | -- | SUPER_ADMIN, FINANCE, or SUPPORT |
| totpSecret | String | Yes | -- | AES-256-GCM encrypted at rest |
| totpEnabledAt | DateTime | Yes | -- | |
| invitedBy | String | Yes | -- | Actor who created the invite |
| status | AdminStatus | No | `@default(ACTIVE)` | ACTIVE or DISABLED (soft-disable, not timestamp-based) |
| createdAt | DateTime | No | `@default(now())` | |
| updatedAt | DateTime | No | `@updatedAt` | |

#### AdminSession

| Column | Prisma Type | Nullable | Default | Constraints / Notes |
|--------|-------------|----------|---------|---------------------|
| id | String | No | `@default(cuid())` | Primary key |
| adminUserId | String | No | -- | FK -> AdminUser |
| refreshTokenHash | String | No | -- | `@unique` |
| tokenFamily | String | No | -- | |
| rotationCount | Int | No | `@default(0)` | |
| expiresAt | DateTime | No | -- | |
| createdAt | DateTime | No | `@default(now())` | |
| revokedAt | DateTime | Yes | -- | |

### 2.4 Fleet / Catalog Context

#### Operator

| Column | Prisma Type | Nullable | Default | Constraints / Notes |
|--------|-------------|----------|---------|---------------------|
| id | String | No | `@default(cuid())` | Primary key |
| legalName | String | No | -- | |
| brandName | String | Yes | -- | Public-facing brand/trade name. Drives username generation. Nullable for pre-2026-06-06 rows |
| contactName | String | Yes | -- | Application contact person |
| address | String | Yes | -- | Business address |
| routesSummary | String | Yes | -- | Free-text summary of routes (e.g. "Ha Noi - Sai Gon") |
| provinceCode | String | Yes | -- | GSO code from lib/geo |
| provinceName | String | Yes | -- | Denormalized province name |
| contactPhone | String | No | -- | |
| contactEmail | String | No | -- | |
| notificationPhone | String | Yes | -- | |
| status | OperatorStatus | No | `@default(PENDING_REVIEW)` | Canonical approval state. Only APPROVED operators are search-visible/bookable |
| rejectionReason | String | Yes | -- | Set when status -> REJECTED |
| disabledAt | DateTime | Yes | -- | Back-compat freeze flag, synced to status. NOT source of truth -- read `status` |
| applicationRef | String | Yes | -- | `@unique`. Human-friendly ref (e.g. OP-2026-AB12CD). Null for CLI-provisioned operators |
| taxClassification | TaxClassification | No | `@default(company)` | Decree 117/2025. company = self-files; individual_household = 4.5% withheld |
| taxCode | String | Yes | -- | MST/Mã Số Thuế. Required for e-invoice issuance. Partial unique index WHERE taxCode IS NOT NULL (see section 5.2) |
| transportLicenseNumber | String | Yes | -- | BGTVT transport license number. Verified during KYB |
| businessRegNumber | String | Yes | -- | Business registration number |
| insurancePolicyRef | String | Yes | -- | Mandatory insurance policy reference |
| createdAt | DateTime | No | `@default(now())` | |

#### Bus

| Column | Prisma Type | Nullable | Default | Constraints / Notes |
|--------|-------------|----------|---------|---------------------|
| id | String | No | `@default(cuid())` | Primary key |
| operatorId | String | No | -- | FK -> Operator. Tenant-scoped |
| capacity | Int | No | -- | Total seat count |
| licensePlate | String | No | -- | `@@unique([operatorId, licensePlate])` -- unique per operator |
| busType | BusType | No | -- | coach, sleeper, or limousine |
| deactivatedAt | DateTime | Yes | -- | Operator deactivation (soft-delete) |
| maintenanceStart | DateTime | Yes | -- | Current/future maintenance window start |
| maintenanceEnd | DateTime | Yes | -- | Current/future maintenance window end |

#### BusMaintenance

| Column | Prisma Type | Nullable | Default | Constraints / Notes |
|--------|-------------|----------|---------|---------------------|
| id | String | No | `@default(cuid())` | Primary key |
| busId | String | No | -- | FK -> Bus (onDelete: Cascade) |
| startAt | DateTime | No | -- | |
| endAt | DateTime | No | -- | |
| reason | String | Yes | -- | |
| createdAt | DateTime | No | `@default(now())` | |

#### Route

| Column | Prisma Type | Nullable | Default | Constraints / Notes |
|--------|-------------|----------|---------|---------------------|
| id | String | No | `@default(cuid())` | Primary key |
| origin | String | No | -- | Free-text origin (back-compat shim). Target: migrate to required originPlaceId and drop. See ADR-011 |
| destination | String | No | -- | Free-text destination (back-compat shim). Target: migrate to required destPlaceId and drop. See ADR-011 |
| operatorId | String | No | -- | FK -> Operator (onDelete: Restrict). Tenant-scoped |
| durationMinutes | Int | No | -- | |
| deactivatedAt | DateTime | Yes | -- | Operator deactivation |
| moderatedAt | DateTime | Yes | -- | Admin moderation kill switch. Non-null = hidden from search |
| createdAt | DateTime | No | `@default(now())` | |
| updatedAt | DateTime | No | `@updatedAt` | |
| originPlaceId | String | Yes | -- | FK -> Place (onDelete: SetNull). Canonical Place link |
| destPlaceId | String | Yes | -- | FK -> Place (onDelete: SetNull). Canonical Place link |

#### Place

| Column | Prisma Type | Nullable | Default | Constraints / Notes |
|--------|-------------|----------|---------|---------------------|
| id | String | No | `@default(cuid())` | Primary key |
| canonicalName | String | No | -- | The canonical place name |
| aliases | String[] | No | -- | Array of alias names for merging |
| slug | String | Yes | -- | `@unique`. URL-friendly identifier |
| createdAt | DateTime | No | `@default(now())` | |

**Note:** Place is GLOBAL (not operator-scoped). Functional GIN index `trip_route_unaccent_idx` on Route (not Place) uses `unaccent_immutable(lower(...))` for Vietnamese diacritic-insensitive search.

> **Phase 2 (deferred)**: Pickup area entities (`OperatorPickupArea`, `TripPickupArea`, `TemplatePickupArea`, `RoutePickupArea`), `PickupPlaceKind`/`PickupKind` enums, and Hold/Booking pickup fields are deferred to post-launch (trigger: 4 operators). Phase 1 defaults all bookings to `pickupKind = 'station'`.

#### OperatorPickupArea

| Column | Prisma Type | Nullable | Default | Constraints / Notes |
|--------|-------------|----------|---------|---------------------|
| id | String | No | `@default(cuid())` | Primary key |
| operatorId | String | No | -- | FK -> Operator (onDelete: Cascade). Tenant-scoped |
| provinceCode | String | No | -- | GSO province code |
| districtCode | String | No | -- | GSO district code |
| districtName | String | No | -- | Denormalized district name |
| wardCode | String | No | -- | GSO ward code |
| wardName | String | No | -- | Denormalized ward name |
| name | String | No | -- | Named point (e.g. "Ben xe My Dinh") |
| addressLine | String | Yes | -- | Optional street/landmark |
| label | String | No | -- | Denormalized "Phuong X, Quan Y, Tinh Z" |
| kind | PickupPlaceKind | No | `@default(station)` | station (Ben xe) or pickup (Don tan noi) |
| isActive | Boolean | No | `@default(true)` | Deactivate instead of delete for referential integrity |
| displayOrder | Int | No | -- | |
| createdAt | DateTime | No | `@default(now())` | |
| updatedAt | DateTime | No | `@updatedAt` | |

#### TripPickupArea (Join Table)

| Column | Prisma Type | Nullable | Default | Constraints / Notes |
|--------|-------------|----------|---------|---------------------|
| id | String | No | `@default(cuid())` | Primary key |
| tripId | String | No | -- | FK -> Trip (onDelete: Cascade) |
| operatorPickupAreaId | String | No | -- | FK -> OperatorPickupArea (onDelete: Cascade) |
| label | String | No | -- | Snapshot of area label (survives menu edits) |
| kind | PickupPlaceKind | No | `@default(pickup)` | Snapshot of area kind |
| displayOrder | Int | No | -- | |

Composite unique: `@@unique([tripId, operatorPickupAreaId])`

#### TemplatePickupArea (Join Table)

| Column | Prisma Type | Nullable | Default | Constraints / Notes |
|--------|-------------|----------|---------|---------------------|
| id | String | No | `@default(cuid())` | Primary key |
| recurringTemplateId | String | No | -- | FK -> RecurringTripTemplate (onDelete: Cascade) |
| operatorPickupAreaId | String | No | -- | FK -> OperatorPickupArea (onDelete: Cascade) |
| label | String | No | -- | Snapshot |
| kind | PickupPlaceKind | No | `@default(pickup)` | Snapshot |
| displayOrder | Int | No | -- | |

Composite unique: `@@unique([recurringTemplateId, operatorPickupAreaId])`

#### RoutePickupArea (Join Table)

| Column | Prisma Type | Nullable | Default | Constraints / Notes |
|--------|-------------|----------|---------|---------------------|
| id | String | No | `@default(cuid())` | Primary key |
| routeId | String | No | -- | FK -> Route (onDelete: Cascade) |
| operatorPickupAreaId | String | No | -- | FK -> OperatorPickupArea (onDelete: Cascade) |
| displayOrder | Int | No | -- | |

Composite unique: `@@unique([routeId, operatorPickupAreaId])`

**Note:** This is a live link (not a snapshot) -- label/kind are read from OperatorPickupArea. TripPickupArea still snapshots them at trip-create time.

#### Trip

| Column | Prisma Type | Nullable | Default | Constraints / Notes |
|--------|-------------|----------|---------|---------------------|
| id | String | No | `@default(cuid())` | Primary key |
| routeId | String | No | -- | FK -> Route |
| busId | String | No | -- | FK -> Bus |
| operatorId | String | No | -- | FK -> Operator. Denormalized from Route for tenant scope |
| departureAt | DateTime | No | -- | |
| price | Int | No | -- | VND. I7-exempt for operator-side `/api/op/**` (operator IS the price authority) |
| status | TripStatus | No | `@default(scheduled)` | scheduled, departed, completed, cancelled |
| salesClosed | Boolean | No | `@default(false)` | Orthogonal to status. Blocks further bookings |
| blockedSeats | Int | No | `@default(0)` | Reserved/blocked seats not available for sale |
| cancelReason | String | Yes | -- | |
| cancelledAt | DateTime | Yes | -- | Paired with status='cancelled' |
| moderatedAt | DateTime | Yes | -- | Admin moderation kill switch |
| departedAt | DateTime | Yes | -- | Paired with status='departed' |
| completedAt | DateTime | Yes | -- | Paired with status='completed' |
| recurringTemplateId | String | Yes | -- | FK -> RecurringTripTemplate. Null for one-off trips |
| pairedTripId | String | Yes | -- | Self-referential FK -> Trip (paired return trip) |
| cancellationPolicyId | String | Yes | -- | FK -> CancellationPolicy (onDelete: SetNull). Nullable: defaults to operator's isDefault policy |
| updatedAt | DateTime | No | `@updatedAt` | |

**SQL-only partial unique index:** `(recurringTemplateId, departureAt) WHERE recurringTemplateId IS NOT NULL` -- dedup guard for recurring trip generation.

**Price audit:** Trip.price is mutable. Price at booking time is captured in Booking.totalVnd (= Trip.price × ticketCount at hold creation). No separate price-history table -- LedgerEntry.amount preserves the transacted value.

#### RecurringTripTemplate

| Column | Prisma Type | Nullable | Default | Constraints / Notes |
|--------|-------------|----------|---------|---------------------|
| id | String | No | `@default(cuid())` | Primary key |
| operatorId | String | No | -- | FK -> Operator. Tenant-scoped |
| routeId | String | No | -- | FK -> Route |
| busId | String | No | -- | FK -> Bus |
| price | Int | No | -- | VND |
| departureLocalTime | String | No | -- | HH:MM in Asia/Ho_Chi_Minh timezone |
| daysOfMask | Int | No | -- | Bitmask: Mon=1, Tue=2, Wed=4, Thu=8, Fri=16, Sat=32, Sun=64 (range 1-127) |
| validFrom | DateTime | No | -- | `@db.Date` |
| validUntil | DateTime | No | -- | `@db.Date` |
| deactivatedAt | DateTime | Yes | -- | |
| createdAt | DateTime | No | `@default(now())` | |
| updatedAt | DateTime | No | `@updatedAt` | |

#### RecurringGenerationLog

| Column | Prisma Type | Nullable | Default | Constraints / Notes |
|--------|-------------|----------|---------|---------------------|
| id | String | No | `@default(cuid())` | Primary key |
| templateId | String | No | -- | FK -> RecurringTripTemplate (onDelete: Cascade) |
| tripId | String | Yes | -- | FK -> Trip (onDelete: SetNull) |
| date | DateTime | No | -- | `@db.Date`. The date being generated (YYYY-MM-DD key) |
| status | String | No | `@default("generated")` | 'generated', 'skipped', or 'failed' |
| skipReason | String | Yes | -- | |
| createdAt | DateTime | No | `@default(now())` | |

#### CancellationPolicy

| Column | Prisma Type | Nullable | Default | Constraints / Notes |
|--------|-------------|----------|---------|---------------------|
| id | String | No | `@default(cuid())` | Primary key |
| operatorId | String | No | -- | FK -> Operator. Tenant-scoped |
| name | String | No | -- | Display label (e.g. "Flexible", "Standard", "Non-refundable") |
| rules | Json | No | -- | Array of `{ hoursBeforeDeparture: number, refundPercentage: number }`. Validated at API boundary via Zod |
| isDefault | Boolean | No | `@default(false)` | Operator default policy. At most one per operator |
| effectiveFrom | DateTime | No | -- | Policy effective date |
| createdAt | DateTime | No | `@default(now())` | |

**CPL 2023 compliance:** Operator-specific cancellation/refund terms. Displayed to customer at booking time via ConsentRecord `no_refund` type.

#### OperatorSettings

| Column | Prisma Type | Nullable | Default | Constraints / Notes |
|--------|-------------|----------|---------|---------------------|
| id | String | No | `@default(cuid())` | Primary key |
| operatorId | String | No | -- | `@unique`. FK -> Operator. 1:1 tenant-scoped |
| autoConfirmBookings | Boolean | No | `@default(false)` | Auto-confirm paid bookings without operator action |
| notificationPreference | String | No | `@default("sms")` | 'sms', 'email', or 'both' |
| bookingReminderHours | Int | No | `@default(24)` | Hours before departure to send reminder |
| customBrandingText | String | Yes | -- | Operator-branded text on tickets/notifications |
| updatedAt | DateTime | No | `@updatedAt` | |

### 2.5 Booking Context

#### Hold

| Column | Prisma Type | Nullable | Default | Constraints / Notes |
|--------|-------------|----------|---------|---------------------|
| id | String | No | `@default(cuid())` | Primary key |
| tripId | String | No | -- | FK -> Trip |
| ticketCount | Int | No | -- | |
| customerPhone | String | No | -- | PII: buyer phone snapshot |
| customerName | String | No | -- | PII: buyer name snapshot |
| customerEmail | String | Yes | -- | PII: buyer email snapshot |
| expiresAt | DateTime | No | -- | NOW() + 10 min |
| status | HoldStatus | No | `@default(active)` | active, consumed, expired, cancelled_trip |
| createdAt | DateTime | No | `@default(now())` | |
| pickupKind | PickupKind | No | `@default(station)` | station, point, or custom |
| pickupAreaId | String | Yes | -- | FK -> OperatorPickupArea (onDelete: SetNull) |
| pickupAreaLabel | String | Yes | -- | Denormalized snapshot |
| pickupDetail | String | Yes | -- | Free-text. Required (>=5 trimmed chars) when pickupKind=custom |
| customPickupRequested | Boolean | No | `@default(false)` | Derived from pickupKind at INSERT. CHECK constraint enforces detail requirement |

#### Booking

| Column | Prisma Type | Nullable | Default | Constraints / Notes |
|--------|-------------|----------|---------|---------------------|
| id | String | No | -- | `@db.Uuid`. Primary key (UUID, not CUID) |
| bookingRef | String | No | -- | `@unique`. Format: BB-YYYY-[0-9a-z]{4}-[0-9a-z]{4} (lowercase base36) |
| confirmationToken | String | No | -- | `@unique`. Single-use token for booking confirmation |
| tripId | String | No | -- | FK -> Trip |
| holdId | String | Yes | -- | FK -> Hold. `@unique` (1:1). ON CONFLICT DO NOTHING pattern |
| customerId | String | Yes | -- | FK -> Customer (onDelete: SetNull) |
| buyerName | String | No | -- | PII snapshot |
| buyerPhone | String | No | -- | PII snapshot |
| buyerEmail | String | Yes | -- | PII snapshot |
| ticketCount | Int | No | -- | |
| totalVnd | Int | No | -- | Server-computed: Trip.price x ticketCount (I7 invariant) |
| paymentMethod | PaymentMethod | No | -- | momo, zalopay, card, vnpay, cash, bank_transfer. `cash` = station-collected (no PSP webhook; operator confirms). `bank_transfer` = VietQR + SePay webhook confirmation (zero fees, launch PSP; ADR-005). No programmatic refund API (manual bank transfer) |
| paymentExternalRef | String | Yes | -- | PSP transaction reference |
| status | BookingStatus | No | `@default(awaiting_payment)` | See state machine (section 7) |
| isManual | Boolean | No | `@default(false)` | Operator-created manual booking flag |
| createdAt | DateTime | No | `@default(now())` | |
| contactStatus | ContactStatus | No | `@default(pending)` | Operator call-queue tracking |
| pickupKind | PickupKind | No | `@default(station)` | Snapshotted from hold |
| pickupAreaId | String | Yes | -- | FK -> OperatorPickupArea (onDelete: SetNull) |
| pickupAreaLabel | String | Yes | -- | Denormalized snapshot |
| pickupDetail | String | Yes | -- | Free-text. Required (>=5 trimmed chars) when pickupKind=custom |
| customPickupRequested | Boolean | No | `@default(false)` | Derived from pickupKind at INSERT. CHECK constraint enforces detail requirement |
| pickedUpAt | DateTime | Yes | -- | Boarding marked (SET-TRUE-ONLY) |
| escalationNote | String | Yes | -- | Operator escalation note |
| escalatedAt | DateTime | Yes | -- | |
| reminderSentAt | DateTime | Yes | -- | 24h SMS reminder sent timestamp (sweeper predicate) |
| checkedInAt | DateTime | Yes | -- | Single-use boarding check-in (SET-ONCE via WHERE checkedInAt IS NULL) |
| noShowAt | DateTime | Yes | -- | Paired with status='no_show'. Mutually exclusive with checkedInAt |
| ticketPdfKey | String | Yes | -- | Object-storage key. NULL = not yet generated |
| ticketPdfGeneratedAt | DateTime | Yes | -- | Paired with ticketPdfKey (set together) |
| snapshotAnonymizedAt | DateTime | Yes | -- | PII scrub marker. Non-null = scrubbed. Money/audit columns retained |
| refundedAt | DateTime | Yes | -- | `@db.Timestamptz`. Oversold-race refund. Paired with status='refunded' |
| einvoiceRef | String | Yes | -- | Circular 78/2021 e-invoice reference |
| einvoiceIssuedAt | DateTime | Yes | -- | `@db.Timestamptz`. Paired with einvoiceRef (CHECK constraint enforces both-or-neither) |
| voucherCode | String | Yes | -- | Applied voucher code. Denormalized from Voucher for audit trail |
| discountVnd | Int | No | `@default(0)` | Discount amount in VND. totalVnd = (Trip.price × ticketCount) - discountVnd |

#### ConsentRecord

| Column | Prisma Type | Nullable | Default | Constraints / Notes |
|--------|-------------|----------|---------|---------------------|
| id | String | No | `@default(cuid())` | Primary key |
| bookingId | String | No | -- | `@db.Uuid`. FK -> Booking (onDelete: Cascade) |
| consentType | String | No | -- | Documented union: 'no_refund', 'pii_storage', 'marketing_sms', 'marketing_email', 'marketing_zns'. Decree 91/2020 requires explicit marketing consent |
| version | String | No | -- | Consent text version (e.g. '2026-06-01') |
| consentedAt | DateTime | No | `@default(now())` | |

**Immutability:** BEFORE UPDATE trigger blocks modification. DELETE is allowed (Booking CASCADE propagates).

#### Review

| Column | Prisma Type | Nullable | Default | Constraints / Notes |
|--------|-------------|----------|---------|---------------------|
| id | String | No | `@default(cuid())` | Primary key |
| bookingId | String | No | -- | `@db.Uuid`. FK -> Booking (onDelete: Restrict). `@unique` -- one review per booking |
| customerId | String | Yes | -- | FK -> Customer (onDelete: SetNull) |
| operatorId | String | No | -- | FK -> Operator. Denormalized for query efficiency |
| tripId | String | No | -- | FK -> Trip. Denormalized for query efficiency |
| rating | Int | No | -- | 1-5 scale. CHECK constraint: `rating >= 1 AND rating <= 5` (see section 6.1) |
| comment | String | Yes | -- | `@db.Text`. Free-text review |
| status | ReviewStatus | No | `@default(pending)` | pending, published, hidden |
| moderatedAt | DateTime | Yes | -- | Set when admin moderates (publish or hide) |
| createdAt | DateTime | No | `@default(now())` | |

**Cross-domain:** Customer writes, operator reads aggregated ratings, admin moderates (publish/hide).

### 2.6 Payment Context

#### PaymentEvent

| Column | Prisma Type | Nullable | Default | Constraints / Notes |
|--------|-------------|----------|---------|---------------------|
| id | String | No | `@default(dbgenerated("gen_random_uuid()"))` | `@db.Uuid`. Primary key |
| bookingId | String | No | -- | `@db.Uuid`. FK -> Booking |
| adapter | String | No | -- | 'momo', 'vnpay', 'bank_transfer', 'zalopay', 'stub' |
| providerTxnId | String | No | -- | PSP transaction ID |
| currency | String | No | `@default("VND")` | |
| rawBody | String | No | -- | `@db.Text`. Raw webhook/callback payload |
| receivedAt | DateTime | No | `@default(now())` | |

Composite unique: `@@unique([adapter, providerTxnId])`

#### Refund

| Column | Prisma Type | Nullable | Default | Constraints / Notes |
|--------|-------------|----------|---------|---------------------|
| id | String | No | `@default(cuid())` | Primary key |
| bookingId | String | No | -- | `@db.Uuid`. FK -> Booking (onDelete: Restrict) |
| amount | Int | No | -- | VND. Partial or full refund amount |
| reason | RefundReason | No | -- | oversold, trip_cancelled, customer_request, payment_error |
| status | RefundStatus | No | `@default(requested)` | requested, processing, completed, failed |
| pspRefundRef | String | Yes | -- | PSP refund transaction reference |
| requestedBy | String | No | -- | Actor: 'system', admin ID, or customer ID |
| requestedAt | DateTime | No | `@default(now())` | |
| completedAt | DateTime | Yes | -- | Paired with status='completed' |
| failureReason | String | Yes | -- | |
| retryCount | Int | No | `@default(0)` | |
| nextRetryAt | DateTime | Yes | -- | Next eligible retry (cron predicate column) |
| createdAt | DateTime | No | `@default(now())` | |

**Ledger integration:** LedgerEntry `refund_debit` + `refund_out` entries are created when Refund.status transitions to `completed`. Bank transfer refunds require manual bank transfer (no programmatic refund API).

### 2.7 Finance / Ledger Context

#### LedgerEntry

| Column | Prisma Type | Nullable | Default | Constraints / Notes |
|--------|-------------|----------|---------|---------------------|
| id | String | No | `@default(cuid())` | Primary key |
| operatorId | String | No | -- | FK -> Operator. Tenant-scoped |
| bookingId | String | Yes | -- | `@db.Uuid`. FK -> Booking (onDelete: Restrict) |
| payoutId | String | Yes | -- | Plain column (NO FK in current schema -- decoupled from Payout model) |
| type | LedgerEntryType | No | -- | See enums section |
| amount | BigInt | No | -- | Signed minor units (VND). Positive = credit TO operator, negative = debit FROM |
| currency | String | No | `@default("VND")` | |
| sourceEventId | String | No | -- | `@@unique([sourceEventId])`. Idempotency key |
| createdAt | DateTime | No | `@default(now())` | |

**Immutability:** BEFORE UPDATE and BEFORE DELETE triggers block modification. Append-only.

#### Payout

| Column | Prisma Type | Nullable | Default | Constraints / Notes |
|--------|-------------|----------|---------|---------------------|
| id | String | No | `@default(cuid())` | Primary key |
| tripId | String | Yes | -- | FK -> Trip (onDelete: Restrict). Nullable: on-demand withdrawal payouts are NOT trip-scoped |
| operatorId | String | No | -- | FK -> Operator. Tenant-scoped |
| gross | Int | No | -- | VND |
| platformFee | Int | No | -- | VND |
| net | Int | No | -- | VND |
| taxVat | Int | No | `@default(0)` | |
| taxPit | Int | No | `@default(0)` | |
| taxTotal | Int | No | `@default(0)` | |
| status | PayoutStatus | No | `@default(requested)` | requested, processing, paid, failed |
| scheduledAt | DateTime | No | -- | |
| settledAt | DateTime | Yes | -- | |
| failureReason | String | Yes | -- | |
| createdAt | DateTime | No | `@default(now())` | |
| updatedAt | DateTime | No | `@updatedAt` | |

#### FeeConfig

| Column | Prisma Type | Nullable | Default | Constraints / Notes |
|--------|-------------|----------|---------|---------------------|
| id | String | No | `@default(cuid())` | Primary key |
| operatorId | String | Yes | -- | FK -> Operator (onDelete: Restrict). NULL = global default; non-null = per-operator override |
| ratePpm | Int | No | -- | Parts-per-million (60000 = 6%). Integer-only computation: `amount * ratePpm / 1_000_000` |
| effectiveFrom | DateTime | No | -- | |
| effectiveTo | DateTime | Yes | -- | NULL = open-ended (current) |
| createdBy | String | Yes | -- | Actor ID. Nullable for seeded cutover row |
| createdAt | DateTime | No | `@default(now())` | |

**Effective-dated + append-audited:** Rate changes create new rows. Never edit existing `ratePpm`. Resolution: operator-override -> global default.

#### PayoutAccount

| Column | Prisma Type | Nullable | Default | Constraints / Notes |
|--------|-------------|----------|---------|---------------------|
| id | String | No | `@default(cuid())` | Primary key |
| operatorId | String | No | -- | `@unique`. One payout account per operator |
| bankName | String | No | -- | |
| accountNumber | String | No | -- | T2 sensitive PII. Application-layer AES-256-GCM encryption via encryptField/decryptField helpers. Masked to last-4 on all API responses. Log-redacted. Go-live blocker: must verify encryption is active before production |
| accountHolderName | String | No | -- | |
| verifiedAt | DateTime | Yes | -- | Set on verification. Reset to null on any account edit |
| verifyMethod | String | Yes | -- | 'name_match' or 'micro_deposit' |
| createdAt | DateTime | No | `@default(now())` | |
| updatedAt | DateTime | No | `@updatedAt` | |

#### SubscriptionPlan

| Column | Prisma Type | Nullable | Default | Constraints / Notes |
|--------|-------------|----------|---------|---------------------|
| id | String | No | `@default(cuid())` | Primary key |
| name | String | No | -- | Plan display name (e.g. "Basic", "Professional") |
| monthlyFeeVnd | Int | No | -- | Monthly subscription fee in VND |
| ratePpm | Int | No | -- | Commission rate for this tier (parts-per-million). Overrides FeeConfig.ratePpm when active subscription exists |
| isActive | Boolean | No | `@default(true)` | Deactivate instead of delete |
| createdAt | DateTime | No | `@default(now())` | |

#### OperatorSubscription

| Column | Prisma Type | Nullable | Default | Constraints / Notes |
|--------|-------------|----------|---------|---------------------|
| id | String | No | `@default(cuid())` | Primary key |
| operatorId | String | No | -- | `@unique`. FK -> Operator. One active subscription per operator |
| planId | String | No | -- | FK -> SubscriptionPlan |
| startsAt | DateTime | No | -- | Subscription start |
| endsAt | DateTime | Yes | -- | NULL = auto-renew |
| status | SubscriptionStatus | No | `@default(active)` | active, cancelled, expired, past_due |
| billingCycleDay | Int | No | -- | Day of month for billing (1-28) |
| nextBillingAt | DateTime | No | -- | Next billing date (cron predicate) |
| createdAt | DateTime | No | `@default(now())` | |
| updatedAt | DateTime | No | `@updatedAt` | |

**Post-launch scope** per ADR-006. FeeConfig.ratePpm resolves commission today; SubscriptionPlan.ratePpm overrides when an active subscription exists. Resolution order: active OperatorSubscription.plan.ratePpm -> per-operator FeeConfig -> global FeeConfig.

### 2.8 Notification Context

#### NotificationLog

| Column | Prisma Type | Nullable | Default | Constraints / Notes |
|--------|-------------|----------|---------|---------------------|
| id | String | No | `@default(cuid())` | Primary key |
| bookingId | String | Yes | -- | `@db.Uuid`. FK -> Booking (onDelete: Cascade) |
| channel | NotificationChannel | No | `@default(sms)` | sms or email |
| template | String | No | -- | Template identifier |
| recipient | String | No | -- | **Sole PII column** (I9 invariant) |
| payload | String | No | -- | Must NOT contain phone/PII (I9) |
| status | NotificationStatus | No | `@default(pending)` | pending, sent, failed |
| externalRef | String | Yes | -- | SMS/email provider reference |
| sentAt | DateTime | Yes | -- | |
| scheduledFor | DateTime | Yes | -- | Top-level indexed column (NOT in payload). S19 cron: payout_scheduled dispatch time |
| attemptCount | Int | No | `@default(0)` | |
| nextAttemptAt | DateTime | Yes | -- | Next eligible dispatch (exponential backoff). NULL = due now |
| lastError | String | Yes | -- | Truncated error message for ops debugging |
| createdAt | DateTime | No | `@default(now())` | |

Composite unique: `@@unique([bookingId, template])`

### 2.9 Admin Context

#### AdminAuditLog

| Column | Prisma Type | Nullable | Default | Constraints / Notes |
|--------|-------------|----------|---------|---------------------|
| id | String | No | `@default(cuid())` | Primary key |
| actor | String | No | -- | Plain string (OS user / jumpbox identity), not an FK |
| action | String | No | -- | |
| target | String | No | -- | |
| argsRedacted | String | Yes | -- | Command args with phone numbers masked to last-4 |
| timestamp | DateTime | No | `@default(now())` | |

**Immutability:** BEFORE UPDATE and BEFORE DELETE triggers block modification. Append-only.

#### ContentReport

| Column | Prisma Type | Nullable | Default | Constraints / Notes |
|--------|-------------|----------|---------|---------------------|
| id | String | No | `@default(cuid())` | Primary key |
| targetType | String | No | -- | 'trip', 'route', or 'operator' |
| targetId | String | No | -- | |
| reason | String | No | -- | |
| reportedBy | String | Yes | -- | |
| status | String | No | `@default("open")` | 'open' or 'resolved' |
| resolvedBy | String | Yes | -- | |
| resolvedAt | DateTime | Yes | -- | |
| createdAt | DateTime | No | `@default(now())` | |

#### DataRequest

| Column | Prisma Type | Nullable | Default | Constraints / Notes |
|--------|-------------|----------|---------|---------------------|
| id | String | No | `@default(cuid())` | Primary key |
| customerId | String | Yes | -- | FK -> Customer (onDelete: SetNull). Nullable for anonymous/deleted requestors |
| requestType | DataRequestType | No | -- | access, rectify, erase, port |
| status | DataRequestStatus | No | `@default(received)` | received, processing, completed, rejected |
| requestedAt | DateTime | No | `@default(now())` | |
| acknowledgedAt | DateTime | Yes | -- | PDPL acknowledgement timestamp |
| completedAt | DateTime | Yes | -- | Request fulfilment timestamp |
| handledBy | String | Yes | -- | Admin actor ID |
| responseRef | String | Yes | -- | Link to exported data package (access/port) or audit note (rectify/erase) |
| notes | String | Yes | -- | Internal notes |
| createdAt | DateTime | No | `@default(now())` | |

**DSAR (Data Subject Access Request):** GLOBAL entity (admin-managed, not operator-scoped). Drives the data lifecycle erasure path documented in section 8. PDPL 2025 compliance: access, rectification, erasure, portability rights.

### 2.10 Analytics

#### FunnelEvent

| Column | Prisma Type | Nullable | Default | Constraints / Notes |
|--------|-------------|----------|---------|---------------------|
| id | String | No | `@default(cuid())` | Primary key |
| sessionId | String | No | -- | Random cookie value (no PII) |
| step | String | No | -- | search_performed, hold_created, payment_initiated, booking_paid |
| tripId | String | Yes | -- | |
| bookingId | String | Yes | -- | |
| context | Json | Yes | -- | Arbitrary context payload |
| createdAt | DateTime | No | `@default(now())` | |

#### JobRunLog

| Column | Prisma Type | Nullable | Default | Constraints / Notes |
|--------|-------------|----------|---------|---------------------|
| id | String | No | `@default(cuid())` | Primary key |
| jobName | String | No | -- | |
| startedAt | DateTime | No | -- | |
| endedAt | DateTime | Yes | -- | |
| status | String | No | -- | 'success', 'failed', or 'skipped_locked' |
| rowsAffected | Int | No | `@default(0)` | |
| errorMessage | String | Yes | -- | |
| createdAt | DateTime | No | `@default(now())` | |

### 2.11 KYB (Know-Your-Business)

#### KybDocument

| Column | Prisma Type | Nullable | Default | Constraints / Notes |
|--------|-------------|----------|---------|---------------------|
| id | String | No | `@default(cuid())` | Primary key |
| operatorId | String | No | -- | FK -> Operator (onDelete: Restrict). Tenant-scoped |
| type | String | No | -- | 'business_license', 'identity', or 'payout_account' |
| storageKey | String | No | -- | S3 object key (lib/storage). DB stores key, never bytes |
| status | String | No | `@default("submitted")` | 'submitted', 'accepted', or 'rejected' |
| uploadedAt | DateTime | No | `@default(now())` | |
| purgedAt | DateTime | Yes | -- | Retention sweeper marker. Non-null = storage object removed (pointer row retained as audit trail) |
| expiryDate | DateTime | Yes | -- | Document expiry date. Transport licenses have defined validity periods. Cron predicate column for operatorLicenseAlert |
| expiryAlertSentAt | DateTime | Yes | -- | Tracks last expiry alert sent (prevents duplicate notifications) |

#### StoredObject

| Column | Prisma Type | Nullable | Default | Constraints / Notes |
|--------|-------------|----------|---------|---------------------|
| id | String | No | `@default(cuid())` | Primary key |
| key | String | No | -- | `@unique`. S3 object key |
| contentType | String | No | -- | MIME type |
| sizeBytes | Int | No | -- | |
| purpose | String | No | -- | 'kyb_doc' or 'ticket_pdf' (documented union, String for extensibility) |
| uploadedBy | String | Yes | -- | Actor ID. Nullable for system-generated uploads |
| createdAt | DateTime | No | `@default(now())` | |

### 2.12 Charter

#### CharterRequest

| Column | Prisma Type | Nullable | Default | Constraints / Notes |
|--------|-------------|----------|---------|---------------------|
| id | String | No | `@default(cuid())` | Primary key |
| ref | String | No | -- | `@unique`. Format: CH-YYYY-XXXXXX |
| customerId | String | Yes | -- | FK -> Customer (onDelete: SetNull). Nullable for guest charters |
| contactName | String | No | -- | Lead contact PII |
| contactPhone | String | No | -- | Lead contact PII |
| contactEmail | String | No | -- | Lead contact PII |
| originPlaceId | String | Yes | -- | FK -> Place (onDelete: SetNull) |
| destinations | Json | No | -- | Array of `{ placeId?: string, name: string }` |
| startDate | DateTime | No | -- | |
| endDate | DateTime | Yes | -- | |
| durationDays | Int | Yes | -- | |
| passengers | Int | No | -- | |
| vehicleType | String | No | -- | Free-text: 'coach', 'sleeper', 'limousine' |
| budgetVnd | Int | Yes | -- | |
| notes | String | Yes | -- | |
| status | CharterStatus | No | `@default(SUBMITTED)` | See state machine (section 7) |
| assigneeOperatorId | String | Yes | -- | FK -> Operator (onDelete: SetNull). Set on ASSIGNED_DIRECT or ACCEPTED |
| publishedAt | DateTime | Yes | -- | Set when -> PUBLISHED |
| claimByAt | DateTime | Yes | -- | Public pool claim deadline |
| acceptByAt | DateTime | Yes | -- | Direct-assign accept deadline |
| rejectionReason | String | Yes | -- | Set when -> REJECTED |
| createdAt | DateTime | No | `@default(now())` | |
| updatedAt | DateTime | No | `@updatedAt` | |

**Note:** This is a LEAD-GEN model. No payment rail -- operator settles off-platform.

**Destinations validation:** `destinations` (Json) validated at API boundary via Zod schema: `z.array(z.object({ placeId: z.string().optional(), name: z.string() }))`. DB stores raw JSON; malformed data rejected at application layer.

### 2.13 E-Invoice (Circular 78/2021)

#### EInvoice

| Column | Prisma Type | Nullable | Default | Constraints / Notes |
|--------|-------------|----------|---------|---------------------|
| id | String | No | `@default(cuid())` | Primary key |
| bookingId | String | No | -- | `@db.Uuid`. FK -> Booking (onDelete: Restrict) |
| operatorId | String | No | -- | FK -> Operator (onDelete: Restrict). Tenant-scoped |
| invoiceNumber | String | Yes | -- | GDT invoice number. Partial unique index WHERE invoiceNumber IS NOT NULL |
| status | EInvoiceStatus | No | `@default(pending)` | pending, issued, sent, failed, cancelled |
| vendorRef | String | Yes | -- | MISA/vendor reference |
| rawResponse | String | Yes | -- | Vendor API response |
| issuedAt | DateTime | Yes | -- | `@db.Timestamptz` |
| createdAt | DateTime | No | `@default(now())` | |

### 2.14 Feature Flags

#### FeatureFlag

| Column | Prisma Type | Nullable | Default | Constraints / Notes |
|--------|-------------|----------|---------|---------------------|
| key | String | No | -- | `@id`. Natural PK (e.g. 'rail.momo.enabled', 'killswitch.booking') |
| enabled | Boolean | No | `@default(false)` | |
| value | String | Yes | -- | Optional JSON string for non-boolean flags |
| updatedBy | String | Yes | -- | Actor ID |
| updatedAt | DateTime | No | `@updatedAt` | |

### 2.15 Customer Support Context

#### Complaint

| Column | Prisma Type | Nullable | Default | Constraints / Notes |
|--------|-------------|----------|---------|---------------------|
| id | String | No | `@default(cuid())` | Primary key |
| customerId | String | Yes | -- | FK -> Customer (onDelete: SetNull). Nullable for anonymous complaints |
| bookingId | String | Yes | -- | `@db.Uuid`. FK -> Booking (onDelete: SetNull). Nullable for non-booking complaints |
| category | String | No | -- | 'booking_issue', 'payment_issue', 'service_quality', 'other' |
| description | String | No | -- | `@db.Text`. Complaint description |
| status | ComplaintStatus | No | `@default(open)` | open, acknowledged, in_progress, resolved, escalated, closed |
| acknowledgedAt | DateTime | Yes | -- | SLA: within 3 business days of createdAt (CPL 2023) |
| assignedTo | String | Yes | -- | Admin actor ID |
| resolvedAt | DateTime | Yes | -- | Paired with status='resolved' or 'closed' |
| resolution | String | Yes | -- | `@db.Text`. Resolution description |
| slaDeadline | DateTime | No | -- | Computed at creation: createdAt + 3 business days (acknowledge). Resolve deadline: createdAt + 30 days |
| escalatedAt | DateTime | Yes | -- | Paired with status='escalated' |
| createdAt | DateTime | No | `@default(now())` | |
| updatedAt | DateTime | No | `@updatedAt` | |

**GLOBAL entity** (admin-managed, not tenant-scoped). SLA deadlines per Consumer Protection Law 2023 (No. 19/2023/QH15): 3-day acknowledgment, 7-30 day resolution. Monitored by `complaintSlaMon` cron job (section 12).

### 2.16 Promotions Context

#### Voucher

| Column | Prisma Type | Nullable | Default | Constraints / Notes |
|--------|-------------|----------|---------|---------------------|
| id | String | No | `@default(cuid())` | Primary key |
| code | String | No | -- | `@unique`. Voucher code |
| operatorId | String | Yes | -- | FK -> Operator (onDelete: SetNull). NULL = platform-wide voucher |
| discountType | DiscountType | No | -- | fixed_amount or percentage |
| discountValue | Int | No | -- | VND for fixed_amount; PPM (parts-per-million) for percentage |
| minOrderVnd | Int | Yes | -- | Minimum order value for eligibility. NULL = no minimum |
| maxDiscountVnd | Int | Yes | -- | Maximum discount cap for percentage type. NULL = uncapped |
| validFrom | DateTime | No | -- | Validity window start |
| validUntil | DateTime | No | -- | Validity window end |
| usageLimit | Int | Yes | -- | Total redemption limit. NULL = unlimited |
| usedCount | Int | No | `@default(0)` | Current redemption count |
| isActive | Boolean | No | `@default(true)` | Admin/operator deactivation flag |
| createdBy | String | No | -- | Admin or operator actor ID |
| createdAt | DateTime | No | `@default(now())` | |

#### VoucherRedemption

| Column | Prisma Type | Nullable | Default | Constraints / Notes |
|--------|-------------|----------|---------|---------------------|
| id | String | No | `@default(cuid())` | Primary key |
| voucherId | String | No | -- | FK -> Voucher (onDelete: Restrict) |
| bookingId | String | No | -- | `@db.Uuid`. FK -> Booking (onDelete: Restrict). `@unique` -- one voucher per booking |
| discountAppliedVnd | Int | No | -- | Actual discount amount applied in VND |
| redeemedAt | DateTime | No | `@default(now())` | |

### 2.17 Staff Assignment

#### StaffTripAssignment

| Column | Prisma Type | Nullable | Default | Constraints / Notes |
|--------|-------------|----------|---------|---------------------|
| id | String | No | `@default(cuid())` | Primary key |
| operatorUserId | String | No | -- | FK -> OperatorUser (onDelete: Cascade) |
| tripId | String | No | -- | FK -> Trip (onDelete: Cascade) |
| assignedAt | DateTime | No | `@default(now())` | |
| role | String | Yes | -- | 'driver', 'conductor', 'checker'. NULL = unspecified |

Composite unique: `@@unique([operatorUserId, tripId])`

**Operator-scoped** via OperatorUser.operatorId. Replaces the V1 `OperatorUser.assignedTripId` single-assignment FK. Supports multi-trip assignment for mid-size operators with multiple concurrent departures.

---

## 3. Enums

| Enum | Values | Used By |
|------|--------|---------|
| OperatorStatus | `PENDING_REVIEW`, `UNDER_REVIEW`, `APPROVED`, `REJECTED`, `SUSPENDED` | Operator.status |
| TaxClassification | `company`, `individual_household` | Operator.taxClassification |
| BusType | `coach`, `sleeper`, `limousine` | Bus.busType |
| TripStatus | `scheduled`, `departed`, `completed`, `cancelled` | Trip.status |
| HoldStatus | `active`, `consumed`, `expired`, `cancelled_trip` | Hold.status |
| BookingStatus | `awaiting_payment`, `paid`, `completed`, `cancelled`, `trip_cancelled`, `no_show`, `payment_failed_expired`, `refunded` | Booking.status |
| ContactStatus | `pending`, `reached`, `no_answer`, `callback` | Booking.contactStatus |
| PaymentMethod | `momo`, `zalopay`, `card`, `vnpay`, `cash`, `bank_transfer` | Booking.paymentMethod |
| PickupPlaceKind | `station`, `pickup` | OperatorPickupArea.kind, TripPickupArea.kind, TemplatePickupArea.kind |
| PickupKind | `station`, `point`, `custom` | Hold.pickupKind, Booking.pickupKind |
| NotificationChannel | `sms`, `email` | NotificationLog.channel |
| NotificationStatus | `pending`, `sent`, `failed` | NotificationLog.status |
| OperatorRole | `admin`, `staff` | OperatorUser.role |
| AdminRole | `SUPER_ADMIN`, `FINANCE`, `SUPPORT` | AdminUser.role |
| AdminStatus | `ACTIVE`, `DISABLED` | AdminUser.status |
| PayoutStatus | `requested`, `processing`, `paid`, `failed` | Payout.status |
| LedgerEntryType | `booking_credit`, `platform_fee`, `refund_debit`, `refund_out`, `payout_debit`, `payout_reversal`, `chargeback`, `adjustment`, `tax_withheld` | LedgerEntry.type |
| EInvoiceStatus | `pending`, `issued`, `sent`, `failed`, `cancelled` | EInvoice.status |
| CharterStatus | `SUBMITTED`, `ADMIN_REVIEW`, `ASSIGNED_DIRECT`, `PUBLISHED`, `ACCEPTED`, `DECLINED`, `REJECTED`, `EXPIRED`, `COMPLETED`, `CANCELLED` | CharterRequest.status |
| ComplaintStatus | `open`, `acknowledged`, `in_progress`, `resolved`, `escalated`, `closed` | Complaint.status |
| DataRequestStatus | `received`, `processing`, `completed`, `rejected` | DataRequest.status |
| DataRequestType | `access`, `rectify`, `erase`, `port` | DataRequest.requestType |
| DiscountType | `fixed_amount`, `percentage` | Voucher.discountType |
| RefundReason | `oversold`, `trip_cancelled`, `customer_request`, `payment_error` | Refund.reason |
| RefundStatus | `requested`, `processing`, `completed`, `failed` | Refund.status |
| ReviewStatus | `pending`, `published`, `hidden` | Review.status |
| SubscriptionStatus | `active`, `cancelled`, `expired`, `past_due` | OperatorSubscription.status |

**String-typed documented unions** (not Prisma enums, kept as String for extensibility):

| Field | Values | Notes |
|-------|--------|-------|
| ConsentRecord.consentType | `no_refund`, `pii_storage`, `marketing_sms`, `marketing_email`, `marketing_zns` | Append-only. Decree 91/2020 requires explicit marketing consent. May expand to `cross_border_transfer_vercel`, `cross_border_transfer_resend` |
| FunnelEvent.step | `search_performed`, `hold_created`, `payment_initiated`, `booking_paid` | |
| JobRunLog.status | `success`, `failed`, `skipped_locked` | |
| KybDocument.type | `business_license`, `identity`, `payout_account` | |
| KybDocument.status | `submitted`, `accepted`, `rejected` | |
| StoredObject.purpose | `kyb_doc`, `ticket_pdf` | |
| ContentReport.targetType | `trip`, `route`, `operator` | |
| ContentReport.status | `open`, `resolved` | |
| PayoutAccount.verifyMethod | `name_match`, `micro_deposit` | |
| RecurringGenerationLog.status | `generated`, `skipped`, `failed` | |
| PaymentEvent.adapter | `momo`, `vnpay`, `stub` | |
| Complaint.category | `booking_issue`, `payment_issue`, `service_quality`, `other` | |
| OperatorSettings.notificationPreference | `sms`, `email`, `both` | |
| StaffTripAssignment.role | `driver`, `conductor`, `checker` | |

---

## 4. Relationships

### 4.1 Foreign Key Summary

| Parent | Child | FK Column | Cardinality | Cascade | Notes |
|--------|-------|-----------|-------------|---------|-------|
| Operator | Bus | operatorId | 1:N | default | |
| Operator | OperatorUser | operatorId | 1:N | default | |
| Operator | Route | operatorId | 1:N | Restrict | |
| Operator | Trip | operatorId | 1:N | default | Denormalized |
| Operator | RecurringTripTemplate | operatorId | 1:N | default | |
| Operator | Payout | operatorId | 1:N | default | |
| Operator | LedgerEntry | operatorId | 1:N | default | |
| Operator | FeeConfig | operatorId | 1:N | Restrict | NULL = global default |
| Operator | KybDocument | operatorId | 1:N | Restrict | |
| Operator | PayoutAccount | operatorId | 1:1 | default | `@unique` on FK |
| Operator | OperatorPickupArea | operatorId | 1:N | Cascade | |
| Operator | CharterRequest | assigneeOperatorId | 1:N | SetNull | |
| Operator | EInvoice | operatorId | 1:N | Restrict | |
| Bus | Trip | busId | 1:N | default | |
| Bus | BusMaintenance | busId | 1:N | Cascade | |
| Bus | RecurringTripTemplate | busId | 1:N | default | |
| Route | Trip | routeId | 1:N | default | |
| Route | RecurringTripTemplate | routeId | 1:N | default | |
| Route | RoutePickupArea | routeId | 1:N | Cascade | |
| Place | Route (origin) | originPlaceId | 1:N | SetNull | Relation: "RouteOrigin" |
| Place | Route (dest) | destPlaceId | 1:N | SetNull | Relation: "RouteDest" |
| Place | CharterRequest | originPlaceId | 1:N | SetNull | Relation: "CharterOrigin" |
| Trip | Hold | tripId | 1:N | default | |
| Trip | Booking | tripId | 1:N | default | |
| Trip | Payout | tripId | 1:N | Restrict | |
| Trip | TripPickupArea | tripId | 1:N | Cascade | |
| Trip | RecurringGenerationLog | tripId | 1:N | SetNull | |
| Trip | Trip (paired) | pairedTripId | self-ref | default | "TripPair" relation |
| Trip | StaffTripAssignment | tripId | 1:N | Cascade | |
| Trip | CancellationPolicy | cancellationPolicyId | N:1 | SetNull | |
| RecurringTripTemplate | Trip | recurringTemplateId | 1:N | default | |
| RecurringTripTemplate | RecurringGenerationLog | templateId | 1:N | Cascade | |
| RecurringTripTemplate | TemplatePickupArea | recurringTemplateId | 1:N | Cascade | |
| OperatorPickupArea | TripPickupArea | operatorPickupAreaId | 1:N | Cascade | |
| OperatorPickupArea | TemplatePickupArea | operatorPickupAreaId | 1:N | Cascade | |
| OperatorPickupArea | RoutePickupArea | operatorPickupAreaId | 1:N | Cascade | |
| OperatorPickupArea | Hold | pickupAreaId | 1:N | SetNull | |
| OperatorPickupArea | Booking | pickupAreaId | 1:N | SetNull | |
| Hold | Booking | holdId | 1:1 | Restrict | `@unique` on FK |
| Customer | Session | customerId | 1:N | Cascade | |
| Customer | Booking | customerId | 1:N | SetNull | |
| Customer | CharterRequest | customerId | 1:N | SetNull | |
| OperatorUser | OperatorSession | operatorUserId | 1:N | Cascade | |
| AdminUser | AdminSession | adminUserId | 1:N | Cascade | |
| Booking | ConsentRecord | bookingId | 1:N | Cascade | |
| Booking | PaymentEvent | bookingId | 1:N | default | |
| Booking | LedgerEntry | bookingId | 1:N | Restrict | |
| Booking | NotificationLog | bookingId | 1:N | Cascade | |
| Booking | EInvoice | bookingId | 1:N | Restrict | |
| Booking | Refund | bookingId | 1:N | Restrict | |
| Booking | Review | bookingId | 1:1 | Restrict | `@unique` on FK |
| Booking | VoucherRedemption | bookingId | 1:1 | Restrict | `@unique` on FK |
| Booking | Complaint | bookingId | 1:N | SetNull | |
| Customer | Complaint | customerId | 1:N | SetNull | |
| Customer | DataRequest | customerId | 1:N | SetNull | |
| Customer | Review | customerId | 1:N | SetNull | |
| Operator | CancellationPolicy | operatorId | 1:N | default | |
| Operator | OperatorSettings | operatorId | 1:1 | default | `@unique` on FK |
| Operator | OperatorSubscription | operatorId | 1:1 | default | `@unique` on FK |
| Operator | Review | operatorId | 1:N | default | Denormalized |
| Operator | Voucher | operatorId | 1:N | SetNull | NULL = platform-wide |
| Trip | Review | tripId | 1:N | default | Denormalized |
| OperatorUser | StaffTripAssignment | operatorUserId | 1:N | Cascade | |
| SubscriptionPlan | OperatorSubscription | planId | 1:N | default | |
| Voucher | VoucherRedemption | voucherId | 1:N | Restrict | |

### 4.2 Many-to-Many (via Join Tables)

| Left | Right | Join Table | Unique Constraint |
|------|-------|------------|-------------------|
| Trip | OperatorPickupArea | TripPickupArea | `[tripId, operatorPickupAreaId]` |
| RecurringTripTemplate | OperatorPickupArea | TemplatePickupArea | `[recurringTemplateId, operatorPickupAreaId]` |
| Route | OperatorPickupArea | RoutePickupArea | `[routeId, operatorPickupAreaId]` |
| OperatorUser | Trip | StaffTripAssignment | `[operatorUserId, tripId]` |

---

## 5. Indexes

### 5.1 Prisma-Declared Indexes

| Table | Columns | Type | Used By |
|-------|---------|------|---------|
| Operator | `[id]` | index | Fast PK lookup (explicit) |
| Operator | `[status]` | index | Approval queue, search filter |
| Bus | `[operatorId, licensePlate]` | unique | Plate uniqueness per operator |
| BusMaintenance | `[busId]` | index | Per-bus maintenance lookup |
| Route | `[origin, destination]` | index | Text-based route search |
| Route | `[operatorId]` | index | Operator route listing |
| Route | `[originPlaceId, destPlaceId]` | index | Place-linked route search |
| Place | `[canonicalName]` | index | Name lookup |
| OperatorPickupArea | `[operatorId, isActive]` | index | Active area menu listing |
| TripPickupArea | `[tripId, operatorPickupAreaId]` | unique | Dedup per trip-area pair |
| TripPickupArea | `[tripId, displayOrder]` | index | Ordered listing per trip |
| TemplatePickupArea | `[recurringTemplateId, operatorPickupAreaId]` | unique | Dedup |
| TemplatePickupArea | `[recurringTemplateId, displayOrder]` | index | Ordered listing |
| RoutePickupArea | `[routeId, operatorPickupAreaId]` | unique | Dedup |
| RoutePickupArea | `[routeId, displayOrder]` | index | Ordered listing |
| Trip | `[status, departureAt]` | index | Search/availability queries |
| Trip | `[routeId, departureAt]` | index | Route-based trip lookup |
| Trip | `[operatorId]` | index | Operator trip listing |
| Trip | `[recurringTemplateId]` | index | Template-to-trip lookup |
| Trip | `[pairedTripId]` | index | Paired-trip lookup |
| Hold | `[tripId, status, expiresAt]` | index | Capacity guard, hold lookup |
| Hold | `[expiresAt]` | index | expireHolds cron sweeper |
| Booking | `[tripId, status]` | index | Trip-scoped booking queries |
| Booking | `[confirmationToken]` | index | Token lookup |
| Booking | `[customerId]` | index | Customer booking history |
| Booking | `[tripId, contactStatus]` | index | Operator call-queue |
| Booking | `[tripId, pickedUpAt]` | index | Boarding status queries |
| Booking | `[tripId, customPickupRequested]` | index | Manifest custom-pickup filter |
| Booking | `[status, reminderSentAt]` | index | 24h SMS reminder sweeper |
| Booking | `[buyerPhone]` | index | Guest-booking backfill scan |
| Booking | `[snapshotAnonymizedAt]` | index | PII retention sweeper |
| Booking | `[status, refundedAt]` | index | Oversold-refund reporting |
| Booking | bookingRef | unique | Human-friendly reference |
| Booking | confirmationToken | unique | Single-use confirmation |
| Booking | holdId | unique | 1:1 with Hold |
| ConsentRecord | `[bookingId]` | index | Per-booking consent lookup |
| ConsentRecord | `[consentType, version]` | index | Consent audit query |
| PaymentEvent | `[adapter, providerTxnId]` | unique | PSP idempotency |
| PaymentEvent | `[bookingId]` | index | Per-booking event lookup |
| NotificationLog | `[bookingId, template]` | unique | See section 5.2 for partial unique definition. Null-tolerant: null bookingId rows bypass uniqueness |
| NotificationLog | `[bookingId]` | index | Per-booking notification lookup |
| NotificationLog | `[template, scheduledFor]` | index | Scheduled dispatch cron |
| NotificationLog | `[status, nextAttemptAt]` | index | Notification dispatch cron |
| JobRunLog | `[jobName, startedAt]` | index | Cron run history |
| Customer | phone | unique | Login lookup |
| OtpAttempt | `[phone, createdAt(DESC)]` | index | Latest OTP lookup |
| Session | refreshTokenHash | unique | Token rotation |
| Session | `[customerId]` | index | Per-customer session listing |
| OperatorUser | username | unique | Login key |
| OperatorUser | phone | unique | Phone uniqueness |
| OperatorUser | `[createdAt]` | index | Listing order |
| OperatorUser | `[operatorId]` | index | Per-operator user listing |
| OperatorUser | `[operatorId, role]` | index | Staff listing by role |
| OperatorSession | refreshTokenHash | unique | Token rotation |
| OperatorSession | `[operatorUserId]` | index | Per-user session listing |
| OperatorOtpAttempt | `[phone, createdAt(DESC)]` | index | Latest OTP lookup |
| AdminUser | email | unique | Login key |
| AdminUser | `[email]` | index | Email lookup |
| AdminSession | refreshTokenHash | unique | Token rotation |
| AdminSession | `[adminUserId]` | index | Per-admin session listing |
| Payout | `[tripId]` | index | Per-trip payout lookup |
| Payout | `[status, scheduledAt]` | index | settlePayout cron |
| Payout | `[operatorId, status]` | index | Operator payout dashboard |
| RecurringTripTemplate | `[operatorId]` | index | Operator template listing |
| RecurringTripTemplate | `[routeId]` | index | Route template listing |
| RecurringTripTemplate | `[busId]` | index | Bus template listing |
| RecurringGenerationLog | `[templateId]` | index | Per-template generation history |
| RecurringGenerationLog | `[date]` | index | Date-based generation lookup |
| AdminAuditLog | `[timestamp]` | index | Time-ordered audit trail |
| AdminAuditLog | `[action, timestamp]` | index | Action-filtered audit query |
| ContentReport | `[status, createdAt]` | index | Moderation queue |
| StoredObject | key | unique | Object key lookup |
| StoredObject | `[purpose]` | index | Purpose-filtered listing |
| KybDocument | `[operatorId]` | index | Per-operator doc listing |
| KybDocument | `[purgedAt]` | index | Retention sweeper |
| LedgerEntry | `[sourceEventId]` | unique | Idempotency |
| LedgerEntry | `[operatorId]` | index | Operator ledger query |
| LedgerEntry | `[bookingId]` | index | Per-booking ledger entries |
| LedgerEntry | `[payoutId]` | index | Per-payout ledger entries |
| FeeConfig | `[operatorId, effectiveFrom]` | index | Override resolution |
| FeeConfig | `[effectiveFrom]` | index | Global rate lookup |
| FunnelEvent | `[step, createdAt]` | index | Funnel analytics |
| FunnelEvent | `[sessionId]` | index | Per-session funnel trace |
| CharterRequest | ref | unique | Human-friendly reference |
| CharterRequest | `[status, createdAt]` | index | Admin triage queue |
| CharterRequest | `[assigneeOperatorId]` | index | Operator assignment listing |
| CharterRequest | `[status, acceptByAt]` | index | Direct-assign timeout sweeper |
| CharterRequest | `[status, claimByAt]` | index | Public-pool expiry sweeper |
| EInvoice | `[bookingId]` | index | Per-booking invoice lookup |
| EInvoice | `[operatorId, createdAt]` | index | Operator invoice listing |
| EInvoice | `[status]` | index | Invoice submission cron |
| CancellationPolicy | `[operatorId]` | index | Per-operator policy listing |
| OperatorSettings | operatorId | unique | 1:1 with Operator |
| Complaint | `[status]` | index | Support queue |
| Complaint | `[customerId]` | index | Per-customer complaint history |
| Complaint | `[bookingId]` | index | Per-booking complaints |
| Complaint | `[slaDeadline]` | index | SLA monitor cron |
| DataRequest | `[status]` | index | DSAR processing queue |
| DataRequest | `[customerId]` | index | Per-customer request history |
| Refund | `[status, nextRetryAt]` | index | Refund retry cron |
| Refund | `[bookingId]` | index | Per-booking refund lookup |
| Review | bookingId | unique | One review per booking |
| Review | `[operatorId, createdAt]` | index | Operator review listing |
| Review | `[status]` | index | Moderation queue |
| Voucher | code | unique | Code lookup |
| Voucher | `[operatorId, isActive]` | index | Active voucher listing per operator |
| Voucher | `[validFrom, validUntil]` | index | Validity window filtering |
| VoucherRedemption | bookingId | unique | One voucher per booking |
| VoucherRedemption | `[voucherId]` | index | Per-voucher redemption listing |
| OperatorSubscription | operatorId | unique | One active subscription per operator |
| OperatorSubscription | `[status, nextBillingAt]` | index | Subscription billing cron |
| StaffTripAssignment | `[operatorUserId, tripId]` | unique | Dedup |
| StaffTripAssignment | `[tripId]` | index | Per-trip staff listing |
| StaffTripAssignment | `[operatorUserId]` | index | Per-staff assignment listing |
| KybDocument | `[type, expiryDate]` | index | License expiry alert cron |

### 5.2 SQL-Only Partial Indexes

| Name | Table | SQL Definition | Purpose |
|------|-------|----------------|---------|
| `Customer_email_key` | Customer | `UNIQUE ON ("email") WHERE "email" IS NOT NULL` | Null-tolerant email uniqueness |
| `OtpAttempt_phone_active_key` | OtpAttempt | `UNIQUE ON ("phone") WHERE consumed = false` | At most one active OTP per phone |
| `Bus_operatorId_active_idx` | Bus | `ON ("operatorId") WHERE "deactivatedAt" IS NULL` | Active buses per operator |
| `EInvoice_invoiceNumber_key` | EInvoice | `UNIQUE ON ("invoiceNumber") WHERE "invoiceNumber" IS NOT NULL` | GDT invoice number uniqueness |
| `Booking_einvoiceRef_idx` | Booking | `ON ("einvoiceRef") WHERE "einvoiceRef" IS NOT NULL` | Invoice ref lookups |
| *(unnamed, SQL-only)* | Trip | `UNIQUE ON ("recurringTemplateId", "departureAt") WHERE "recurringTemplateId" IS NOT NULL` | Recurring trip generation dedup |
| `Operator_taxCode_key` | Operator | `UNIQUE ON ("taxCode") WHERE "taxCode" IS NOT NULL` | MST uniqueness (null-tolerant for operators without tax code) |
| `NotificationLog_bookingId_template_key` | NotificationLog | `UNIQUE ON ("bookingId", "template") WHERE "bookingId" IS NOT NULL` | Null-tolerant: null bookingId rows (OTP/system notifications) bypass uniqueness. Replaces Prisma-level `@@unique([bookingId, template])` |

### 5.3 SQL-Only Functional / Expression Indexes

| Name | Table | SQL Definition | Purpose |
|------|-------|----------------|---------|
| `trip_route_unaccent_idx` | Route | `USING GIN (unaccent_immutable(lower(origin)) gin_trgm_ops, unaccent_immutable(lower(destination)) gin_trgm_ops)` | Vietnamese diacritic-insensitive route search. Requires extensions `pg_trgm` + `unaccent` and the `unaccent_immutable(text)` wrapper function (IMMUTABLE, required by GIN). |

---

## 6. Constraints

### 6.1 CHECK Constraints (SQL-Only)

| Name | Table | SQL | Purpose |
|------|-------|-----|---------|
| `Hold_custom_requires_detail` | Hold | `NOT "customPickupRequested" OR ("pickupDetail" IS NOT NULL AND length(btrim("pickupDetail")) >= 5)` | Custom pickup requires non-blank detail >= 5 trimmed chars |
| `Booking_custom_requires_detail` | Booking | `NOT "customPickupRequested" OR ("pickupDetail" IS NOT NULL AND length(btrim("pickupDetail")) >= 5)` | Same as Hold |
| `Booking_einvoice_consistency` | Booking | `("einvoiceRef" IS NULL) = ("einvoiceIssuedAt" IS NULL)` | einvoiceRef and einvoiceIssuedAt must be both set or both null (GDT compliance) |
| `Review_rating_range` | Review | `"rating" >= 1 AND "rating" <= 5` | Star rating must be 1-5 |

**Dropped:** `OperatorUser_phones_differ` -- was added in Issue 010, dropped in Issue 020 (contactPhone and notificationPhone may equal phone for a single person).

### 6.2 Immutability Triggers

| Table | Triggers | Function | Blocked Operations |
|-------|----------|----------|--------------------|
| LedgerEntry | `ledger_entry_no_update`, `ledger_entry_no_delete` | `ledger_entry_immutable()` | UPDATE and DELETE. Append-only via trigger (not role REVOKE) |
| AdminAuditLog | `admin_audit_log_no_update`, `admin_audit_log_no_delete` | `admin_audit_log_immutable()` | UPDATE and DELETE. Append-only |
| ConsentRecord | `consent_record_no_update` | `consent_record_immutable()` | UPDATE only. DELETE is allowed (Booking CASCADE must propagate) |

All triggers use `BEFORE` timing and `RAISE EXCEPTION` to block the operation.

### 6.3 Application-Enforced Invariants

| ID | Rule | Enforcement |
|----|------|-------------|
| I1 | Every read-then-write uses `$transaction` callback + `SELECT FOR UPDATE` | Application code. `$transaction(async (tx) => { tx.$queryRaw... FOR UPDATE; ... })` |
| I7 | `totalVnd = (Trip.price * ticketCount) - discountVnd`, server-computed, never from client | Application code at booking initiation. `discountVnd` default 0. Operator-side `/api/op/**` endpoints are I7-exempt (operator is price authority) |
| I8 | LedgerEntry is append-only | DB trigger (section 6.2) + application never issues UPDATE/DELETE |
| I9 | `NotificationLog.payload` must NOT contain phone/PII; `recipient` is the sole PII column | Application code. Logger redaction list |
| I10 | All currency math in BigInt domain | Application code (`BigInt()` constructor calls, not `1n` literals -- ES2017 target) |
| I11 | T+1 settlement delay (completedAt + 1 day) | Payout scheduling logic |
| Capacity | Conditional INSERT checks `capacity - active_holds - paid_bookings - awaiting_payment_within_PSP_window >= ticketCount` | Advisory locks + conditional INSERT (section 11) |
| Bus overlap | Same bus cannot serve overlapping trips: `[departureAt, departureAt + durationMinutes + 60min buffer]` | Application code in trip creation `$transaction` |
| Maintenance overlap | Trips cannot overlap `[maintenanceStart, maintenanceEnd]` window | Application code: `maintenanceStart <= tripEnd AND maintenanceEnd >= tripStart` |
| Verb-At + status | Every timestamp column corresponding to a state transition (e.g. `departedAt` -> `status='departed'`) must be written in the same `tx.model.update` call | Application code convention. DTO union must include the status |
| PayoutAccount verification reset | Editing any PayoutAccount field resets `verifiedAt` and `verifyMethod` to null | Application code in update handler |
| Booking checkedInAt | SET-ONCE via atomic conditional UPDATE (`WHERE "checkedInAt" IS NULL`) | Application code |
| Booking checkedInAt vs noShowAt | Mutually exclusive -- a checked-in passenger cannot be no-showed | Application code |

---

## 7. State Machines

### 7.1 Trip

```
scheduled ──> departed ──> completed
    |              |
    v              v
 cancelled     cancelled
                   ^
                   |
              completed ──> cancelled
```

| From | To | Guard | Timestamp |
|------|----|-------|-----------|
| scheduled | departed | -- | `departedAt = now()` |
| scheduled | cancelled | -- | `cancelledAt = now()`, set `cancelReason` |
| departed | completed | -- | `completedAt = now()` |
| departed | cancelled | -- | `cancelledAt = now()` |
| completed | cancelled | -- | `cancelledAt = now()` |

**Orthogonal flag:** `salesClosed` (Boolean) blocks further holds/bookings independently of status.

**Idempotent cancel:** Second cancel returns `{ trip, alreadyCancelled: true }` with HTTP 200 (discriminated result, not thrown sentinel).

### 7.2 Booking

| From | To | Guard | Notes |
|------|----|-------|-------|
| awaiting_payment | paid | PSP webhook confirms payment | Capacity L2 recount under FOR UPDATE |
| awaiting_payment | payment_failed_expired | PSP failure or PSP_WINDOW timeout | Terminal |
| paid | completed | Trip completed + boarding | Terminal |
| paid | trip_cancelled | Trip cancelled by operator | Terminal |
| paid | no_show | Operator marks no-show | `noShowAt = now()`. Mutually exclusive with checkedInAt |
| paid | refunded | Oversold-race refund | `refundedAt = now()`. Terminal |
| paid | cancelled | Customer cancellation (if allowed) | Terminal |

**Terminal states:** completed, cancelled, trip_cancelled, no_show, payment_failed_expired, refunded.

### 7.3 Hold

| From | To | Guard | Notes |
|------|----|-------|-------|
| active | consumed | Booking initiated from this hold | Terminal |
| active | expired | `expiresAt < NOW()` (cron sweeper) | Terminal |
| active | cancelled_trip | Trip cancelled while hold active | Terminal |

All non-active states are terminal.

### 7.4 Payout

| From | To | Guard | Notes |
|------|----|-------|-------|
| requested | processing | Payout rail picks up | |
| processing | paid | Transfer confirmed | `settledAt = now()`. Terminal |
| processing | failed | Transfer failed | `failureReason` set |
| failed | requested | Manual retry | |

**Terminal state:** paid.

### 7.5 Operator

| From | To | Guard |
|------|----|-------|
| PENDING_REVIEW | UNDER_REVIEW | Admin begins review |
| UNDER_REVIEW | APPROVED | Admin approves. `disabledAt` cleared |
| UNDER_REVIEW | REJECTED | Admin rejects. `rejectionReason` set |
| REJECTED | PENDING_REVIEW | Operator resubmits |
| APPROVED | SUSPENDED | Admin suspends. `disabledAt = now()` |
| SUSPENDED | APPROVED | Admin reinstates. `disabledAt` cleared |

### 7.6 EInvoice

| From | To | Guard | Notes |
|------|----|-------|-------|
| pending | issued | Vendor confirms | `issuedAt = now()`, `invoiceNumber` set |
| pending | failed | Vendor rejects | Terminal |
| issued | sent | Delivery confirmed | |
| issued | cancelled | Correction needed | Creates new row |
| sent | cancelled | Correction needed | Creates new row |

**Terminal states:** sent (successful delivery), failed, cancelled.

### 7.7 CharterRequest

| From | To | Guard |
|------|----|-------|
| SUBMITTED | ADMIN_REVIEW | Admin picks up |
| SUBMITTED | CANCELLED | Customer cancels |
| ADMIN_REVIEW | ASSIGNED_DIRECT | Admin assigns to operator. `assigneeOperatorId` + `acceptByAt` set |
| ADMIN_REVIEW | PUBLISHED | Admin publishes to pool. `publishedAt` + `claimByAt` set |
| ADMIN_REVIEW | REJECTED | Admin declines. `rejectionReason` set |
| ADMIN_REVIEW | CANCELLED | Customer cancels |
| ASSIGNED_DIRECT | ACCEPTED | Operator accepts |
| ASSIGNED_DIRECT | DECLINED | Operator declines. `assigneeOperatorId` cleared |
| ASSIGNED_DIRECT | ADMIN_REVIEW | Timeout re-route |
| ASSIGNED_DIRECT | CANCELLED | Customer cancels |
| PUBLISHED | ACCEPTED | Operator claims |
| PUBLISHED | EXPIRED | `claimByAt < NOW()` (sweeper). `assigneeOperatorId` cleared |
| PUBLISHED | CANCELLED | Customer cancels |
| DECLINED | ADMIN_REVIEW | Auto re-route |
| EXPIRED | ADMIN_REVIEW | Auto re-route |
| ACCEPTED | COMPLETED | Deal completed off-platform |
| ACCEPTED | CANCELLED | Either party cancels |

**Terminal states:** REJECTED, COMPLETED, CANCELLED.

### 7.8 Complaint

```
open ──> acknowledged ──> in_progress ──> resolved ──> closed
  |           |                |
  v           v                v
escalated  escalated       escalated ──> in_progress
```

| From | To | Guard | Notes |
|------|----|-------|-------|
| open | acknowledged | Admin acknowledges | `acknowledgedAt = now()` |
| open | escalated | SLA breach or manual | `escalatedAt = now()` |
| acknowledged | in_progress | Work begins | `assignedTo` set |
| acknowledged | escalated | SLA breach or manual | `escalatedAt = now()` |
| in_progress | resolved | Resolution recorded | `resolvedAt = now()`, `resolution` set |
| in_progress | escalated | Escalation needed | `escalatedAt = now()` |
| escalated | in_progress | De-escalated / reassigned | |
| resolved | closed | Final closure | |

**Terminal state:** closed.

### 7.9 DataRequest

| From | To | Guard | Notes |
|------|----|-------|-------|
| received | processing | Admin begins work | `acknowledgedAt = now()` |
| received | rejected | Invalid/unverifiable request | |
| processing | completed | Request fulfilled | `completedAt = now()`, `responseRef` set |
| processing | rejected | Cannot fulfill | |

**Terminal states:** completed, rejected.

### 7.10 Refund

| From | To | Guard | Notes |
|------|----|-------|-------|
| requested | processing | PSP refund initiated | |
| processing | completed | PSP confirms refund | `completedAt = now()`. Creates LedgerEntry refund_debit + refund_out |
| processing | failed | PSP refund fails | `failureReason` set, `retryCount++`, `nextRetryAt` computed |
| failed | requested | Retry (manual or cron) | |

**Terminal state:** completed.

### 7.11 OperatorSubscription

| From | To | Guard | Notes |
|------|----|-------|-------|
| active | cancelled | Operator cancels | Access continues until `endsAt` |
| active | past_due | Payment fails on billing cycle | |
| active | expired | `endsAt < NOW()` (non-renew) | |
| past_due | active | Payment retried successfully | |
| past_due | cancelled | Grace period exceeded | |
| cancelled | expired | `endsAt < NOW()` | |

**Terminal state:** expired.

---

## 8. Soft-Delete & Data Lifecycle

### 8.1 Deletion Strategy per Entity

| Entity | Strategy | Column(s) | Notes |
|--------|----------|-----------|-------|
| Customer | Soft-delete | `deletedAt`, `anonymizedAt` | Phone set to NULL. Partial unique on phone WHERE deletedAt IS NULL. Use `findFirst` with `deletedAt: null`, not `findUnique` |
| Trip | Admin soft-hide | `moderatedAt` | Hidden from search + direct links. Distinct from operator `salesClosed` |
| Route | Operator deactivation + admin soft-hide | `deactivatedAt`, `moderatedAt` | Two independent soft-disable axes |
| Bus | Operator deactivation | `deactivatedAt` | |
| OperatorPickupArea | Logical deactivation | `isActive = false` | Deactivate, never delete (historical bookings reference) |
| AdminUser | Status disable | `status = DISABLED` | Not timestamp-based |
| OperatorUser | Disable | `disabledAt` | |
| KybDocument | Purge marker | `purgedAt` | Storage object removed; pointer row retained as audit trail |
| DataRequest | Status-based lifecycle | `status` | DSAR drives the erasure path: `erase` type triggers Customer soft-delete + PII anonymization |
| EInvoice | Append new row | `status = cancelled` | Cancelled invoices are never deleted; corrections create new rows |
| Booking | PII anonymization | `snapshotAnonymizedAt` | Money/audit columns (totalVnd, status, ticketCount, ledger) retained through scrub |

### 8.2 PII Tiers (Vietnam PDPL-Aligned)

| Tier | Classification | Examples | Protection |
|------|---------------|----------|------------|
| T0 | Public / anonymous | FunnelEvent, Place, ContentReport | No special handling |
| T1 | Basic personal | Customer.phone/email/displayName, Booking.buyerName/buyerPhone/buyerEmail, OtpAttempt.phone, NotificationLog.recipient, CharterRequest.contact* | Log-redacted. 24-month minimum retention |
| T2 | Sensitive | PaymentEvent.rawBody, PayoutAccount.accountNumber, AdminUser.totpSecret, LedgerEntry financials, KybDocument evidence | AES-256-GCM encrypt at rest. accountNumber is go-live blocker |

### 8.3 Retention Periods

| Data | Retention | Sweeper |
|------|-----------|---------|
| Guest booking PII (buyerName/Phone/Email) | Anonymize after configurable retention window past Trip.departureAt | `piiAnonymization` daily cron; predicate: `snapshotAnonymizedAt IS NULL` + Trip departure window |
| Customer account PII | Anonymized on soft-delete (phone -> NULL, anonymizedAt set) | On-demand (account deletion flow) |
| KybDocument storage objects | Purge 90 days after operator REJECTED/SUSPENDED | Retention sweeper; predicate: `purgedAt IS NULL` |
| OtpAttempt rows | Naturally expire via `expiresAt` (5min / 15min) | No active sweeper; rows become inert |
| Session / OperatorSession / AdminSession | Expire via `expiresAt`; revokedAt marks revoked | Application auth layer checks both |

---

## 9. Tenant Isolation

### 9.1 Operator-Scoped Tables

Every query on these tables MUST include an `operatorId` filter derived from the JWT claim, never from the request body.

| Table | FK Column | Notes |
|-------|-----------|-------|
| Bus | operatorId | |
| Route | operatorId | |
| Trip | operatorId | Denormalized from Route |
| Booking | (via Trip.operatorId) | No direct FK; scoped via Trip join |
| Hold | (via Trip.operatorId) | No direct FK; scoped via Trip join |
| OperatorUser | operatorId | |
| OperatorPickupArea | operatorId | |
| LedgerEntry | operatorId | |
| Payout | operatorId | |
| FeeConfig | operatorId | NULL = global default |
| PayoutAccount | operatorId | `@unique` |
| KybDocument | operatorId | |
| EInvoice | operatorId | |
| RecurringTripTemplate | operatorId | |
| CancellationPolicy | operatorId | |
| OperatorSettings | operatorId | `@unique` 1:1 |
| OperatorSubscription | operatorId | `@unique` |
| StaffTripAssignment | (via OperatorUser.operatorId) | No direct FK; scoped via OperatorUser join |

### 9.2 Global / Unscoped Tables

| Table | Notes |
|-------|-------|
| Place | Global registry, admin-managed |
| Customer | Cross-operator; bookings link to trips (which are operator-scoped) |
| PaymentEvent | Linked to Booking (which is trip-scoped) |
| AdminAuditLog | Platform-level audit trail |
| AdminUser / AdminSession | Platform admin realm |
| ConsentRecord | Linked to Booking |
| FunnelEvent | Anonymous analytics |
| ContentReport | Platform moderation |
| StoredObject | Object metadata (linked via key, not operatorId) |
| FeatureFlag | Platform-level runtime config |
| CharterRequest | Cross-operator lead-gen (assigned operator is nullable) |
| JobRunLog | Platform cron metadata |
| NotificationLog | Linked to Booking (which is trip-scoped) |
| Complaint | Admin-managed customer support |
| DataRequest | DSAR compliance, admin-managed |
| Review | Cross-domain: customer writes, operator reads, admin moderates. Operator FK denormalized for reads |
| Voucher | Platform-wide when operatorId IS NULL; operator-scoped when non-null |
| VoucherRedemption | Linked to Booking (which is trip-scoped) |
| SubscriptionPlan | Platform-level plan definitions |
| Refund | Linked to Booking (which is trip-scoped) |

### 9.3 Scope Enforcement

- Operator-side API routes (`/api/op/**`) extract `operatorId` from the verified JWT access token.
- Every Prisma query on operator-scoped tables uses `withOperatorScope` (or equivalent manual `where: { operatorId }`) before any data access.
- The `operatorId` is NEVER accepted from the request body for read/write operations. It is only set by admin provisioning routes.
- Admin routes (`/api/admin/**`) may access any operator's data by explicitly providing `operatorId` as a path/query parameter.

---

## 10. Currency & Money

### 10.1 Storage Rules

| Rule | Detail |
|------|--------|
| Currency | VND (Vietnamese Dong). No sub-unit (dong is the smallest unit) |
| Per-record storage | `Int` (32-bit, max 2,147,483,647 VND ~ 2.1 billion). Sufficient for individual ticket prices and per-booking totals |
| Aggregate storage | `BigInt` for LedgerEntry.amount (signed, can represent large operator balances) |
| No DECIMAL/FLOAT | All monetary columns are integer types. No floating-point anywhere in the money path |
| Column type | `@db.Uuid` is NOT used for money -- UUID is for Booking.id and PaymentEvent.id only |

### 10.2 Computation Rules

| Rule | Detail |
|------|--------|
| Total computation | `totalVnd = (Trip.price * ticketCount) - discountVnd` (server-computed, invariant I7). `discountVnd` defaults to 0 when no voucher applied |
| Fee computation | `feeAmount = amount * ratePpm / 1_000_000` in BigInt domain. `ratePpm` is parts-per-million (60000 = 6%). Default 6%. Floor 5%, ceiling 20%. ADR-006 aspirational band of 8-10% superseded by market-validated 6% |
| BigInt domain | All multiplication of integer minor-unit by fractional rate MUST use `BigInt()` constructor calls (not `1n` literals -- ES2017 target). `Math.round(int * fractional)` is a bug |
| Half-even rounding | Exact ties detected via `remainder * BigInt(2) === denominator` in BigInt. Only `Number()` the final integer result |
| Operator balance | Derived by summing LedgerEntry.amount WHERE operatorId = X. NEVER stored as a column |
| Tax withholding | `taxClassification = individual_household` -> 4.5% withheld (Decree 117/2025). `company` = exempt |
| Fee encoding | `FeeConfig.ratePpm` Int. Resolution: active OperatorSubscription.plan.ratePpm -> per-operator FeeConfig (non-null operatorId) -> global FeeConfig (null operatorId), effective-dated |
| Aggregation safety | `Booking.totalVnd` (Int) is sufficient for per-record values (max ~2.1B VND). Aggregation queries must cast to BigInt: `SUM(CAST("totalVnd" AS BIGINT))`. LedgerEntry.amount is already BigInt |

### 10.3 Payout Amounts

| Field | Type | Notes |
|-------|------|-------|
| Payout.gross | Int | Total booking revenue for the trip/withdrawal |
| Payout.platformFee | Int | Platform fee deducted |
| Payout.net | Int | `gross - platformFee - taxTotal` |
| Payout.taxVat | Int | VAT withheld (default 0) |
| Payout.taxPit | Int | PIT withheld (default 0) |
| Payout.taxTotal | Int | Sum of tax withholdings (default 0) |

---

## 11. Concurrency Control

### 11.1 Locking Strategy

| Mechanism | Where Used | Detail |
|-----------|-----------|--------|
| `SELECT ... FOR UPDATE` | Capacity guard, trip cancel, bus capacity reduction, payout processing | Always inside `$transaction(async (tx) => { ... })` callback form (NOT array form). Locks the gating row to serialize concurrent writers |
| Advisory locks (two-tier) | Hold creation | Phone-first lock then trip lock. Prevents double-hold by same phone and serializes capacity checks |
| Conditional INSERT | Hold creation | INSERT with subquery checking `capacity - active_holds - paid_bookings - awaiting_payment >= ticketCount`. Zero rows returned = capacity exhausted |
| Atomic conditional UPDATE | Booking check-in | `WHERE "checkedInAt" IS NULL` ensures set-once semantics |
| `ON CONFLICT DO NOTHING` | Booking initiation | `holdId` unique constraint; second initiation is a no-op |

### 11.2 Three-Layer Capacity Guard

| Layer | When | Mechanism |
|-------|------|-----------|
| L1 | Hold creation | Conditional INSERT + advisory lock on trip. Checks `capacity - blockedSeats - COUNT(active holds) - COUNT(paid/awaiting_payment bookings) >= ticketCount` |
| L2 | Payment confirmation | `SELECT FOR UPDATE` on Trip row, recount all holds + bookings, confirm capacity still available |
| L3 | Per-phone cap | Application-enforced limit on active holds per phone per trip |

### 11.3 Capacity Formula (Computed, Not Stored)

```
available = Bus.capacity
          - Trip.blockedSeats
          - COUNT(Hold WHERE tripId = X AND status = 'active')
          - COUNT(Booking WHERE tripId = X AND status = 'paid')
          - COUNT(Booking WHERE tripId = X AND status = 'awaiting_payment'
                  AND createdAt >= NOW() - PSP_WINDOW)
```

`PSP_WINDOW` = 20 minutes. `Hold TTL` = 10 minutes.

### 11.4 Bus Overlap Detection

```sql
-- Window: [departureAt, departureAt + durationMinutes + 60 min buffer]
SELECT id FROM "Trip"
WHERE "busId" = $busId
  AND status != 'cancelled'
  AND "departureAt" < $newEnd
  AND ("departureAt" + ("route"."durationMinutes" + 60) * interval '1 minute') > $newStart
```

Executed inside the trip-creation `$transaction`, after maintenance check, before `trip.create`.

### 11.5 Transaction Rules

- Always use callback form: `prisma.$transaction(async (tx) => { ... })`. The array form provides no `tx` handle for raw SQL.
- CUIDs are TEXT -- no `::uuid` cast in raw SQL.
- The lead's own happy-path test will pass without locks; a concurrent-write integration test is required in the same commit.

---

## 12. Cron Table Dependencies

| Job | Schedule | Table | Predicate (WHERE) | Required Index | Action |
|-----|----------|-------|-------------------|----------------|--------|
| expireHolds | 1 min | Hold | `status = 'active' AND expiresAt < NOW()` | `[tripId, status, expiresAt]`, `[expiresAt]` | Set status -> 'expired' |
| notificationDispatch | 1 min | NotificationLog | `status = 'pending' AND (nextAttemptAt IS NULL OR nextAttemptAt <= NOW())` | `[status, nextAttemptAt]` | Attempt delivery; update status/attemptCount/nextAttemptAt |
| settlePayout | 5 min | Payout | `status = 'requested' AND scheduledAt <= NOW()` | `[status, scheduledAt]` | Transition to 'processing', initiate bank transfer |
| autoCompleteTrips | 15 min | Trip | `status = 'departed'` | `[status, departureAt]` | Transition to 'completed' after arrival window |
| charterExpirySweeper (direct-assign) | 15 min | CharterRequest | `status = 'ASSIGNED_DIRECT' AND acceptByAt < NOW()` | `[status, acceptByAt]` | Re-route to ADMIN_REVIEW |
| charterExpirySweeper (pool) | 15 min | CharterRequest | `status = 'PUBLISHED' AND claimByAt < NOW()` | `[status, claimByAt]` | Re-route to ADMIN_REVIEW |
| einvoiceSubmission | 5 min | EInvoice | `status = 'pending'` | `[status]` | Submit to MISA/vendor API |
| ticketPdfGeneration | 5 min | Booking | `status = 'paid' AND ticketPdfKey IS NULL` | `[tripId, status]` | Generate + upload PDF, set ticketPdfKey |
| 24hSmsReminder | periodic | Booking | `status IN ('paid', 'awaiting_payment') AND reminderSentAt IS NULL` + Trip.departureAt within 24h window | `[status, reminderSentAt]` | Send SMS reminder, set reminderSentAt |
| generateFromTemplate | daily | RecurringTripTemplate + RecurringGenerationLog | Active templates (`deactivatedAt IS NULL`, within validFrom/validUntil), dedup via GenerationLog | `RecurringTripTemplate[operatorId]`, `RecurringGenerationLog[templateId]`, `RecurringGenerationLog[date]` | Generate Trip rows for 14-day horizon |
| operatorLicenseAlert | daily | KybDocument | `type = 'business_license' AND expiryDate IS NOT NULL AND expiryDate <= NOW() + 60 days AND expiryAlertSentAt IS NULL` | `KybDocument[type, expiryDate]` | Send expiry warning notification, set expiryAlertSentAt |
| piiAnonymization | daily | Booking + Customer | Booking: `snapshotAnonymizedAt IS NULL` + Trip departure past retention window. Customer: retention policy | `Booking[snapshotAnonymizedAt]` | Scrub PII fields to masked placeholders |
| kybDocumentPurge | periodic | KybDocument | `purgedAt IS NULL` + operator REJECTED/SUSPENDED for 90+ days | `KybDocument[purgedAt]` | Remove storage object, set purgedAt |
| scheduledNotificationDispatch | periodic | NotificationLog | `template = 'payout_scheduled' AND scheduledFor <= NOW()` | `[template, scheduledFor]` | Dispatch scheduled payout notifications |
| complaintSlaMon | hourly | Complaint | `status IN ('open', 'acknowledged', 'in_progress') AND slaDeadline <= NOW()` | `Complaint[slaDeadline]` | Escalate overdue complaints, notify admin |
| refundRetry | 5 min | Refund | `status = 'failed' AND nextRetryAt <= NOW()` | `Refund[status, nextRetryAt]` | Retry failed PSP refunds. Reset status to 'requested' |
| subscriptionBilling | daily | OperatorSubscription | `status = 'active' AND nextBillingAt <= NOW()` | `OperatorSubscription[status, nextBillingAt]` | Process billing cycle. Transition to past_due on failure |

Each cron job logs its execution to `JobRunLog` with status ('success', 'failed', 'skipped_locked') and `rowsAffected` count.

---

## Appendix A: PostgreSQL Extensions Required

| Extension | Purpose |
|-----------|---------|
| `pg_trgm` | Trigram similarity matching for Vietnamese route search |
| `unaccent` | Diacritic removal for Vietnamese text normalization |

Custom function: `unaccent_immutable(text) RETURNS text` -- IMMUTABLE wrapper around `unaccent('unaccent', $1)`, required because built-in `unaccent()` is STABLE (insufficient for GIN index expressions).

## Appendix B: Primary Key Strategy

All entities use CUID (`@default(cuid())`) as primary key except:

| Table | PK Strategy | Notes |
|-------|-------------|-------|
| Booking | UUID (`@db.Uuid`) | Application-generated UUID, not CUID |
| PaymentEvent | UUID (`@default(dbgenerated("gen_random_uuid()"))`, `@db.Uuid`) | DB-generated UUID |
| FeatureFlag | Natural key (`key String @id`) | Flag key is the PK (e.g. 'rail.momo.enabled') |

CUIDs are TEXT in PostgreSQL. Never cast with `::uuid` in raw SQL.
