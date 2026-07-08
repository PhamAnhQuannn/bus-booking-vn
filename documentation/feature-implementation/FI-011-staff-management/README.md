# FI-011: Staff Management (Quan ly nhan vien)

> **Status:** DOCUMENTED — PHASE 2 DEFERRED
> **Last Updated:** 2026-06-21
> **Related:** ADR-004, ADR-016, ADR-019, DS-001, DS-003, FD-030
>
> **Phase 1 Scope:** Single operator user per company (`role='admin'` only). Staff creation, trip assignment, RBAC enforcement, and mobile staff console are all deferred to Phase 2. Phase 1 operators manage all fleet, trip, and boarding operations through the admin role. This document remains the canonical spec for Phase 2 implementation.

## Overview

Staff Management covers the creation, assignment, and access control of `OperatorUser` records with `role='staff'` within an operator tenant. Staff are field personnel (drivers, conductors, checkers) who access a restricted view of the same `/op/` portal as operator admins, scoped to their assigned trips, passenger manifests, check-in, and trip status actions only. The feature spans both the admin-side management (creating/assigning staff) and the staff-side console (mobile-optimized field view).

## Scope & Boundaries

### In Scope

- Staff creation by operator admin (generates `BRAND_ACRONYM-last4phone` username)
- Staff listing
- Staff trip assignment with role tagging (driver/conductor/checker) via `StaffTripAssignment`
- Staff login (same `/op/login` flow as operator admin)
- Restricted staff dashboard (today's assigned trips only)
- Passenger manifest view with phone masking (last 4 digits)
- Check-in (optimistic UI, SET-ONCE atomic conditional update)
- No-show marking (long-press with confirmation, mutually exclusive with check-in)
- Mark departed and mark completed
- PDF manifest download
- Offline `sessionStorage` cache for manifest data
- Mobile-first UX (56px touch targets, bottom nav)

### Out of Scope

- Fleet management (buses/routes/trips CRUD) -> [FI-003](../FI-003-fleet-management/README.md), [FI-004](../FI-004-route-management/README.md), [FI-005](../FI-005-trip-management/README.md)
- Financial data (revenue, payouts, balance) -> [FI-010](../FI-010-payout-system/README.md)
- Settings and profile management -> [FI-009](../FI-009-operator-console/README.md)
- Cancellation policies, vouchers, KYB documents -> [FI-009](../FI-009-operator-console/README.md)
- Customer auth -> [FI-001](../FI-001-core-auth/README.md)

### Bounded Context(s)

**Auth/Operator Realm** -- OperatorUser model (shared with operator admin, distinguished by `role`), OperatorSession, JWT with `operatorId` + `role` + `requiresPasswordChange` claims.

**Fleet/Catalog Context** -- StaffTripAssignment join table, Trip model (read + status transitions only for staff).

**Booking Context** -- Check-in (SET-ONCE atomic), no-show, manifest read (phone masked).

## Key Entities

| Model | Key Columns | Constraints | Notes |
|-------|-------------|-------------|-------|
| OperatorUser | id (CUID PK), operatorId (FK->Operator), username (@unique, `BRAND_ACRONYM-last4phone`), phone (@unique), contactPhone (NOT NULL), notificationPhone (NOT NULL), passwordHash (bcrypt), requiresPasswordChange (bool default true), displayName, role (OperatorRole: admin\|staff, default admin), disabledAt, lastBookingsViewedAt | `contactPhone` and `notificationPhone` may be identical. `OperatorUser_phones_differ` CHECK constraint DROPPED (migration `20260520010000`) | Staff uses same table with `role=staff`. `requiresPasswordChange=true` on provision; Edge middleware redirects to `/op/first-login` |
| OperatorSession | id (CUID PK), operatorUserId (FK->OperatorUser, onDelete: Cascade), refreshTokenHash (@unique), tokenFamily, rotationCount, expiresAt, revokedAt | Token-family rotation with reuse detection | |
| StaffTripAssignment | id (CUID PK), operatorUserId (FK->OperatorUser, onDelete: Cascade), tripId (FK->Trip, onDelete: Cascade), assignedAt, role (String?: driver\|conductor\|checker) | `@@unique([operatorUserId, tripId])` | V2 replaces V1 `OperatorUser.assignedTripId` single-assignment FK. Supports multi-trip assignment |

**Note:** V1 staff view used `OperatorUser.assignedTripId` (FK to single trip). FD-030 S2.2 still describes this V1 model. DS-001 S2.17 documents the V2 `StaffTripAssignment` join table as canonical.

## API Endpoints

| Method | Path | Auth | Description | Status Codes |
|--------|------|------|-------------|--------------|
| POST | `/api/op/staff` | Operator JWT (admin role) | Create staff member. Generates username `BRAND_ACRONYM-last4phone`. Sets `requiresPasswordChange=true` | 201 |
| GET | `/api/op/staff` | Operator JWT (admin role) | List operator staff members | 200 |
| POST | `/api/op/trips/:id/assign-staff` | Operator JWT (admin role) | Assign staff to trip with role. Body: `{ operatorUserId, role? }` | 201 |
| POST | `/api/op/trips/:id/depart` | Operator JWT (admin **or** staff) | Mark trip departed. Sets `departedAt`, `salesClosed=true`, `status='departed'` | 200 |
| POST | `/api/op/trips/:id/complete` | Operator JWT (admin **or** staff) | Mark trip completed. Triggers payout creation | 200 |
| POST | `/api/op/bookings/:id/check-in` | Operator JWT (admin or staff) | Boarding check-in. Atomic `UPDATE WHERE checkedInAt IS NULL`. Idempotent | 200 |
| POST | `/api/op/bookings/:id/no-show` | Operator JWT (admin or staff) | Mark no-show. Guard: `checkedInAt IS NULL` | 200 |
| GET | `/api/op/trips/:id/manifest` | Operator JWT (admin or staff) | Passenger manifest. Phone masked to last 4 | 200 |

**Staff-blocked endpoints** (return 403 `INSUFFICIENT_ROLE`): All fleet management (`/api/op/buses/**`, `/api/op/routes/**`), financial endpoints (`/api/op/payouts/**`, `/api/op/balance`, `/api/op/ledger`, `/api/op/reports/**`), settings (`/api/op/settings`), staff management (`/api/op/staff` POST/GET limited to admin role).

## State Machine

### Staff-Triggered Trip Transitions

**Mark Departed** (`scheduled -> departed`):

| From | To | Trigger | Guard |
|------|----|---------|-------|
| `scheduled` | `departed` | `markDeparted` (operator or staff) | Not cancelled. `SELECT FOR UPDATE` on Trip |

Side effects: `departedAt=NOW()`, `salesClosed=true`. Blocks further bookings. Idempotent: if `departedAt IS NOT NULL` -> `{ alreadyDeparted: true }`.

**Mark Completed** (`departed -> completed`):

| From | To | Trigger | Guard |
|------|----|---------|-------|
| `departed` | `completed` | `completeTripCore` (operator/staff or `autoCompleteTrips` cron) | `departedAt IS NOT NULL`. Not cancelled. `SELECT FOR UPDATE` on Trip |

Side effects: `completedAt=NOW()`, `status='completed'`. Creates Payout row (`status='requested'`, `scheduledAt=completedAt+1d`). Enqueues `payout_scheduled` NotificationLog with top-level `scheduledFor` column. Idempotent: if `completedAt IS NOT NULL` -> `{ alreadyCompleted: true }`.

### Booking Check-In (`paid -> completed`)

Atomic: `UPDATE Booking SET checkedInAt=NOW(), status='completed' WHERE id=? AND checkedInAt IS NULL`. If second call: condition matches zero rows -> no-op (conflict already resolved correctly).

### No-Show (`paid -> no_show`)

Guard: `checkedInAt IS NULL` (mutually exclusive with check-in). Sets `noShowAt=NOW()`, `status='no_show'`.

## Business Rules & Invariants

1. **RBAC Enforcement** -- `role='staff'` OperatorUsers cannot access financial data, fleet management, or settings. Checked at both Edge middleware (route redirect) and API-level (`requireOperatorAuth` guard checks role). Enforcement: `proxy.ts` Edge middleware, route handler `requireOperatorAuth`.

2. **Check-in SET-ONCE** -- `checkedInAt` is SET-TRUE-ONLY via `WHERE checkedInAt IS NULL`. Cannot be unset. Mutually exclusive with `noShowAt`. Enforcement: `lib/booking/checkIn.ts`.

3. **No-show Mutual Exclusion** -- Cannot mark no-show if `checkedInAt IS NOT NULL`. Enforcement: route handler guard.

4. **Assignment Scope** -- `StaffTripAssignment` is operator-scoped via `OperatorUser.operatorId`. Staff cannot be assigned to trips of another operator. Enforcement: `withOperatorScope` applied when resolving trip assignments.

5. **Username Format** -- `BRAND_ACRONYM-last4phone` (uppercase, diacritics stripped, collision suffix `-N`). Enforcement: `lib/auth/operatorUsername.ts`.

6. **requiresPasswordChange Edge Gate** -- Edge middleware reads JWT claim `requiresPasswordChange`. If `true`, redirects to `/op/first-login`. Allowlist is exact-match `Set` (NOT `startsWith`). Fresh JWT with `requiresPasswordChange: false` minted in same tx as DB update. Enforcement: `proxy.ts`, `lib/auth/operatorAuthService.ts`.

7. **Trip Completion + Timestamp Co-Write** -- `completedAt` write must be in same `tx.update` call as `status: 'completed'` (ADR-019 D4 rule: every `<verb>At` column within 3 lines of `status:` write). Enforcement: `lib/trips/completeTripCore.ts`.

8. **scheduledFor as Top-Level Column** -- `NotificationLog.scheduledFor` is a top-level indexed column (NOT in JSON payload), so the payout cron can use index scan. Enforcement: `lib/trips/completeTripCore.ts`, `@@index([template, scheduledFor])`.

9. **Staff Redirect from Protected Routes** -- `/op/buses/**`, `/op/routes/**`, `/op/trips/new`, `/op/trips/[id]/edit`, `/op/money/**`, `/op/reports/**`, `/op/settings`, `/op/profile`, `/op/staff` -- all redirect staff to dashboard. Enforcement: Edge middleware (exact-match set).

10. **Phone Placeholder Format** -- PII placeholders in test/seed files must use literal-x mask (`+8490xxxxxx[N]`) to escape PII detection regex. Enforcement: SI-004, SI-005 S6.1.

11. **contactPhone + notificationPhone NOT NULL** -- Both columns are NOT NULL; the `OperatorUser_phones_differ` CHECK constraint was dropped because provisioning sets both to the same login phone. Enforcement: DB migration.

## Frontend Surfaces

| Page | Path | Key Components | Notes |
|------|------|----------------|-------|
| Login | `/op/login` | Phone input (+84 format), OTP verification (6-digit), first-login password change | Same flow as operator admin |
| Staff Dashboard | `/op/dashboard` (staff view) | Today's assigned trips only (no stat cards, no revenue/balance, no quick actions, no onboarding checklist) | Trip cards: route, bus plate, departure time, seat count, status badge |
| Manifest | `/op/manifest/[tripId]` | Passenger list (status icon, name, pickup (Phase 2 — station-only in Phase 1), payment badge), boarding counter (`{checkedIn}/{total} da len xe`), progress bar, refresh button, PDF download | 56px min row height, high contrast, offline-resilient |
| Check-in | (on manifest) | Tap empty circle -> immediate optimistic green CheckCircle -> background POST -> atomic conditional update | Network error: revert to empty circle, toast "Khong the xac nhan. Thu lai." |
| No-show | (on manifest) | Long-press (500ms) -> confirmation dialog -> XCircle (red) + strikethrough | |
| Trip Actions | (sticky footer on manifest) | `scheduled`: "Xe da khoi hanh" (orange); `departed`: "Hoan thanh chuyen" (green); `completed`/`cancelled`: no button | Full-width, confirmation dialog required |

**Role-based navigation filtering (`visibleNavItems(role)`):**

| Nav Item | Label (VI) | Admin | Staff |
|----------|-----------|-------|-------|
| Dashboard | Tong quan | Visible | Visible |
| Buses | Xe khach | Visible | Hidden |
| Routes | Tuyen duong | Visible | Hidden |
| Trips | Chuyen di | Visible | Hidden |
| Bookings | Dat ve | Visible | Hidden |
| Money | Tai chinh | Visible | Hidden |
| Revenue | Doanh thu | Visible | Hidden |
| Activity | Thong bao | Visible | Visible |
| Settings | Cai dat | Visible | Hidden |
| Staff | Nhan vien | Visible | Hidden |

Mobile bottom nav (staff): 3 items only -- Tong quan / Thong bao / Dang xuat.

**Payment status badges:**

| Status | Badge (VI) | Color |
|--------|-----------|-------|
| Paid online | Da TT | Green pill |
| Cash | Tien mat | Amber pill |

**Offline resilience:**

| Strategy | Implementation |
|----------|---------------|
| Cache manifest | `sessionStorage.setItem('manifest_{tripId}', JSON.stringify(data))` |
| Serve from cache | Read from `sessionStorage` on network failure; show "Du lieu ngoai tuyen" banner |
| Check-in queue | Failed requests queued in `sessionStorage`, retried on reconnect |
| PDF fallback | Downloaded PDF works fully offline |

**Responsive behavior:**

| Viewport | Dashboard | Manifest |
|----------|-----------|----------|
| Mobile (<768px) | Full-width trip cards, bottom nav (3 items) | Full-width passenger list, sticky bottom button, 56px rows |
| Tablet (768-1023px) | 2-column trip card grid, sidebar nav | Same as mobile with wider rows |
| Desktop (1024px+) | 2-column grid, sidebar nav | Table layout with all columns, inline action button |

**Touch targets** (field conditions): Check-in circle 48x48px; Passenger row full-width x 56px; Action buttons full-width x 48px; Refresh button 44x44px.

## Regulatory Requirements

| Law/Decree | Requirement | Impact |
|------------|-------------|--------|
| Decree 10/2020/ND-CP | Operators must maintain qualified drivers (license class D, E) | `StaffTripAssignment.role='driver'` tracks driver assignment per trip; supports compliance evidence |
| transport.md S6 | Some routes require passenger manifests submitted to authorities | Manifest API + PDF download support regulatory data provision on request |
| PDPL 2025 / Decree 13/2023 | PII minimization; phone numbers masked in manifest | Manifest returns phone masked to last 4 digits |
| Consumer Protection Law 2023 | Accurate boarding confirmation | Check-in SET-ONCE prevents double-check-in fraud |

## Testing Strategy

### Unit Tests

- `visibleNavItems(role='staff')` returns correct hidden/visible set
- Username generation `BRAND_ACRONYM-last4phone` (diacritics stripped, collision suffix)
- Role-based navigation filter is deterministic

### Integration Tests

- Atomic SET-ONCE check-in: `Promise.all` concurrent check-in calls result in exactly one `checkedInAt` set; second call is no-op
- No-show mutual exclusion: attempt no-show after check-in -> error
- Staff trip assignment uniqueness: duplicate `@@unique([operatorUserId, tripId])` constraint violation
- `requiresPasswordChange` JWT claim -> Edge redirect (middleware test)
- NOT NULL grep before any `OperatorUser` schema changes: `prisma.operatorUser.create` and `INSERT INTO "OperatorUser"` across `e2e/**`, `prisma/seed.ts`, `**/__tests__/**` -- both `contactPhone` AND `notificationPhone` with PII-safe placeholders (`+8490xxxxxx[N]`)

### E2E Tests

- Staff login flow: phone -> OTP -> first-login password change -> dashboard
- Manifest load, check-in tap (optimistic UI + network error recovery)
- Offline sessionStorage cache behavior
- PDF manifest download
- CSRF header required on all POST mutations via `primeCsrf()`
- Hex mock hygiene: `Buffer.from(s, 'hex')` for SHA-256 must use 64-char hex-valid strings (`'a'.repeat(64)`)
- Client barrel guard: staff manifest components with `'use client'` must not import `@/lib/auth` barrel

## Cross-References

- **Architecture Decisions:** [ADR-004](../../architecture-decisions/ADR-004-multi-tenancy/README.md), [ADR-016](../../architecture-decisions/ADR-016-module-boundaries/README.md), [ADR-019](../../architecture-decisions/ADR-019-state-machines/README.md)
- **Design Specifications:** [DS-001](../../design-specifications/DS-001-data-model/README.md), [DS-003](../../design-specifications/DS-003-api-contract/README.md)
- **Frontend Design:** [FD-030](../../frontend-design/FD-030-staff-console/README.md)
- **Business/Domain:** [bounded-contexts.md](../../business/domain-model/bounded-contexts.md), [state-machines.md](../../business/domain-model/state-machines.md), [invariants-catalog.md](../../business/domain-model/invariants-catalog.md), [operator-personas.md](../../business/personas/operator-personas.md)
- **Regulatory:** [transport.md](../../business/regulatory/transport.md), [data-privacy.md](../../business/regulatory/data-privacy.md)
- **Scaffolding:** [SI-005](../../scaffolding-infra/SI-005-testing-strategy/README.md)

## Known Gaps & Open Questions

- **HIGH -- V1 vs V2 assignment model discrepancy** -- FD-030 S2.2 still describes V1 `assignedTripId` (single-assignment FK). DS-001 S2.17 documents V2 `StaffTripAssignment` join table as canonical. FD-030 must be updated.
- **HIGH -- Staff "all today's trips" fallback when unassigned** -- In V2, no `StaffTripAssignment` rows means no assigned trips. Filtering logic for unassigned staff needs specification.
- **MEDIUM -- Manifest endpoint path discrepancy** -- FD-030 S5.4 references `/api/op/manifest/{tripId}/checkin` and `/api/op/manifest/{tripId}/no-show`. DS-003 S7.5 lists them as `/api/op/bookings/:id/check-in` and `/api/op/bookings/:id/no-show`. Path needs resolution.
- **MEDIUM -- Operator access JWT 15-min TTL** -- Staff using manifest in the field for a long shift must call `POST /api/op/auth/refresh` periodically or mutations 401 past 15 min. No auto-refresh implemented.
- **MEDIUM -- PDF manifest server-side generation** -- Spec mentions "server-side A4 PDF manifest" but no cron or endpoint for PDF is listed in DS-003.
- **LOW -- `autoCompleteTrips` cron as fallback** -- If staff forget to mark a trip completed, cron auto-completes departed trips. Spec does not define how long after expected arrival the cron fires.
- **LOW -- No OTP lockout reset endpoint for staff** -- 3 failed OTP verifications -> 15-min lockout. No admin-side unlock endpoint documented.
