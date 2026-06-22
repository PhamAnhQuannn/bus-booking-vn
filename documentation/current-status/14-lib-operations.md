# 14 — lib/op, lib/staff, lib/onboarding

Operator-facing domain modules: dashboard data loaders, staff management, and operator onboarding/approval pipeline.

---

## lib/op/ — Operator Dashboard Domain

Server-side data loaders and display utilities for the `/op/` console. All session-aware loaders follow the same pattern: read `bb_op_access` cookie, verify JWT via `verifyOperatorAccess`, query Prisma, return typed view or `null`. Every query is tenant-isolated by `operatorId`.

### Files

| File | Purpose | Key exports |
|------|---------|-------------|
| `index.ts` | Barrel | Re-exports all public symbols |
| `getOperatorSession.ts` | Minimal auth resolver for server components | `getOperatorSession(): OperatorSession \| null` |
| `getOperatorProfile.ts` | Profile loader (phone, displayName, role) | `getOperatorProfile(): OperatorProfile \| null` |
| `getOperatorFleet.ts` | Fleet loader for `/op/buses` page; delegates to `listOperatorBuses` from `lib/catalog` | `getOperatorFleet(opts?): OperatorFleet \| null` |
| `getOperatorStaff.ts` | Staff list loader; admin-only gate; delegates to `listStaff` from `lib/staff` | `getOperatorStaff(): OperatorStaffView \| null` |
| `getTodaySnapshot.ts` | Three headline KPIs: trips today, paid bookings (24h), revenue today (VND) | `getTodaySnapshot(operatorId): TodaySnapshot` |
| `getActivityFeed.ts` | Merge-sorted activity stream from Booking + Trip tables (no new schema) | `getActivityFeed(input): ActivityEvent[]` |
| `getStaffDashboard.ts` | Staff member view: assigned trip + bookings queue + manifest | `getStaffDashboard(): StaffDashboardView \| null` |
| `listRoutesForTripIds.ts` | Batch route origin/destination lookup for trip-card enrichment | `listRoutesForTripIds(operatorId, routeIds): RouteEndpoints[]` |
| `statusLabels.ts` | Vietnamese status display labels + badge variants for bookings, trips, routes, contacts, payouts, bus types | `bookingStatusDisplay`, `tripStatusDisplay`, `routeActiveDisplay`, `contactStatusDisplay`, `payoutStatusDisplay`, `busTypeLabel`, `busTypeWithCapacity`, `FLAG_GLYPHS` |
| `formatRelativeVi.ts` | Vietnamese relative-time formatter (e.g. "Khoi hanh sau 2g15p") | `formatRelativeVi(target, now?)` |
| `dateRanges.ts` | VN-timezone (UTC+7) date range helpers; module-scope to keep RSC bodies pure (Issue 016 rule) | `getDefaultDateRange(days?)`, `getDefaultTodayRange()`, `serverNow()` |
| `activityTypes.ts` | Type definitions for activity feed events | `ActivityEvent`, `ActivityEventType`, `Severity` |

### Key interfaces

| Interface | Fields |
|-----------|--------|
| `OperatorSession` | `operatorId`, `requiresPasswordChange`, `operatorUserId`, `role` (`'admin' \| 'staff'`), `operatorName` |
| `OperatorProfile` | `id`, `phone`, `displayName`, `contactPhone`, `notificationPhone`, `requiresPasswordChange`, `role` |
| `OperatorFleet` | `operatorId`, `buses: OperatorBusListItem[]`, `requiresPasswordChange` |
| `OperatorStaffView` | `operatorId`, `staff: StaffDto[]`, `requiresPasswordChange`, `isAdmin` |
| `TodaySnapshot` | `tripsToday`, `newPaidBookings24h`, `revenueTodayVnd` |
| `StaffDashboardView` | `operatorId`, `requiresPasswordChange`, `isStaff`, `assignedTripId`, `trip: TripDto \| null`, `queueRows`, `manifestRows`, `manifestGeneratedAt` |
| `ActivityEvent` | `id` (synthetic `<type>:<sourceId>:<unixMs>`), `type: ActivityEventType`, `ts` (ISO 8601), `severity`, `title`, `body`, `href?` |

### Activity event types

| Type | Source | Severity |
|------|--------|----------|
| `booking.paid` | Booking (paid/completed, last 7d) | success |
| `booking.escalated` | Booking (escalatedAt set) | danger |
| `trip.low_capacity` | Trip (scheduled, departing within 24h, >= 90% sold) | warning |
| `trip.departed` | Trip (departedAt set) | info |
| `trip.completed` | Trip (completedAt set) | info |
| `trip.cancelled` | Trip (cancelledAt set) | danger |

### Status label maps

| Function | Prisma enum / input | Variants used |
|----------|---------------------|---------------|
| `bookingStatusDisplay` | `BookingStatus` (8 values) | pending, success, danger |
| `tripStatusDisplay` | `TripStatus` (4 values); appends "(dong ban)" when `salesClosed=true` on scheduled | neutral, pending, success, danger |
| `routeActiveDisplay` | `boolean` | success / danger |
| `contactStatusDisplay` | `string \| null` (pending, reached, no_answer, callback) | pending, success, danger, neutral |
| `payoutStatusDisplay` | `string \| null` (requested, processing, paid, failed) | pending, neutral, success, danger |
| `busTypeLabel` | string (coach, sleeper, limousine) | Vietnamese label strings |

### Dependencies

| Depends on | Used by |
|------------|---------|
| `lib/auth` (`verifyOperatorAccess`) | `app/op/` server components |
| `lib/core/db` (`prisma`, `withOperatorScope`) | `components/op/` client components (via props) |
| `lib/catalog` (`listOperatorBuses`) | |
| `lib/staff` (`listStaff`, `StaffDto`) | |
| `lib/booking` (`listOperatorBookings`, `getManifest`) | |
| `lib/trips` (`getTrip`, `TripDto`) | |
| `@prisma/client` (enum types) | |

### Tests

| File | Coverage |
|------|----------|
| `lib/op/__tests__/getActivityFeed.test.ts` | 7 cases: empty state, operatorId scoping, booking.paid events, DESC ordering, limit truncation, low_capacity threshold (>= 0.9), capacity=0 guard, day-bucket idempotency |
| `lib/op/__tests__/statusLabels.test.ts` | 4 cases: all BookingStatus values mapped, all TripStatus values mapped, variant correctness, salesClosed label append |

---

## lib/staff/ — Staff Management Domain

CRUD + service-assignment for operator staff members (`OperatorUser` rows with `role='staff'`). All operations are tenant-scoped by `operatorId`.

### Files

| File | Purpose | Key exports |
|------|---------|-------------|
| `index.ts` | Barrel | Re-exports all public symbols |
| `createStaff.ts` | Provision a staff OperatorUser: normalize phone, gen temp password, hash, create row (role=staff, requiresPasswordChange=true), send SMS, log notification | `createStaff(operatorId, input): StaffDto` |
| `updateStaff.ts` | Rename a staff member (displayName only, V1); scoped by (id, operatorId, role=staff) | `updateStaff(operatorId, staffId, input): StaffDto` |
| `disableStaff.ts` | Deactivate staff: set `disabledAt` + revoke all `OperatorSession` rows in one transaction; idempotent | `disableStaff(operatorId, staffId): StaffDto` |
| `listStaff.ts` | List all staff (role=staff) for an operator, newest-first | `listStaff(operatorId): StaffDto[]` |
| `assignService.ts` | Assign staff to a trip; TOCTOU-safe via `SELECT ... FOR UPDATE` inside `$transaction`; validates trip ownership + status=scheduled; idempotent (replaces prior assignment) | `assignService(operatorId, staffId, tripId): void` |
| `toStaffDto.ts` | Map `OperatorUser` DB row to client-facing DTO | `toStaffDto(row): StaffDto` |
| `genTempPassword.ts` | 12-char crypto-random password; rejection sampling (no modulo bias); excludes ambiguous glyphs (0/O/1/l/I) | `genTempPassword(): string` |
| `errors.ts` | Tagged error class for staff operations | `StaffServiceError`, `StaffErrorCode` |

### Key types

| Type | Definition |
|------|------------|
| `StaffDto` | `id`, `phone`, `displayName`, `role`, `disabled` (boolean, derived from `disabledAt`), `createdAt` (ISO string), `assignedTripId` |
| `StaffRow` | DB shape from `OperatorUser`: `id`, `phone`, `displayName`, `role`, `disabledAt`, `createdAt`, `assignedTripId` |
| `StaffErrorCode` | `'phone_in_use' \| 'not_found' \| 'trip_not_assignable' \| 'trip_not_found'` |

### Error codes

| Code | Thrown by | Condition |
|------|----------|-----------|
| `phone_in_use` | `createStaff` | Prisma P2002 unique constraint on phone |
| `not_found` | `updateStaff`, `disableStaff`, `assignService` | Staff ID not found or belongs to different operator |
| `trip_not_assignable` | `assignService` | Trip exists but status is not `'scheduled'` |
| `trip_not_found` | `assignService` | Trip ID not found or belongs to different operator |

### Transaction safety

- `createStaff`: Single `prisma.operatorUser.create` with P2002 catch (no explicit transaction needed)
- `disableStaff`: `$transaction` wrapping `operatorUser.update` (set `disabledAt`) + `operatorSession.deleteMany` (revoke sessions)
- `assignService`: `$transaction` with `SELECT ... FOR UPDATE` on the OperatorUser row, then trip validation, then `operatorUser.update` (set `assignedTripId`)

### Dependencies

| Depends on | Used by |
|------------|---------|
| `lib/core/db` (`prisma`) | `lib/op/getOperatorStaff` |
| `lib/auth` (`hashPassword`) | `app/api/op/staff/` routes |
| `lib/notification` (`enqueueSms`) | `app/op/` server components |

### Tests

| File | Coverage |
|------|----------|
| `lib/staff/__tests__/genTempPassword.test.ts` | 12-char length, unambiguous charset, no ambiguous glyphs, distribution uniformity, no collisions (500 runs) |
| `lib/staff/__tests__/staffService.int.test.ts` | Integration: createStaff provisioning + duplicate phone rejection + cross-operator collision + notification log (no temp password leak); disableStaff atomic disable + session revocation + idempotency + cross-operator rejection; assignService to scheduled trip + replace prior + reject non-scheduled + cross-operator trip/staff |

---

## lib/onboarding/ — Operator Onboarding Domain

Self-serve operator registration, KYB document submission, admin approval state machine, payout account setup, and capability gates. Implements Issues 045, 065, 076, 077, 078, 079.

### Files

| File | Purpose | Key exports |
|------|---------|-------------|
| `index.ts` | Barrel | Re-exports all public symbols |
| `registerOperator.ts` | Self-serve application: creates `Operator` row in `PENDING_REVIEW` with `applicationRef` (retries on collision up to 5x); enqueues pending email; does NOT create OperatorUser | `registerOperator(input)`, `REGISTER_SLA_RANGE` |
| `operatorStatus.ts` | Approval state machine transitions inside `$transaction` with `SELECT ... FOR UPDATE`; syncs `disabledAt`/`rejectionReason`; writes `AdminAuditLog` (I065); enqueues SMS + email notifications (I079) | `transitionOperatorStatus(operatorId, to, adminId, opts?)`, `isLegalOperatorTransition(from, to)`, `LEGAL_OPERATOR_TRANSITIONS` |
| `operatorCapabilities.ts` | Pure capability helper: maps each `OperatorStatus` to feature-access flags | `getOperatorCapabilities(status)`, `isSearchVisible(status)`, `isBookable(status)`, `SEARCH_VISIBLE_STATUSES`, `BOOKABLE_STATUSES` |
| `kyb.ts` | KYB document upload: validate doc type, mint signed PUT URL via `lib/storage`, create `KybDocument` row; `submitForReview` transitions `PENDING_REVIEW -> UNDER_REVIEW` | `requestKybUploadUrl(operatorId, docType)`, `listOperatorKybDocs(operatorId)`, `submitForReview(operatorId)`, `KYB_DOC_TYPES`, `KybError`, `isKybDocType` |
| `payoutAccount.ts` | Payout account upsert with verification-reset on edit; three read paths (masked, unmasked, boolean guard) | `setPayoutAccount(operatorId, input)`, `getPayoutAccount(operatorId)`, `getPayoutAccountInternal(operatorId)`, `isPayoutAccountVerified(operatorId)`, `maskAccountNumber(acct)` |
| `payoutVerify.ts` | Account ownership verification: token-overlap Jaccard with Vietnamese diacritic/suffix normalization (threshold 0.8); `confirmPayoutAccountOwnership` marks verified + writes audit log; micro-deposit is a stub | `nameMatchScore(a, b)`, `confirmPayoutAccountOwnership(operatorId, input)`, `initiateMicroDeposit(operatorId)`, `NAME_MATCH_VERIFY_THRESHOLD`, `PayoutVerifyError` |
| `applicationRef.ts` | Generate `OP-YYYY-XXXXXX` references (VN-timezone year, 6 random uppercase base36 chars) | `generateApplicationRef()`, `APPLICATION_REF_REGEX` |
| `requestOperatorInfo.ts` | Admin "request more info" action; does NOT change operator status (stays `UNDER_REVIEW`); writes `AdminAuditLog` + enqueues SMS in `$transaction` | `requestOperatorInfo(operatorId, adminId, note)` |
| `errors.ts` | Tagged error classes for onboarding operations | `OperatorStatusError`, `RegisterError` |

### Operator status state machine

```
PENDING_REVIEW  -->  UNDER_REVIEW  -->  APPROVED
                                   -->  REJECTED
                                   -->  SUSPENDED (from APPROVED)
                                   -->  APPROVED  (from SUSPENDED, reinstate)
```

| Transition | Side effects |
|------------|-------------|
| `PENDING_REVIEW -> UNDER_REVIEW` | Audit log |
| `UNDER_REVIEW -> APPROVED` | Clear `disabledAt`; audit log; SMS + email notification |
| `UNDER_REVIEW -> REJECTED` | Set `disabledAt`, `rejectionReason`; audit log; SMS + email notification |
| `APPROVED -> SUSPENDED` | Set `disabledAt`; audit log; SMS + email notification |
| `SUSPENDED -> APPROVED` | Clear `disabledAt`; audit log; SMS + email notification |

### Capability map

| OperatorStatus | canLogin | searchVisible | canSell | canPayout | canResubmit | listingsHidden |
|---------------|----------|---------------|---------|-----------|-------------|----------------|
| `PENDING_REVIEW` | false | false | false | false | false | true |
| `UNDER_REVIEW` | false | false | false | false | false | true |
| `APPROVED` | true | true | true | true | false | false |
| `REJECTED` | false | false | false | false | true | true |
| `SUSPENDED` | true | false | false | false | false | true |

### KYB document types

| Type | Description |
|------|-------------|
| `business_license` | Business registration certificate |
| `identity` | Owner identity document |
| `payout_account` | Bank account proof |

### Payout verification

- `nameMatchScore(a, b)`: Token-overlap Jaccard similarity with Vietnamese diacritic stripping and suffix normalization
- Threshold: `0.8` (`NAME_MATCH_VERIFY_THRESHOLD`)
- `confirmPayoutAccountOwnership`: Marks account verified inside `$transaction` with `AdminAuditLog`
- `initiateMicroDeposit`: Stub (not yet implemented)

### Error codes

| Error class | Code | Thrown by |
|-------------|------|----------|
| `OperatorStatusError` | `operator_not_found` | `transitionOperatorStatus`, `requestOperatorInfo` |
| `OperatorStatusError` | `illegal_transition` | `transitionOperatorStatus` |
| `RegisterError` | `phone_in_use` | `registerOperator` |
| `KybError` | `invalid_doc_type` | `requestKybUploadUrl` |
| `KybError` | `storage_error` | `requestKybUploadUrl` |
| `PayoutVerifyError` | `account_not_found` | `confirmPayoutAccountOwnership` |

### Transaction safety

- `operatorStatus.ts`: `$transaction` with `SELECT ... FOR UPDATE` on `Operator` row for every status transition
- `payoutVerify.ts`: `$transaction` for verify + audit log write
- `requestOperatorInfo.ts`: `$transaction` with `SELECT ... FOR UPDATE` for audit log + notification
- `registerOperator.ts`: Single `prisma.operator.create` with P2002 retry loop (up to 5 attempts)

### Dependencies

| Depends on | Used by |
|------------|---------|
| `lib/core/db` (`prisma`) | `app/api/op/onboarding/` routes |
| `lib/storage` (signed upload URLs) | `app/api/admin/operators/` routes |
| `lib/notification` (SMS + email enqueue) | `app/admin/` server components |
| `lib/auth` | `lib/catalog` (search visibility filtering) |

### Tests

| File | Coverage |
|------|----------|
| `lib/onboarding/__tests__/registerOperator.test.ts` | Application-only registration (Operator row, no OperatorUser); pending email enqueue with SLA range; applicationRef collision retry; non-collision error rethrow |
| `lib/onboarding/__tests__/operatorStatus.test.ts` | All 6 legal transition edges; illegal transitions; missing operator; `disabledAt` sync; rejection reason handling; audit log writing (I065); dual SMS+email notification enqueuing (I079) |
| `lib/onboarding/__tests__/operatorCapabilities.test.ts` | Every OperatorStatus capability set; `SEARCH_VISIBLE_STATUSES` and `BOOKABLE_STATUSES` exactly `[APPROVED]`; `isSearchVisible`/`isBookable` consistency |
| `lib/onboarding/__tests__/kyb.test.ts` | `requestKybUploadUrl` valid/invalid type + storage error passthrough; `listOperatorKybDocs`; `submitForReview` transition delegation + error propagation |
| `lib/onboarding/__tests__/payoutAccount.test.ts` | `maskAccountNumber`; upsert with verification reset; masked vs unmasked read paths; `isPayoutAccountVerified` guard |
| `lib/onboarding/__tests__/payoutVerify.test.ts` | `nameMatchScore` (exact, case/diacritic/suffix insensitive, partial overlap, unrelated, empty); `confirmPayoutAccountOwnership` verify write + audit + not-found error |

---

## Cross-domain relationships

```
app/op/ server components
    |
    v
lib/op/  (session + data loaders)
    |
    +---> lib/staff/   (staff CRUD, assignment)
    +---> lib/booking/  (bookings queue, manifest)
    +---> lib/catalog/  (fleet listing)
    +---> lib/trips/    (trip details)
    |
lib/onboarding/  (registration, approval, KYB, payout)
    |
    +---> lib/storage/  (KYB upload URLs)
    +---> lib/notification/ (SMS + email)
    |
    v
lib/core/db  (prisma, withOperatorScope)
```

## File counts

| Domain | Source files | Test files | Total |
|--------|------------|------------|-------|
| `lib/op/` | 13 | 2 | 15 |
| `lib/staff/` | 9 | 2 | 11 |
| `lib/onboarding/` | 10 | 6 | 16 |
| **Total** | **32** | **10** | **42** |
