# FI-009: Operator Console (Cong quan ly nha xe)

> **Status:** DOCUMENTED
> **Last Updated:** 2026-06-20
> **Related:** ADR-004, ADR-012, ADR-016, ADR-019, DS-001, DS-003, DS-006, FD-024

## Overview

The Operator Console is the primary multi-tenant management portal for bus operators (`/op/`), covering fleet management (buses, routes, trips), booking operations, passenger manifests, financial reporting (revenue, payouts, ledger), settings, and staff management. It is a Next.js App Router application protected by operator-realm JWT (15-min access TTL, 7-day refresh), with all queries tenant-scoped via `withOperatorScope` and `operatorId` derived exclusively from the JWT claim. It serves five operator personas from micro family operators to FUTA-scale enterprises.

## Scope & Boundaries

### In Scope

- Bus/route/trip CRUD with maintenance window and bus overlap guards
- Recurring trip template management (daily cron generates trips for 14-day horizon)
> **Phase 2 (deferred)**: Pickup area management deferred to post-launch (trigger: 4 operators). Phase 1 = station-only.

- Pickup area management (station/pickup kinds, deactivate-not-delete)
- Booking manifest view with phone masking (last 4 digits)
- Booking check-in (SET-ONCE atomic), no-show marking, contact status tracking
- Cash payment confirmation (`awaiting_payment -> paid`)
- Trip lifecycle: close sales, mark departed, mark completed, cancel (discriminated result)
- Payout withdrawal requests with balance and PayoutAccount verification gates
- Ledger read and revenue reports with CSV export
- Cancellation policy and voucher management
- KYB document uploads (business_license, identity, payout_account)
- Operator settings (notification preferences, auto-confirm, custom branding)
- Staff creation, listing, and trip assignment with role tagging

### Out of Scope

- Customer-facing booking flow -> [FI-007](../FI-007-booking-flow/README.md)
- Admin moderation actions -> [FI-012](../FI-012-admin-console/README.md)
- Cross-operator data access -> [FI-012](../FI-012-admin-console/README.md)
- Payout settlement execution (cron-driven) -> [FI-010](../FI-010-payout-system/README.md)
- E-invoice issuance (cron-driven) -> [FI-015](../FI-015-e-invoice/README.md)
- Customer auth / OTP flows -> [FI-001](../FI-001-core-auth/README.md)
- Payment webhook processing -> [FI-008](../FI-008-payment-integration/README.md)

### Bounded Context(s)

**Fleet/Catalog Context** -- Trip/Bus/Route CRUD, RecurringTripTemplate, pickup areas. Operator-owned supply side.

**Booking Context** -- Manifest view, check-in, no-show, contact status, cash payment confirmation.

**Finance/Ledger Context** -- Balance (derived), payouts, ledger entries, revenue reports. Operator-scoped.

**Onboarding/KYB Context** -- KYB document upload, payout account setup, operator settings.

**Auth/Operator Realm** -- Prerequisite. JWT encodes `operatorId`, `operatorUserId`, `role`, `requiresPasswordChange`.

## Key Entities

| Model | Key Columns | Constraints | Notes |
|-------|-------------|-------------|-------|
| Operator | id, legalName, brandName, contactPhone, contactEmail, status (OperatorStatus), taxClassification, taxCode, transportLicenseNumber, businessRegNumber, insurancePolicyRef, rejectionReason, disabledAt, applicationRef (@unique) | Status default `PENDING_REVIEW`. Only `APPROVED` operators are search-visible/bookable | `disabledAt` is back-compat; `status` is authoritative |
| OperatorUser | id, operatorId (FK->Operator), username (@unique), phone (@unique), contactPhone (NOT NULL), notificationPhone (NOT NULL), passwordHash, requiresPasswordChange (bool default true), displayName, role (OperatorRole: admin\|staff), disabledAt, lastBookingsViewedAt | `OperatorUser_phones_differ` CHECK dropped (migration `20260520010000`) | Username format: `BRAND_ACRONYM-last4phone` |
| OperatorSession | id, operatorUserId (FK), refreshTokenHash (@unique), tokenFamily, rotationCount, expiresAt, revokedAt | Token-family rotation with reuse detection | |
| Bus | id, operatorId (FK, tenant-scoped), capacity, licensePlate, busType (coach\|sleeper\|limousine), deactivatedAt, maintenanceStart, maintenanceEnd | `@@unique([operatorId, licensePlate])` | BusMaintenance for detailed records |
| BusMaintenance | id, busId (FK, onDelete: Cascade), startAt, endAt, reason | | |
| Route | id, origin, destination, operatorId (FK, onDelete: Restrict), durationMinutes, deactivatedAt, moderatedAt, originPlaceId (FK->Place?), destPlaceId (FK->Place?) | `@@index([origin, destination])`, `@@index([operatorId])` | Admin moderation via `moderatedAt` |
| Trip | id, routeId (FK), busId (FK), operatorId (FK, denormalized), departureAt, price (Int VND), status (TripStatus), salesClosed (bool), blockedSeats, cancelReason, cancelledAt, moderatedAt, departedAt, completedAt, recurringTemplateId (FK?), pairedTripId (self-ref?), cancellationPolicyId (FK?) | TripStatus: `scheduled \| departed \| completed \| cancelled`. SQL-only partial unique on `(recurringTemplateId, departureAt)` WHERE NOT NULL | I7-exempt for `/api/op/**` (operator IS price authority) |
| RecurringTripTemplate | id, operatorId (FK), routeId, busId, price, departureLocalTime (HH:MM Asia/Ho_Chi_Minh), daysOfMask (bitmask Mon=1...Sun=64), validFrom, validUntil, deactivatedAt | | Daily cron generates Trip rows for 14-day rolling horizon. Dedup via `RecurringGenerationLog` |
| OperatorPickupArea | id, operatorId (FK, onDelete: Cascade), provinceCode, districtCode, districtName, wardCode, wardName, name, addressLine, label, kind (station\|pickup), isActive, displayOrder | `@@index([operatorId, isActive])` | Deactivate (not delete) for referential integrity |
| StaffTripAssignment | id, operatorUserId (FK, onDelete: Cascade), tripId (FK, onDelete: Cascade), assignedAt, role (driver\|conductor\|checker?) | `@@unique([operatorUserId, tripId])` | Replaces V1 `OperatorUser.assignedTripId` |
| OperatorSettings | id, operatorId (@unique, 1:1), autoConfirmBookings, notificationPreference (sms\|email\|both), bookingReminderHours, customBrandingText | | |
| CancellationPolicy | id, operatorId (FK), name, rules (Json: `[{hoursBeforeDeparture, refundPercentage}]`), isDefault, effectiveFrom | At most one `isDefault` per operator | CPL 2023 compliance |
| Voucher | id, code (@unique), operatorId (FK?), discountType (fixed_amount\|percentage), discountValue, minOrderVnd, maxDiscountVnd, validFrom, validUntil, usageLimit, usedCount, isActive | NULL operatorId = platform-wide | |
| FeeConfig | id, operatorId (FK? Restrict), ratePpm (Int), effectiveFrom, effectiveTo (?), createdBy (?) | NULL operatorId = global default | ratePpm 60000=6%. Max 200000 (20%). Effective-dated |
| PayoutAccount | id, operatorId (@unique), bankName, accountNumber (AES-256-GCM encrypted), accountHolderName, verifiedAt (?), verifyMethod (?) | `verifiedAt IS NOT NULL` required for withdrawals | Masked to last-4 on all API responses |
| Payout | id, tripId (FK?), operatorId (FK), gross, platformFee, net, taxVat, taxPit, taxTotal, status (PayoutStatus), scheduledAt, settledAt, failureReason | PayoutStatus: `requested \| processing \| paid \| failed` | `tripId` null = on-demand withdrawal |
| LedgerEntry | id, operatorId (FK), bookingId (?), payoutId (? no FK), type (LedgerEntryType), amount (BigInt signed VND), currency, sourceEventId (@unique) | Immutable (BEFORE UPDATE/DELETE trigger) | Append-only |
| KybDocument | id, operatorId (FK, Restrict), type (business_license\|identity\|payout_account), storageKey, status (submitted\|accepted\|rejected), expiryDate (?), expiryAlertSentAt | `purgedAt` tracks storage object removal | |

## API Endpoints

| Method | Path | Auth | Description | Status Codes |
|--------|------|------|-------------|--------------|
| POST | `/api/op/auth/login` | Public (rate-limited) | Username+password login; Edge redirects to `/op/first-login` if `requiresPasswordChange=true` | 200, 400, 401 |
| POST | `/api/op/auth/password` | Operator JWT | Change password; mints new JWT with `requiresPasswordChange: false` in same tx | 200, 400, 401 |
| POST | `/api/op/auth/refresh` | Operator JWT (refresh cookie) | Rotate refresh token. Requires `X-CSRF-Token` header | 200, 401 |
| POST | `/api/op/auth/logout` | Operator JWT | Revoke session | 200 |
| POST | `/api/op/buses` | Operator JWT (admin) | Create bus | 201, 422 (`plate_in_use`) |
| PATCH | `/api/op/buses/:id` | Operator JWT (admin) | Update bus; capacity reduction guarded in `$transaction` + `SELECT FOR UPDATE` | 200, 422 (`plate_in_use`, `capacity_reduction_blocked`) |
| POST | `/api/op/buses/:id/deactivate` | Operator JWT (admin) | Soft-deactivate; blocked if future trips assigned | 200, 422 (`future_trips_assigned`) |
| PATCH | `/api/op/buses/:id/maintenance` | Operator JWT (admin) | Set maintenance window | 200, 409 (`maintenance_overlap`) |
| POST | `/api/op/routes` | Operator JWT (admin) | Create route | 201 |
| PATCH | `/api/op/routes/:id` | Operator JWT (admin) | Update route | 200 |
| POST | `/api/op/trips` | Operator JWT (admin) | Create trip (I7-exempt). Bus overlap + maintenance overlap in `$transaction` | 201, 409 (`maintenance_overlap`) |
| POST | `/api/op/trips/:id/paired-return` | Operator JWT (admin) | Create paired return trip | 201, 422 (`bus_overlap_with_outbound` -- SPEC CONFLICT: 422 here per AC6, 409 in `reassignBus`) |
| POST | `/api/op/trips/:id/cancel` | Operator JWT (admin) | Cancel trip. Idempotent (discriminated result). Cascades holds/bookings, enqueues refunds+SMS | 200 |
| POST | `/api/op/trips/:id/close-sales` | Operator JWT (admin) | Toggle `salesClosed` flag | 200 |
| POST | `/api/op/trips/:id/depart` | Operator JWT (admin or staff) | Mark departed. Sets `departedAt`, `salesClosed=true`, `status='departed'` | 200 |
| POST | `/api/op/trips/:id/complete` | Operator JWT (admin or staff) | Mark completed. Creates Payout row (`scheduledAt=completedAt+1d`) | 200 |
| PATCH | `/api/op/trips/:id/reassign-bus` | Operator JWT (admin) | Reassign bus | 200, 409 (`bus_overlap`) |
| GET | `/api/op/bookings` | Operator JWT | List bookings. Filter by `serviceDate` (UTC+7), `status`, `contactStatus`. Cursor-paginated | 200 |
| POST | `/api/op/bookings/:id/check-in` | Operator JWT | Boarding check-in. SET-ONCE atomic (`WHERE checkedInAt IS NULL`). Idempotent | 200 |
| POST | `/api/op/bookings/:id/no-show` | Operator JWT | Mark no-show. Guard: `checkedInAt IS NULL` | 200 |
| PATCH | `/api/op/bookings/:id/contact-status` | Operator JWT | Update call-queue status (`pending\|reached\|no_answer\|callback`) | 200 |
| POST | `/api/op/bookings/:id/confirm-cash` | Operator JWT (admin) | Confirm cash payment. `awaiting_payment -> paid` | 200 |
| GET | `/api/op/trips/:id/manifest` | Operator JWT | Passenger manifest: name, phone (masked last-4), ticket count, pickup, booking+check-in status | 200 |
| POST | `/api/op/pickup-areas` | Operator JWT (admin) | Create pickup/station area | 201 |
| PATCH | `/api/op/pickup-areas/:id` | Operator JWT (admin) | Update. Deactivate via `isActive=false` | 200 |
| POST | `/api/op/recurring-templates` | Operator JWT (admin) | Create recurring template | 201 |
| GET | `/api/op/balance` | Operator JWT | Operator balance (derived from ledger). Returns `{pending, available, paidOut}` | 200 |
| POST | `/api/op/payouts/withdraw` | Operator JWT (admin) | On-demand withdrawal. Guards: verifiedAt, balance, min 100K VND. Requires `idempotencyKey` | 201, 422 |
| GET | `/api/op/payouts` | Operator JWT | Payout history with status filter | 200 |
| GET | `/api/op/ledger` | Operator JWT | Ledger entries listing | 200 |
| PATCH | `/api/op/payout-account` | Operator JWT (admin) | Update bank account. Any edit resets `verifiedAt=null` | 200 |
| GET | `/api/op/reports/revenue` | Operator JWT | Revenue report by date range. Format: json or csv | 200 |
| POST | `/api/op/staff` | Operator JWT (admin) | Create staff member | 201 |
| GET | `/api/op/staff` | Operator JWT (admin) | List operator staff | 200 |
| POST | `/api/op/trips/:id/assign-staff` | Operator JWT (admin) | Assign staff to trip with role | 201 |
| GET | `/api/op/settings` | Operator JWT | Get operator settings | 200 |
| PATCH | `/api/op/settings` | Operator JWT (admin) | Update settings | 200 |
| POST | `/api/op/cancellation-policies` | Operator JWT (admin) | Create cancellation policy | 201 |
| POST | `/api/op/vouchers` | Operator JWT (admin) | Create voucher | 201 |
| POST | `/api/op/kyb-documents` | Operator JWT (admin) | Upload KYB document to S3 | 201 |
| GET | `/api/op/reviews` | Operator JWT | List reviews for operator's trips (read-only) | 200 |

**Tenant isolation rule:** `operatorId` is ALWAYS derived from the JWT claim, NEVER from the request body. Every query uses `withOperatorScope` or equivalent `WHERE operatorId = <jwt.operatorId>`.

## State Machine

### Trip Status (state-machines.md S1)

**States:** `scheduled` | `departed` | `completed` | `cancelled`. Orthogonal flag: `salesClosed`.

| From | To | Trigger | Guard |
|------|----|---------|-------|
| `scheduled` | `departed` | `markDeparted` (operator or staff) | Not cancelled. `SELECT FOR UPDATE` on Trip |
| `departed` | `completed` | `completeTripCore` (operator/staff or `autoCompleteTrips` cron) | `departedAt IS NOT NULL`. Not cancelled. `SELECT FOR UPDATE` |
| `scheduled` | `cancelled` | `cancelTrip` (operator) | `SELECT FOR UPDATE` on Trip |
| `departed` | `cancelled` | `cancelTrip` (operator) | `SELECT FOR UPDATE` on Trip |
| `completed` | `cancelled` | `cancelTrip` (operator) | `SELECT FOR UPDATE` on Trip |

**Side effects:**
- `-> departed`: Sets `departedAt=NOW()`, `salesClosed=true`
- `-> completed`: Sets `completedAt=NOW()`. Creates Payout (`status='requested'`, `scheduledAt=completedAt+1d`). Enqueues `payout_scheduled` NotificationLog with top-level `scheduledFor`
- `-> cancelled`: Sets `cancelledAt=NOW()`, `cancelReason`. Cascades: Bookings -> `trip_cancelled`, Holds -> `cancelled_trip`. Enqueues trip_cancelled SMS per affected booking. Post-commit: `refundOut` per paid booking

**Idempotency (discriminated result pattern):**
- `markDeparted`: if `departedAt IS NOT NULL` -> `{ alreadyDeparted: true }` HTTP 200
- `completeTripCore`: if `completedAt IS NOT NULL` -> `{ alreadyCompleted: true }` HTTP 200
- `cancelTrip`: if `status === 'cancelled'` -> `{ alreadyCancelled: true, cancelledBookings: 0 }` HTTP 200 (not 4xx)

### Payout Status (state-machines.md S4)

**States:** `requested` | `processing` | `paid` | `failed`. Terminal: `paid`.

| From | To | Trigger | Guard |
|------|----|---------|-------|
| *(creation)* | `requested` | `completeTripCore` (T+1 auto) or `requestWithdrawal` (on-demand) | Auto: `scheduledAt=completedAt+1d`. Withdrawal: verified PayoutAccount + `available >= amount` |
| `requested` | `processing` | `settlePayout` cron | `scheduledAt <= NOW()`, `FOR UPDATE SKIP LOCKED` |
| `processing` | `paid` | Bank transfer confirmed | Sets `settledAt` |
| `processing` | `failed` | Bank transfer rejected | Sets `failureReason` |
| `failed` | `requested` | Admin retry | `lib/ledger/retryPayout.ts` |

## Business Rules & Invariants

1. **I1 -- Concurrency Control (SELECT FOR UPDATE)** -- Every read-then-write on shared state runs in `$transaction` + `SELECT FOR UPDATE`. Enforcement: `lib/trips/*`, `lib/ledger/withdrawal.ts`, `lib/onboarding/operatorStatus.ts`.

2. **I7 -- No Client-Originated Price (customer endpoints)** -- Customer endpoints never accept price from request body. Operator endpoints (`/api/op/**`) are I7-exempt (operator IS price authority). Each exempt site carries `// I7-exempt:` comment. Enforcement: `lib/booking/initiateOnlineBooking.ts`.

3. **I9 -- No Raw Phone in NotificationLog Payload** -- `NotificationLog.recipient` is the sole PII column. `payload` JSON must NOT duplicate phone. Enforcement: `lib/trips/cancelTrip.ts`, `lib/trips/reassignBus.ts`.

4. **Capacity Guard (3-layer)** -- L1: conditional INSERT with advisory locks. L2: `SELECT FOR UPDATE` recount at payment. L3: per-phone hold cap. Enforcement: `lib/core/db/holdRepo.ts`, `lib/payment/applyPaidTransition.ts`.

5. **Bus Overlap Guard** -- Same bus cannot be on two trips with overlapping `[departureAt, departureAt + durationMinutes + 60min buffer]`. Enforcement: `lib/trips/busOverlap.ts` -> `createTrip`, `reassignBus`, `pairedReturn`.

6. **Maintenance Overlap Guard** -- Buses with active/future maintenance window cannot be assigned to overlapping trips. Enforcement: `lib/trips/createTrip.ts`, `lib/trips/reassignBus.ts`.

7. **salesClosed Gate** -- `salesClosed=true` trips excluded from search and hold creation. Enforcement: `lib/trips/searchTrips.ts`, `lib/core/db/holdRepo.ts`, `lib/trips/markDeparted.ts`.

8. **Ledger Immutability** -- LedgerEntry rows are append-only; no UPDATE or DELETE (PostgreSQL BEFORE trigger). Enforcement: migration SQL trigger `ledger_entry_immutable`.

9. **Payout Account Verification Gate** -- `PayoutAccount.verifiedAt IS NOT NULL` required for withdrawals. Any field edit resets `verifiedAt=null`. Enforcement: `lib/ledger/withdrawal.ts`, `lib/onboarding/payoutAccount.ts`.

10. **T+1 Settlement Delay** -- Revenue available only when `completedAt + 1 day <= NOW()`. Enforcement: `lib/ledger/constants.ts`, `lib/ledger/balance.ts`, `lib/trips/completeTripCore.ts`.

11. **BigInt Math** -- All VND x rate computations use BigInt (ES2017 constructor form `BigInt(n)`, no `n` literal suffix). Enforcement: `lib/ledger/feeConfig.ts`, `lib/ledger/calcPayout.ts`.

12. **Operator Bookable Gate** -- Hold creation and booking initiation re-verify `operator.status = 'APPROVED'` (closes suspend-after-search race). Enforcement: `lib/core/db/holdRepo.ts`, `lib/booking/initiateOnlineBooking.ts`.

13. **serviceDate Timezone** -- Booking list filter by `serviceDate` uses `${date}T00:00:00+07:00` window (Vietnam UTC+7). Enforcement: `lib/booking/listOperatorBookings.ts`.

14. **Fee Rate Encoding** -- `ratePpm` (parts-per-million). Default 60000=6%. Max `MAX_FEE_OVERRIDE_PPM=200000` (20%). Display: `ratePpm/10000=pct%`. Enforcement: `FeeConfig`, `lib/ledger/feeConfig.ts`.

## Frontend Surfaces

| Page | Path | Key Components | Notes |
|------|------|----------------|-------|
| Dashboard | `/op/dashboard` | Stat cards (trips, bookings, unviewed badge, available balance), Today's departures table, Quick actions (Create Trip / View Bookings / Withdraw), Day-1 onboarding checklist | Unviewed badge from `OperatorUser.lastBookingsViewedAt`. Balance derived from ledger |
| Revenue Reports | `/op/reports/revenue` | Date range filter (last 30 days default, Asia/Ho_Chi_Minh tz), Route filter, 4 summary cards (Gross/Commission/Tax/Net), Per-trip breakdown table, CSV export ("Xuat CSV") | Tax column only for `individual_household`. Date via `Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Ho_Chi_Minh'})` |
| Payout Dashboard | `/op/money` | Balance widget (Pending/Available/TotalPaid 3-col), T+1 explanation banner, Withdrawal form (min 100K VND, payout account gate), Payout history table, Failed payout alert | Failed payout banner: `role="alert"`, `aria-live="assertive"` |
| Settings | `/op/settings` | Platform fee display (current rate, effective date, worked example), Notification preferences | Fee rate: `ratePpm/10000`%. Promotional rate shown if active |
| Buses | `/op/buses` | Bus list with capacity, plate, type, maintenance status | Admin-only |
| Routes | `/op/routes` | Route list with origin/destination, duration | Admin-only |
| Trips | `/op/trips` | Trip list with status, departure, price, sales status | Admin-only for CRUD |
| Bookings | `/op/bookings` | Booking list with serviceDate filter, status filter, contact-status tracking | Cursor-paginated |
| Manifest | `/op/manifest/[tripId]` | Passenger list with check-in status, pickup info, payment badge | Phone masked to last-4 |

**Responsive behavior:**

| Viewport | Dashboard | Revenue | Payout |
|----------|-----------|---------|--------|
| Mobile (<768px) | 2-col stat grid, stacked departure cards | Stacked filters, horizontal-scroll table | Stacked balance cards, full-width form |
| Tablet (768-1023px) | 4-col stat grid, compact table | Side-by-side filters, scrollable table | 3-col balance, inline form |
| Desktop (1024px+) | 4-col stat grid, full table, inline quick actions | Inline filters, full table | 3-col balance, inline form+history |

**Accessibility:** Monetary values have `aria-label` with spelled-out amounts. Status badges use both color AND text.

## Regulatory Requirements

| Law/Decree | Requirement | Impact |
|------------|-------------|--------|
| Decree 10/2020/ND-CP | Operators must hold Transport Business License (Giay phep kinh doanh van tai) | KYB gate: `transportLicenseNumber` required; license expiry triggers 60-day alert cron |
| Decree 03/2021 (amended Decree 67/2023) | Mandatory passenger insurance per trip | `insurancePolicyRef` required at onboarding; verified during KYB review |
| E-Commerce Law 2025 (eff. July 2026) | Platform must withhold VAT ~3% + PIT ~1.5% from individual/household operators | `taxClassification` field; `tax_withheld` LedgerEntry type; tax column in revenue report |
| Circular 40/2021/TT-BTC | Rates for VAT and PIT withholding for individual/household transport operators | ~3% VAT + ~1.5% PIT = ~4.5% total. Displayed in payout breakdown |
| Circular 32/2025/TT-BTC | GDT e-invoice per booking at payment time | `EInvoice` model; `einvoiceSubmission` cron; `Booking.einvoiceRef` + `einvoiceIssuedAt` |
| ADR-004 D14 | Ministry of Transport can shut platform if unlicensed operator onboarded | KYB gate PENDING_REVIEW -> UNDER_REVIEW -> APPROVED; `OperatorStatus` state machine |

## Testing Strategy

### Unit Tests

- Fee calculation (`calcPlatformFeeMinor` BigInt domain -- edge cases where Number/BigInt diverge)
- Revenue report date derivation (UTC+7 timezone)
- Booking ref generation with `BOOKING_REF_REGEX`
- `serviceDate` timezone derivation (must NOT use `.toISOString().slice(0,10)` with UTC date)

### Integration Tests

- All fleet CRUD with real PostgreSQL
- Capacity guard layers (3): hold creation, payment webhook recount, phone-level cap
- State machine transitions for Trip (concurrent cancel/depart/complete)
- Payout creation at trip completion (`completeTripCore`)
- `$transaction` + `SELECT FOR UPDATE` for bus capacity reduction
- Bus overlap detection (`Promise.all` concurrent-write test)
- Settlement delay T+1 predicate in `balance.ts`
- NOT NULL grep on `prisma.trip.create`, `prisma.bus.create`, `prisma.route.create` before schema changes

### E2E Tests

- Operator login -> dashboard -> create bus -> create route -> create trip -> view manifest
- Check-in flow with CSRF header threading via `primeCsrf()`
- Cash payment confirmation flow
- Withdrawal request with payout account verification gate
- Revenue report CSV export
- Client barrel import guard: files with `'use client'` must NOT import `@/lib/auth` barrel
- RSC purity: `Date.now()` must not appear inside `export default async function <Name>Page(...)` body

## Cross-References

- **Architecture Decisions:** [ADR-004](../../architecture-decisions/ADR-004-multi-tenancy/README.md), [ADR-012](../../architecture-decisions/ADR-012-background-jobs/README.md), [ADR-016](../../architecture-decisions/ADR-016-module-boundaries/README.md), [ADR-019](../../architecture-decisions/ADR-019-state-machines/README.md)
- **Design Specifications:** [DS-001](../../design-specifications/DS-001-data-model/README.md), [DS-003](../../design-specifications/DS-003-api-contract/README.md), [DS-006](../../design-specifications/DS-006-background-jobs/README.md)
- **Frontend Design:** [FD-024](../../frontend-design/FD-024-operator-console/README.md)
- **Business/Domain:** [bounded-contexts.md](../../business/domain-model/bounded-contexts.md), [state-machines.md](../../business/domain-model/state-machines.md), [invariants-catalog.md](../../business/domain-model/invariants-catalog.md), [operator-personas.md](../../business/personas/operator-personas.md)
- **Regulatory:** [transport.md](../../business/regulatory/transport.md)
- **Scaffolding:** [SI-005](../../scaffolding-infra/SI-005-testing-strategy/README.md)

## Known Gaps & Open Questions

- **CRITICAL -- PSP split-settlement not implemented** -- ADR-004 S2 `NOT_IMPLEMENTED`. Actual implementation is central collection via single platform merchant account -- legally equivalent to "thu ho chi ho" requiring SBV IPS license. Go-live blocker (Issue 094).
- **HIGH -- `paid -> cancelled` customer-initiated transition gap** -- CPL 2023 Art. 29 grants 3-day cancellation right for remote contracts. `LEGAL_BOOKING_TRANSITIONS` has no `paid -> cancelled` for customer. Legal opinion needed on bus ticket exemption.
- **MEDIUM -- SPEC CONFLICT on `bus_overlap_with_outbound`** -- Returns HTTP 422 in `pairedReturn` (AC6) but 409 in `reassignBus` (I3). Both sites carry `// SPEC CONFLICT:` comments. Deferred to follow-up issue.
- **MEDIUM -- Subscription plan schema exists but no implementation** -- `SubscriptionPlan`/`OperatorSubscription` models defined but SaaS tier has no active implementation.
- **MEDIUM -- `operatorLicenseAlert` and `piiAnonymization` crons not yet built** -- ADR-012 `PARTIALLY_IMPLEMENTED`.
- **MEDIUM -- TOCTOU stranded payouts** -- If `processing -> paid/failed` cron crashes mid-flight, payout remains in `processing` indefinitely. Admin must manually intervene.
- **LOW -- Rate limiter fails open** -- Redis/Upstash downtime -> all requests pass through. DS-003 S11.2.
- **LOW -- Prisma 7.x `migrate diff` flag names removed** -- Run `node_modules/.bin/prisma migrate diff --help` before quoting CLI commands.
