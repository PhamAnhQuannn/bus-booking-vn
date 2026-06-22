# 04 - Prisma Migrations Catalog

Complete chronological record of all committed Prisma migrations in `prisma/migrations/`.

**Forward-only rule:** committed migrations are never edited. Schema corrections are applied via new forward migrations (see CLAUDE.md / Mistake Log Issue 012).

---

## Phase 1: Core Domain (2026-05-17 to 2026-05-18)

### 20260517221513_init

Foundation schema. Creates the core bus-booking domain tables and extensions.

| Operation | Detail |
|-----------|--------|
| Extension | `pg_trgm`, `unaccent` + immutable wrapper `unaccent_immutable(text)` for Vietnamese diacritic-insensitive search |
| Enum | `TripStatus` (`scheduled`, `departed`, `completed`, `cancelled`) |
| Table | `Operator` (id, legalName, contactPhone, contactEmail, disabledAt, createdAt) |
| Table | `Bus` (id, operatorId, capacity, plateNumber, maintenanceStart, maintenanceEnd) |
| Table | `Route` (id, origin, destination, createdAt) |
| Table | `Trip` (id, routeId, busId, departureAt, price, status, salesClosed) |
| Index | `Operator_id_idx`, `Bus_plateNumber_key` (unique), `Bus_operatorId_idx` |
| Index | `Route_origin_destination_idx` (composite) |
| Index | `Trip_status_departureAt_idx`, `Trip_routeId_departureAt_idx` (composite) |
| Index | `trip_route_unaccent_idx` -- GIN trigram on Route for diacritic-insensitive search (SQL-only, uses expression index) |
| FK | Bus -> Operator, Trip -> Route, Trip -> Bus (all RESTRICT) |

### 20260518004149_add_hold_model

Seat-hold mechanism for the booking flow.

| Operation | Detail |
|-----------|--------|
| Enum | `HoldStatus` (`active`, `converted`, `expired`, `cancelled_trip`) |
| ALTER | Trip: add `blockedSeats INTEGER NOT NULL DEFAULT 0` |
| Table | `Hold` (id, tripId, ticketCount, customerPhone, customerName, expiresAt, status, createdAt) |
| Index | `Hold_tripId_status_expiresAt_idx` (composite), `Hold_expiresAt_idx` |
| FK | Hold -> Trip (RESTRICT) |

### 20260518052219_booking_v1

Booking model, notifications, and payment method enums.

| Operation | Detail |
|-----------|--------|
| Enum | `BookingStatus` (8 values incl. `awaiting_payment`, `pending_cash_payment`, `paid_operator_notified`, etc.) |
| Enum | `PaymentMethod` (`cash`, `momo`, `zalopay`, `card`) |
| Enum | `NotificationChannel` (`sms`) |
| Enum | `NotificationStatus` (`pending`, `sent`, `failed`) |
| ALTER | Operator: add `notificationPhone TEXT` |
| Table | `Booking` (id UUID, bookingRef, confirmationToken, tripId, holdId, buyerName, buyerPhone, ticketCount, totalVnd, paymentMethod, paymentExternalRef, status, isManual, createdAt) |
| Table | `NotificationLog` (id, bookingId, channel, template, recipient, payload, status, externalRef, sentAt, createdAt) |
| Index | `Booking_bookingRef_key` (unique), `Booking_confirmationToken_key` (unique), `Booking_holdId_key` (unique) |
| Index | `Booking_tripId_status_idx`, `Booking_confirmationToken_idx`, `NotificationLog_bookingId_idx` |
| FK | Booking -> Trip (RESTRICT), Booking -> Hold (RESTRICT), NotificationLog -> Booking (CASCADE) |

### 20260518161139_issue_004_payment_event

**Issue 004.** Webhook event log for payment processors.

| Operation | Detail |
|-----------|--------|
| Table | `PaymentEvent` (id UUID default gen_random_uuid(), bookingId, adapter, externalRef, rawBody, resultCode, receivedAt) |
| Index | `PaymentEvent_bookingId_idx`, `PaymentEvent_adapter_externalRef_key` (unique composite) |
| FK | PaymentEvent -> Booking (RESTRICT) |

---

## Phase 2: Auth & Account Management (2026-05-19)

### 20260519003311_issue_007_auth

**Issue 007.** Customer authentication: OTP, sessions, customer accounts.

| Operation | Detail |
|-----------|--------|
| ALTER | Booking: add `customerId TEXT` (nullable FK) |
| Table | `Customer` (id, phone, email, passwordHash, displayName, createdAt, updatedAt, lastLoginAt) |
| Table | `OtpAttempt` (id, phone, codeHash, salt, expiresAt, consumed, consumedAt, attemptCount, createdAt, ipAddress) |
| Table | `Session` (id, customerId, refreshTokenHash, tokenFamily, rotationCount, expiresAt, createdAt, revokedAt) |
| Index | `Customer_phone_key` (unique), `Session_refreshTokenHash_key` (unique) |
| **Partial index** | `Customer_email_key` -- unique WHERE email IS NOT NULL (SQL-only) |
| **Partial unique** | `OtpAttempt_phone_active_key` -- unique on phone WHERE consumed = false (SQL-only) |
| Index | `OtpAttempt_phone_createdAt_idx` (composite, createdAt DESC) |
| Index | `Session_customerId_idx`, `Booking_customerId_idx` (FK indices) |
| FK | Booking -> Customer (SET NULL), Session -> Customer (CASCADE) |

### 20260519033000_issue_008_account_management

**Issue 008.** Customer soft-delete / anonymization support.

| Operation | Detail |
|-----------|--------|
| ALTER | Customer: `phone` DROP NOT NULL (freed phone allows re-registration) |
| ALTER | Customer: add `deletedAt`, `anonymizedAt` (nullable timestamps) |

### 20260519042901_issue_010_operator_auth

**Issue 010.** Operator authentication realm (separate from customer auth).

| Operation | Detail |
|-----------|--------|
| Enum | `OperatorRole` (`admin`) |
| Table | `OperatorUser` (id, phone, contactPhone, notificationPhone, passwordHash, requiresPasswordChange, displayName, role, disabledAt, createdAt, updatedAt) |
| Table | `OperatorSession` (id, operatorUserId, refreshTokenHash, tokenFamily, rotationCount, expiresAt, createdAt, revokedAt) |
| Table | `OperatorOtpAttempt` (id, phone, codeHash, salt, expiresAt, consumed, consumedAt, attemptCount, createdAt, ipAddress) |
| Index | `OperatorUser_phone_key` (unique), `OperatorUser_createdAt_idx` |
| Index | `OperatorSession_refreshTokenHash_key` (unique), `OperatorSession_operatorUserId_idx` |
| Index | `OperatorOtpAttempt_phone_createdAt_idx` (composite, createdAt DESC) |
| FK | OperatorSession -> OperatorUser (CASCADE) |

### 20260519042906_issue_010_operator_auth (companion)

**Issue 010.** SQL-only constraints for operator auth.

| Operation | Detail |
|-----------|--------|
| **Partial unique** | `OperatorOtpAttempt_phone_active_key` -- unique on phone WHERE consumed = false (SQL-only) |
| **CHECK constraint** | `OperatorUser_phones_differ` -- contactPhone <> notificationPhone (SQL-only; later dropped in 20260520010000) |

---

## Phase 3: Operator Domain (2026-05-19)

### 20260519012518_issue_012_routes_pickup_points

**Issue 012.** Route operator scoping + PickupPoint model.

| Operation | Detail |
|-----------|--------|
| ALTER | Route: add `operatorId` (nullable -> backfill -> NOT NULL), `durationMinutes` (nullable -> backfill -> NOT NULL), `deactivatedAt`, `updatedAt` |
| Backfill | Route.operatorId derived from Trip -> Bus -> Operator chain; fallback to first operator |
| Backfill | Route.durationMinutes default 240 (4 hours) |
| Table | `PickupPoint` (id, routeId, name, address, displayOrder, deactivatedAt, createdAt, updatedAt) |
| **Partial index** | `Route_operatorId_deactivatedAt_idx` -- WHERE deactivatedAt IS NULL (SQL-only) |
| **Partial index** | `PickupPoint_routeId_deactivatedAt_idx` -- WHERE deactivatedAt IS NULL (SQL-only) |
| Index | `Route_operatorId_idx`, `PickupPoint_routeId_displayOrder_idx` |
| FK | Route -> Operator (RESTRICT), PickupPoint -> Route (CASCADE) |

### 20260519043000_issue_011_operator_fleet

**Issue 011.** Operator fleet management: bus types, maintenance, operator user scoping.

| Operation | Detail |
|-----------|--------|
| Enum | `BusType` (`coach`, `sleeper`, `limousine`) |
| ALTER | Bus: add `busType` (nullable -> backfill 'coach' -> NOT NULL), `deactivatedAt`; rename `plateNumber` -> `licensePlate` |
| Table | `BusMaintenance` (id, busId, startAt, endAt, reason, createdAt) |
| ALTER | OperatorUser: add `operatorId` (nullable -> backfill -> NOT NULL) |
| **Fail-fast gate** | PL/pgSQL DO block verifying zero NULL rows before NOT NULL promotion |
| **Partial index** | `Bus_operatorId_active_idx` -- WHERE deactivatedAt IS NULL (SQL-only) |
| Index | `Bus_operatorId_licensePlate_key` (unique composite), `BusMaintenance_busId_idx`, `OperatorUser_operatorId_idx` |
| FK | OperatorUser -> Operator (RESTRICT), BusMaintenance -> Bus (CASCADE) |

---

## Phase 4: Trip Management & Recurring Templates (2026-05-19)

### 20260519060000_issue_013_step1_templates

**Issue 013 Step 1.** Recurring trip template and generation log.

| Operation | Detail |
|-----------|--------|
| Table | `RecurringTripTemplate` (id, operatorId, routeId, busId, price, departureLocalTime, daysOfMask bitmask, validFrom DATE, validUntil DATE, deactivatedAt, createdAt, updatedAt) |
| Table | `RecurringGenerationLog` (id, templateId, date DATE, status default 'generated', skipReason, createdAt) |
| Index | Template: operatorId, routeId, busId indices; GenLog: templateId, date indices |
| FK | Template -> Operator/Route/Bus (RESTRICT); GenLog -> Template (CASCADE) |

### 20260519060001_issue_013_step2_trip_extend

**Issue 013 Step 2.** Trip table extensions for operator scoping and lifecycle.

| Operation | Detail |
|-----------|--------|
| ALTER | Trip: add `operatorId` (nullable -> backfill from Route -> NOT NULL), `cancelReason`, `cancelledAt`, `recurringTemplateId`, `pairedTripId`, `updatedAt` |
| **Partial unique** | `Trip_recurringTemplateId_departureAt_uniq` -- WHERE recurringTemplateId IS NOT NULL (SQL-only, prevents double-generation) |
| Index | `Trip_operatorId_idx`, `Trip_recurringTemplateId_idx`, `Trip_pairedTripId_idx` |
| FK | Trip -> Operator (RESTRICT), Trip -> RecurringTripTemplate (SET NULL), Trip -> Trip self-ref (SET NULL) |

### 20260519060002_issue_013_step3_genlog_tripid

**Issue 013 Step 3.** Forward fix: add missing tripId column to RecurringGenerationLog (committed migrations are immutable).

| Operation | Detail |
|-----------|--------|
| ALTER | RecurringGenerationLog: add `tripId TEXT` (nullable) |
| FK | RecurringGenerationLog -> Trip (SET NULL) |

### 20260519070000_issue_014_booking_contact_pickup_trip_lifecycle

**Issue 014.** Operator booking queue, manifest, and trip lifecycle columns.

| Operation | Detail |
|-----------|--------|
| Enum | `ContactStatus` (`pending`, `reached`, `no_answer`, `callback`) |
| ALTER | Booking: add `contactStatus` (NOT NULL default 'pending'), `pickupPointId`, `pickupNote`, `pickedUpAt`, `cashCollectedAt`, `escalationNote`, `escalatedAt` |
| ALTER | Trip: add `departedAt`, `completedAt` (nullable timestamps for lifecycle state machine) |
| ALTER | OperatorUser: add `lastBookingsViewedAt` |
| Index | `Booking_tripId_contactStatus_idx`, `Booking_tripId_pickedUpAt_idx` |
| FK | Booking -> PickupPoint (SET NULL) |

### 20260519080000_notification_log_scheduled_for_column

**Issue 014 QA fix.** Promote scheduledFor from JSON payload to a top-level indexed column for the S19 payout cron.

| Operation | Detail |
|-----------|--------|
| ALTER | NotificationLog: add `scheduledFor TIMESTAMP(3)` |
| Index | `NotificationLog_template_scheduledFor_idx` (composite, supports cron WHERE predicate) |

---

## Phase 5: Revenue, Payouts & Staff (2026-05-19)

### 20260519182813_op_revenue_payout_role

**Issue 016.** Operator revenue reporting and T+3 payout system.

| Operation | Detail |
|-----------|--------|
| ALTER ENUM | `OperatorRole`: add value `'staff'` |
| Enum | `PayoutStatus` (`pending`, `processing`, `settled`, `failed`) |
| Table | `Payout` (id, tripId, operatorId, gross, platformFee, net, status, scheduledAt, settledAt, failureReason, createdAt, updatedAt) |
| Index | `Payout_tripId_idx`, `Payout_status_scheduledAt_idx`, `Payout_operatorId_status_idx` |
| FK | Payout -> Trip (RESTRICT), Payout -> Operator (RESTRICT) |

### 20260519190000_issue_017_staff_trip_assignment

**Issue 017.** Staff management and trip assignment.

| Operation | Detail |
|-----------|--------|
| ALTER | OperatorUser: add `assignedTripId TEXT` (nullable FK) |
| ALTER | NotificationLog: `bookingId` DROP NOT NULL (allows non-booking notifications like staff temp-password SMS) |
| Index | `OperatorUser_assignedTripId_idx` |
| FK | OperatorUser -> Trip (SET NULL) |

### 20260519200000_issue_019_cron_jobs

**Issue 019.** Cron job infrastructure.

| Operation | Detail |
|-----------|--------|
| Table | `JobRunLog` (id, jobName, startedAt, endedAt, status, rowsAffected, errorMessage, createdAt) |
| ALTER | Booking: add `reminderSentAt TIMESTAMP(3)` |
| Index | `JobRunLog_jobName_startedAt_idx`, `Booking_status_reminderSentAt_idx` |

---

## Phase 6: Admin (2026-05-20)

### 20260520000000_issue_020_admin_audit_log

**Issue 020.** Admin audit trail.

| Operation | Detail |
|-----------|--------|
| Table | `AdminAuditLog` (id, actor, action, target, argsRedacted, timestamp) |
| Index | `AdminAuditLog_timestamp_idx`, `AdminAuditLog_action_timestamp_idx` |

### 20260520010000_drop_operatoruser_phones_differ

**Issue 020 fix.** Drops the CHECK constraint from Issue 010 that rejected every operator provisioning INSERT.

| Operation | Detail |
|-----------|--------|
| DROP CONSTRAINT | `OperatorUser_phones_differ` (contactPhone <> notificationPhone was wrong for OperatorUser, see Mistake Log) |

---

## Phase 7: Supplemental Indices & Analytics (2026-05-21 to 2026-05-26)

### 20260521000000_issue_009_booking_buyerphone_idx

**Issue 009.** Index for guest-booking backfill at registration.

| Operation | Detail |
|-----------|--------|
| Index | `Booking_buyerPhone_idx` |

### 20260526000000_funnel_events

Conversion funnel instrumentation.

| Operation | Detail |
|-----------|--------|
| Table | `FunnelEvent` (id, sessionId, step, tripId, bookingId, context JSONB, createdAt) |
| Index | `FunnelEvent_step_createdAt_idx`, `FunnelEvent_sessionId_idx` |

---

## Phase 8: Consolidation & Financial Hardening (2026-06-01 to 2026-06-02)

### 20260601000000_canonical_payment_event

PaymentEvent schema normalization.

| Operation | Detail |
|-----------|--------|
| ALTER | PaymentEvent: rename `externalRef` -> `providerTxnId`, drop `resultCode`, add `currency TEXT NOT NULL DEFAULT 'VND'` |
| ALTER INDEX | Rename `PaymentEvent_adapter_externalRef_key` -> `PaymentEvent_adapter_providerTxnId_key` |

### 20260601000001_booking_buyer_email

**Issue 042.** Capture buyer email for checkout.

| Operation | Detail |
|-----------|--------|
| ALTER | Hold: add `customerEmail TEXT` |
| ALTER | Booking: add `buyerEmail TEXT` |

### 20260602000000_place_entity

Place entity for structured origin/destination.

| Operation | Detail |
|-----------|--------|
| Table | `Place` (id, canonicalName, aliases TEXT[], slug, createdAt) |
| Backfill | Deduplicated Places from existing Route origin/destination strings |
| ALTER | Route: add `originPlaceId`, `destPlaceId` (nullable FKs, backfilled) |
| Index | `Place_slug_key` (unique), `Place_canonicalName_idx`, `Route_originPlaceId_destPlaceId_idx` |
| FK | Route -> Place (SET NULL) for both origin and destination |

### 20260602010000_operator_status

**Issue 045.** Operator approval state machine.

| Operation | Detail |
|-----------|--------|
| Enum | `OperatorStatus` (`PENDING_REVIEW`, `UNDER_REVIEW`, `APPROVED`, `REJECTED`, `SUSPENDED`) |
| ALTER | Operator: add `status` (NOT NULL default 'PENDING_REVIEW'), `rejectionReason` |
| Backfill | Existing operators: disabled -> SUSPENDED, else -> APPROVED |
| Index | `Operator_status_idx` |

### 20260602020000_ledger_entry

**Issue 047.** Append-only double-entry ledger (MONEY-CRITICAL).

| Operation | Detail |
|-----------|--------|
| Enum | `LedgerEntryType` (8 values: `booking_credit`, `platform_fee`, `refund_debit`, `refund_out`, `payout_debit`, `payout_reversal`, `chargeback`, `adjustment`) |
| Table | `LedgerEntry` (id, operatorId, bookingId UUID, payoutId, type, amount BIGINT, currency, sourceEventId, createdAt) |
| Index | `LedgerEntry_sourceEventId_key` (unique, idempotency), `LedgerEntry_operatorId_idx`, `LedgerEntry_bookingId_idx`, `LedgerEntry_payoutId_idx` |
| FK | LedgerEntry -> Operator (RESTRICT), LedgerEntry -> Booking (RESTRICT); no payoutId FK by design |
| **Trigger** | `ledger_entry_no_update` / `ledger_entry_no_delete` -- BEFORE UPDATE/DELETE raises exception (SQL-only, role-independent immutability) |
| **Function** | `ledger_entry_immutable()` -- plpgsql trigger function |

### 20260602030000_fee_config

**Issue 048.** Effective-dated platform fee configuration.

| Operation | Detail |
|-----------|--------|
| Table | `FeeConfig` (id, operatorId nullable, ratePpm INTEGER, effectiveFrom, effectiveTo, createdBy, createdAt) |
| Seed | Global 6% rate (ratePpm=60000) effective from 2020-01-01 (ensures fresh deploys have a rate without seed.ts) |
| Index | `FeeConfig_operatorId_effectiveFrom_idx`, `FeeConfig_effectiveFrom_idx` |
| FK | FeeConfig -> Operator (RESTRICT); operatorId NULL = global default rate |

### 20260602040000_payout_status_rename

**Issue 050.** PayoutStatus enum value renames (in-place catalog update, O(1)).

| Operation | Detail |
|-----------|--------|
| RENAME VALUE | `pending` -> `requested`, `settled` -> `paid` |
| ALTER DEFAULT | Payout.status default -> `'requested'` |

### 20260602050000_payout_tripid_nullable

**Issue 053.** Make Payout.tripId nullable for withdrawal payouts.

| Operation | Detail |
|-----------|--------|
| ALTER | Payout: `tripId` DROP NOT NULL |

### 20260602060000_admin_user

**Issue 054.** Admin authentication realm (third auth domain).

| Operation | Detail |
|-----------|--------|
| Enum | `AdminRole` (`SUPER_ADMIN`, `FINANCE`, `SUPPORT`) |
| Enum | `AdminStatus` (`ACTIVE`, `DISABLED`) |
| Table | `AdminUser` (id, email, passwordHash, role, totpSecret, totpEnabledAt, invitedBy, status, createdAt, updatedAt) |
| Table | `AdminSession` (id, adminUserId, refreshTokenHash, tokenFamily, rotationCount, expiresAt, createdAt, revokedAt) |
| Index | `AdminUser_email_key` (unique), `AdminUser_email_idx`, `AdminSession_refreshTokenHash_key` (unique), `AdminSession_adminUserId_idx` |
| FK | AdminSession -> AdminUser (CASCADE) |

### 20260602070000_notification_channel_email

**Issue 058.** Add `'email'` to `NotificationChannel` enum.

| Operation | Detail |
|-----------|--------|
| ALTER ENUM | NotificationChannel: add value `'email'` |

Note: Isolated in its own migration because ADD VALUE cannot be used by a later statement in the same transaction.

### 20260602080000_notification_dispatcher

**Issue 058.** Notification dispatcher retry/backoff and idempotency.

| Operation | Detail |
|-----------|--------|
| ALTER | NotificationLog: add `attemptCount` (NOT NULL default 0), `nextAttemptAt`, `lastError` |
| **Unique** | `NotificationLog_bookingId_template_key` (idempotency: one row per bookingId+template; NULL bookingId rows not deduped) |
| Index | `NotificationLog_status_nextAttemptAt_idx` (dispatch-claim scan) |

### 20260602090000_stored_object

**Issue 059.** Object storage pointer table (S3 key + metadata, never bytes).

| Operation | Detail |
|-----------|--------|
| Table | `StoredObject` (id, key, contentType, sizeBytes, purpose, uploadedBy, createdAt) |
| Index | `StoredObject_key_key` (unique), `StoredObject_purpose_idx` |

### 20260602100000_feature_flag

**Issue 060.** DB-backed feature flag store.

| Operation | Detail |
|-----------|--------|
| Table | `FeatureFlag` (key TEXT PK, enabled, value, updatedBy, updatedAt) |

### 20260602110000_admin_audit_immutable

**Issue 062.** AdminAuditLog append-only enforcement via triggers.

| Operation | Detail |
|-----------|--------|
| **Trigger** | `admin_audit_log_no_update` / `admin_audit_log_no_delete` -- BEFORE UPDATE/DELETE raises exception |
| **Function** | `admin_audit_log_immutable()` -- plpgsql trigger function |

### 20260602120000_customer_suspend

**Issue 066.** Admin customer suspension.

| Operation | Detail |
|-----------|--------|
| ALTER | Customer: add `suspendedAt TIMESTAMP(3)` |

### 20260602130000_moderation

**Issue 069.** Admin content moderation.

| Operation | Detail |
|-----------|--------|
| ALTER | Trip: add `moderatedAt`; Route: add `moderatedAt` |
| Table | `ContentReport` (id, targetType, targetId, reason, reportedBy, status default 'open', resolvedBy, resolvedAt, createdAt) |
| Index | `ContentReport_status_createdAt_idx` |

### 20260602140000_booking_checkin

**Issue 073.** Boarding scan and check-in/no-show tracking.

| Operation | Detail |
|-----------|--------|
| ALTER | Booking: add `checkedInAt`, `noShowAt` (mutually exclusive timestamps) |

### 20260602150000_booking_ticket_pdf

**Issue 074.** Async ticket PDF generation.

| Operation | Detail |
|-----------|--------|
| ALTER | Booking: add `ticketPdfKey TEXT`, `ticketPdfGeneratedAt` |

### 20260602160000_operator_application_ref

**Issue 076.** Self-serve operator registration application reference.

| Operation | Detail |
|-----------|--------|
| ALTER | Operator: add `applicationRef TEXT` (nullable, unique) |
| Index | `Operator_applicationRef_key` (unique) |

### 20260602170000_kyb_document

**Issue 077.** KYB (Know Your Business) document submission.

| Operation | Detail |
|-----------|--------|
| Table | `KybDocument` (id, operatorId, type, storageKey, status default 'submitted', uploadedAt) |
| Index | `KybDocument_operatorId_idx` |
| FK | KybDocument -> Operator (RESTRICT) |

### 20260602180000_payout_account

**Issue 078.** Operator payout bank account verification.

| Operation | Detail |
|-----------|--------|
| Table | `PayoutAccount` (id, operatorId, bankName, accountNumber, accountHolderName, verifiedAt, verifyMethod, createdAt, updatedAt) |
| Index | `PayoutAccount_operatorId_key` (unique -- one payout destination per operator) |
| FK | PayoutAccount -> Operator (RESTRICT) |

### 20260602190000_charter_request

**Issue 081.** Charter (group hire) request model and state machine.

| Operation | Detail |
|-----------|--------|
| Enum | `CharterStatus` (10 values: `SUBMITTED` through `CANCELLED`) |
| Table | `CharterRequest` (id, ref, customerId, contactName/Phone/Email, originPlaceId, destinations JSONB, startDate, endDate, durationDays, passengers, vehicleType, budgetVnd, notes, status, assigneeOperatorId, publishedAt, claimByAt, acceptByAt, rejectionReason, createdAt, updatedAt) |
| Index | `CharterRequest_ref_key` (unique), `CharterRequest_status_createdAt_idx`, `CharterRequest_assigneeOperatorId_idx` |
| FK | CharterRequest -> Customer (SET NULL), -> Place (SET NULL), -> Operator (SET NULL) |

### 20260602200000_charter_expiry_index

**Issue 086.** Predicate indices for charter-expiry sweeper cron.

| Operation | Detail |
|-----------|--------|
| Index | `CharterRequest_status_acceptByAt_idx` (composite, for direct-assign timeout) |
| Index | `CharterRequest_status_claimByAt_idx` (composite, for public-pool expiry) |

### 20260602210000_booking_status_paid

**Issue 087.** BookingStatus and HoldStatus enum value renames.

| Operation | Detail |
|-----------|--------|
| RENAME VALUE | BookingStatus: `paid_operator_notified` -> `paid` |
| RENAME VALUE | HoldStatus: `converted` -> `consumed` |

### 20260602220000_consent_record

**Issue 089.** Checkout consent capture (compliance artifact).

| Operation | Detail |
|-----------|--------|
| Table | `ConsentRecord` (id, bookingId UUID, consentType, version, consentedAt) |
| Index | `ConsentRecord_bookingId_idx`, `ConsentRecord_consentType_version_idx` |
| FK | ConsentRecord -> Booking (CASCADE) |
| **Trigger** | `consent_record_no_update` -- BEFORE UPDATE raises (append-only; DELETE left to CASCADE) |
| **Function** | `consent_record_immutable()` -- plpgsql trigger function |

---

## Phase 9: Retention & Cleanup (2026-06-03)

### 20260603010000_retention

**Issue 090.** Retention policy predicate columns.

| Operation | Detail |
|-----------|--------|
| ALTER | Booking: add `snapshotAnonymizedAt` (guest PII scrub marker) |
| ALTER | KybDocument: add `purgedAt` (storage object purge marker) |
| Index | `Booking_snapshotAnonymizedAt_idx`, `KybDocument_purgedAt_idx` |

### 20260603020000_booking_status_refunded

**Issue 100.** Add `'refunded'` terminal state to BookingStatus enum.

| Operation | Detail |
|-----------|--------|
| ALTER ENUM | BookingStatus: add value `'refunded'` |

Isolated migration (ADD VALUE cannot share a transaction with DML using the new value).

### 20260603030000_booking_refunded_at

**Issue 100.** Add refundedAt column for oversold-race refund path.

| Operation | Detail |
|-----------|--------|
| ALTER | Booking: add `refundedAt TIMESTAMPTZ` |
| Index | `Booking_status_refundedAt_idx` (composite) |

### 20260603040000_drop_cash_residue

**Issue 088.** Cash-only descope: remove dead cash rail artifacts.

| Operation | Detail |
|-----------|--------|
| ALTER | Booking: drop `cashCollectedAt` |
| DROP/RECREATE ENUM | `PaymentMethod`: remove `'cash'` (now: `momo`, `zalopay`, `card`) |
| DROP/RECREATE ENUM | `BookingStatus`: remove `'pending_cash_payment'` (now: 8 values) |

Note: Postgres cannot DROP a single enum value, so each enum is recreated via rename-create-cast-drop pattern.

---

## Phase 10: Operator Onboarding Rework (2026-06-06)

### 20260606010000_operator_application_fields_and_username

Operator onboarding profile fields and username login key.

| Operation | Detail |
|-----------|--------|
| ALTER | Operator: add `brandName`, `contactName`, `address`, `routesSummary` (all nullable) |
| ALTER | OperatorUser: add `username` (nullable -> backfill 'op-'+id -> NOT NULL) |
| Index | `OperatorUser_username_key` (unique) |

---

## Phase 11: Pickup Points v2 (2026-06-08 to 2026-06-10)

### 20260608000000_pickup_areas

**Issue 104.** Personal pickup destinations: operator-defined areas and traveler self-select.

| Operation | Detail |
|-----------|--------|
| Enum | `PickupKind` (`station`, `area`) |
| DROP TABLE | `PickupPoint` (legacy route-scoped, greenfield pre-launch) |
| ALTER | Booking: drop `pickupPointId`, `pickupNote`; add `pickupAreaId`, `pickupAreaLabel`, `pickupDetail`, `pickupKind` |
| ALTER | Hold: add `pickupAreaId`, `pickupAreaLabel`, `pickupDetail`, `pickupKind` |
| ALTER | Operator: add `provinceCode`, `provinceName` |
| Table | `OperatorPickupArea` (id, operatorId, provinceCode, districtCode/Name, wardCode/Name, label, isActive, displayOrder, createdAt, updatedAt) |
| Table | `TripPickupArea` (id, tripId, operatorPickupAreaId, label, displayOrder) |
| Table | `TemplatePickupArea` (id, recurringTemplateId, operatorPickupAreaId, label, displayOrder) |
| Index | `OperatorPickupArea_operatorId_isActive_idx`, `TripPickupArea_tripId_displayOrder_idx`, `TemplatePickupArea_recurringTemplateId_displayOrder_idx` |
| **Unique** | `TripPickupArea_tripId_operatorPickupAreaId_key`, `TemplatePickupArea_recurringTemplateId_operatorPickupAreaId_key` |
| FK | Multiple CASCADE FKs linking areas to operators, trips, templates; Hold/Booking -> OperatorPickupArea (SET NULL) |

### 20260609000000_pickup_point_name

Add stop identity to operator pickup areas.

| Operation | Detail |
|-----------|--------|
| ALTER | OperatorPickupArea: add `name` (nullable -> backfill from label -> NOT NULL), `addressLine` |

### 20260609010000_pickup_v2_kind_rename

**Issue 109.** Pickup points v2 schema foundation.

| Operation | Detail |
|-----------|--------|
| Enum | `PickupPlaceKind` (`station`, `pickup`) |
| ALTER | OperatorPickupArea, TripPickupArea, TemplatePickupArea: add `kind PickupPlaceKind NOT NULL DEFAULT 'pickup'` |
| RENAME VALUE | PickupKind: `area` -> `point` |
| ALTER | Booking, Hold: add `customPickupRequested BOOLEAN NOT NULL DEFAULT false` |
| Index | `Booking_tripId_customPickupRequested_idx` |

### 20260609020000_pickup_area_kind_backfill

**Issue 110.** Heuristic backfill: re-tag pickup areas whose name matches bus terminal patterns as `station`.

| Operation | Detail |
|-----------|--------|
| UPDATE | OperatorPickupArea: set kind='station' WHERE name ILIKE '%ben xe%' etc. (data-only, no schema change) |

### 20260609030000_pickup_kind_custom

**Issue 111.** Add `'custom'` value to PickupKind enum. Isolated migration (ADD VALUE transaction rule).

| Operation | Detail |
|-----------|--------|
| ALTER ENUM | PickupKind: add value `'custom'` |

### 20260609040000_pickup_custom_check

**Issue 111.** CHECK constraints for custom pickup validation.

| Operation | Detail |
|-----------|--------|
| **CHECK constraint** | `Booking_custom_requires_detail` -- custom pickup must have pickupDetail >= 5 chars (SQL-only) |
| **CHECK constraint** | `Hold_custom_requires_detail` -- same rule on Hold (SQL-only) |

### 20260610000000_pickup_area_kind_default_station

Align OperatorPickupArea.kind column DEFAULT with documented intent (most VN entries are stations).

| Operation | Detail |
|-----------|--------|
| ALTER DEFAULT | OperatorPickupArea.kind: `'pickup'` -> `'station'` |

### 20260610000000_route_pickup_areas

**Issue 113.** Route-scoped pickup areas (join table).

| Operation | Detail |
|-----------|--------|
| Table | `RoutePickupArea` (id, routeId, operatorPickupAreaId, displayOrder) |
| Backfill | Every Route assigned its operator's full set of active pickup areas |
| Index | `RoutePickupArea_routeId_displayOrder_idx` |
| **Unique** | `RoutePickupArea_routeId_operatorPickupAreaId_key` |
| FK | RoutePickupArea -> Route (CASCADE), -> OperatorPickupArea (CASCADE) |

---

## Phase 12: Security & Dev Tooling (2026-06-12 to 2026-06-15)

### 20260612063249_add_temp_password_plain

Dev-only: add `tempPasswordPlain` to OperatorUser for admin UI display. Also silently drifted financial FKs from RESTRICT to SET NULL (unintentional, corrected in next migration).

| Operation | Detail |
|-----------|--------|
| ALTER | OperatorUser: add `tempPasswordPlain TEXT` |
| ALTER | Place: aliases DROP DEFAULT |
| **FK drift** | Payout.tripId, LedgerEntry.bookingId, FeeConfig.operatorId -- changed from RESTRICT to SET NULL (unintentional) |

### 20260613000000_revert_financial_fk_restrict

Revert the financial FK drift from the previous migration back to ON DELETE RESTRICT.

| Operation | Detail |
|-----------|--------|
| FK fix | Payout.tripId, LedgerEntry.bookingId, FeeConfig.operatorId -- restored to RESTRICT |

### 20260615000000_drop_temp_password_plain

**AUTH-01 hardening.** Drop plaintext temporary password column (security fix).

| Operation | Detail |
|-----------|--------|
| ALTER | OperatorUser: drop `tempPasswordPlain` |

---

## Phase 13: Vietnam Tax & Compliance (2026-06-16)

### 20260616005000_ledger_type_tax_withheld

Add `'tax_withheld'` to LedgerEntryType enum. Isolated migration (ADD VALUE transaction rule).

| Operation | Detail |
|-----------|--------|
| ALTER ENUM | LedgerEntryType: add value `'tax_withheld'` |

### 20260616010000_tax_withholding_schema

**Decree 117/2025.** Tax withholding schema for platform tax obligations.

| Operation | Detail |
|-----------|--------|
| Enum | `TaxClassification` (`company`, `individual_household`) |
| ALTER | Operator: add `taxClassification TaxClassification NOT NULL DEFAULT 'company'` |
| ALTER | Payout: add `taxVat`, `taxPit`, `taxTotal` (all INTEGER NOT NULL DEFAULT 0) |

### 20260616020000_einvoice_schema

**Circular 78/2021.** E-invoice (hoa don dien tu) schema for GDT compliance.

| Operation | Detail |
|-----------|--------|
| Enum | `EInvoiceStatus` (`pending`, `issued`, `sent`, `failed`, `cancelled`) |
| ALTER | Booking: add `einvoiceRef TEXT`, `einvoiceIssuedAt TIMESTAMPTZ` |
| Table | `EInvoice` (id, bookingId UUID, operatorId, invoiceNumber, status, vendorRef, rawResponse, issuedAt, createdAt) |
| Index | `EInvoice_bookingId_idx`, `EInvoice_operatorId_createdAt_idx`, `EInvoice_status_idx` |
| **Partial unique** | `EInvoice_invoiceNumber_key` -- WHERE invoiceNumber IS NOT NULL (SQL-only, GDT no-duplicate rule) |
| **Partial index** | `Booking_einvoiceRef_idx` -- WHERE einvoiceRef IS NOT NULL (SQL-only) |
| **CHECK constraint** | `Booking_einvoice_consistency` -- einvoiceRef and einvoiceIssuedAt must be set/unset together (SQL-only) |
| FK | EInvoice -> Booking (RESTRICT), EInvoice -> Operator (RESTRICT) |

### 20260616030000_add_vnpay_payment_method

**SCALE Issue 077.** Add VNPay as a payment method.

| Operation | Detail |
|-----------|--------|
| ALTER ENUM | PaymentMethod: add value `'vnpay'` |

---

## Summary Statistics

| Metric | Count |
|--------|-------|
| Total migrations | 67 |
| Tables created | 28 (Operator, Bus, Route, Trip, Hold, Booking, NotificationLog, PaymentEvent, Customer, OtpAttempt, Session, OperatorUser, OperatorSession, OperatorOtpAttempt, BusMaintenance, RecurringTripTemplate, RecurringGenerationLog, Payout, JobRunLog, AdminAuditLog, AdminUser, AdminSession, FunnelEvent, LedgerEntry, FeeConfig, StoredObject, FeatureFlag, ContentReport, ConsentRecord, KybDocument, PayoutAccount, CharterRequest, OperatorPickupArea, TripPickupArea, TemplatePickupArea, RoutePickupArea, Place, EInvoice) |
| Enums created | 18 |
| Tables dropped | 1 (PickupPoint, replaced by OperatorPickupArea) |
| Date range | 2026-05-17 to 2026-06-16 |

---

## Notable Patterns

### SQL-Only Objects (Invisible to Prisma DSL)

These objects exist only in migration SQL. Prisma cannot model them, so they never appear in `schema.prisma` and are invisible to `prisma migrate diff`. This is the documented exception class from Issue 007.

**Partial / expression indices:**
- `Customer_email_key` -- partial unique WHERE email IS NOT NULL
- `OtpAttempt_phone_active_key` -- partial unique WHERE consumed = false
- `OperatorOtpAttempt_phone_active_key` -- partial unique WHERE consumed = false
- `Route_operatorId_deactivatedAt_idx` -- partial WHERE deactivatedAt IS NULL
- `PickupPoint_routeId_deactivatedAt_idx` -- partial WHERE deactivatedAt IS NULL (dropped with table)
- `Bus_operatorId_active_idx` -- partial WHERE deactivatedAt IS NULL
- `Trip_recurringTemplateId_departureAt_uniq` -- partial unique WHERE recurringTemplateId IS NOT NULL
- `trip_route_unaccent_idx` -- GIN trigram expression index on Route
- `EInvoice_invoiceNumber_key` -- partial unique WHERE invoiceNumber IS NOT NULL
- `Booking_einvoiceRef_idx` -- partial WHERE einvoiceRef IS NOT NULL

**Immutability triggers:**
- `LedgerEntry`: `ledger_entry_no_update` + `ledger_entry_no_delete` (BEFORE UPDATE/DELETE)
- `AdminAuditLog`: `admin_audit_log_no_update` + `admin_audit_log_no_delete` (BEFORE UPDATE/DELETE)
- `ConsentRecord`: `consent_record_no_update` (BEFORE UPDATE only; DELETE allowed for CASCADE)

**CHECK constraints:**
- `OperatorUser_phones_differ` -- added in Issue 010, dropped in Issue 020 (was wrong)
- `Booking_custom_requires_detail` -- custom pickup must have detail >= 5 chars
- `Hold_custom_requires_detail` -- same rule on Hold
- `Booking_einvoice_consistency` -- einvoiceRef and einvoiceIssuedAt set/unset together

**PostgreSQL extensions and functions:**
- `pg_trgm`, `unaccent` extensions
- `unaccent_immutable(text)` -- immutable wrapper for use in expression indices

### Raw SQL vs Prisma DSL Index Parity (Issue 007 Rule)

Non-partial indices that CAN be expressed in Prisma DSL MUST be declared in BOTH the migration SQL AND `schema.prisma` as `@@index`. Partial / WHERE-clause / expression indices stay SQL-only. This prevents `prisma migrate dev` from detecting schema-vs-DB drift and prompting for unattended follow-up migrations.

### Enum Value Rename Pattern

Postgres 12+ `ALTER TYPE ... RENAME VALUE` is used for in-place O(1) renames (no row rewrite):
- PayoutStatus: `pending` -> `requested`, `settled` -> `paid` (20260602040000)
- BookingStatus: `paid_operator_notified` -> `paid` (20260602210000)
- HoldStatus: `converted` -> `consumed` (20260602210000)
- PickupKind: `area` -> `point` (20260609010000)

### Enum Value ADD Isolation

`ALTER TYPE ... ADD VALUE` is always in its own migration directory because the new value cannot be used by a later statement in the same transaction. Instances:
- NotificationChannel: `'email'` (20260602070000)
- BookingStatus: `'refunded'` (20260603020000)
- PickupKind: `'custom'` (20260609030000)
- LedgerEntryType: `'tax_withheld'` (20260616005000)
- PaymentMethod: `'vnpay'` (20260616030000)

### Enum Value DROP Pattern

Postgres cannot DROP a single enum value. The pattern used (20260603040000): rename old type -> create new type without the value -> ALTER COLUMN USING cast -> drop old type. Column defaults must be dropped before and restored after the swap.

### Backfill Pattern for NOT NULL Columns

When adding a NOT NULL column to a table with existing rows:
1. Add column as nullable
2. Backfill with appropriate values (derived from related data or defaults)
3. Optional: fail-fast DO block verifying zero NULLs remain
4. ALTER COLUMN SET NOT NULL

Used in: Route.operatorId (012), Bus.busType (011), OperatorUser.operatorId (011), Trip.operatorId (013 step 2), OperatorUser.username (0606), OperatorPickupArea.name (0609).

### Forward-Fix Pattern

When a migration omits something, the fix is a NEW migration (committed migrations are immutable):
- RecurringGenerationLog.tripId omitted in step 1, added in step 3 (Issue 013)
- OperatorUser_phones_differ CHECK constraint dropped in Issue 020 after being added in Issue 010
- Financial FK drift (RESTRICT -> SET NULL) reverted in 20260613000000 after 20260612063249
- tempPasswordPlain added then dropped in separate migrations (security hardening)
