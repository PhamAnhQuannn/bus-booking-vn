CODE REVIEW — PR #125 "feat(booking): remove pickup area system, simplify to station/custom toggle" @ 57ae7d56
────────────────────────────────────────────────────────────────────────────────────────────────────
Diff scope: 81 files, +238 / -3160 lines

PRIORITY 1 — Block push, fix first:

  [CORRECTNESS / DATA-LOSS] prisma/migrations/20260622100000_remove_pickup_area_system/migration.sql
    Migration Step 1 rescues `pickupAreaLabel` into `pickupDetail` only for `point` rows where
    `pickupDetail IS NULL AND pickupAreaLabel IS NOT NULL`. Step "Flip" then sets
    `customPickupRequested = true` for ALL `point` rows unconditionally — including any row
    where both `pickupAreaLabel IS NULL AND pickupDetail IS NULL`. After Steps 1+Flip+2, such
    rows will be: `pickupKind = 'custom', customPickupRequested = true, pickupDetail = NULL`.
    This violates the existing CHECK constraint `Hold_custom_requires_detail` /
    `Booking_custom_requires_detail` (migration 20260609040000): `NOT customPickupRequested OR
    (pickupDetail IS NOT NULL AND length(btrim(pickupDetail)) >= 5)`. The migration will fail
    at the CHECK validation if any `point` row has a null label.
    In normal operation `pickupAreaLabel` should always be populated for `point` rows (server
    resolved it from TripPickupArea.label, a non-nullable String). However, a concurrent
    deletion or any historical data inconsistency would trigger the CHECK violation and abort
    the entire migration, leaving the DB in a half-migrated state.
    Fix: Add a defensive fallback before the Flip step:
      UPDATE "Hold"
      SET "pickupDetail" = 'Diem don cu (chuyen doi)'
      WHERE "pickupKind" = 'point'::"PickupKind"
        AND "pickupDetail" IS NULL;
      UPDATE "Booking"
      SET "pickupDetail" = 'Diem don cu (chuyen doi)'
      WHERE "pickupKind" = 'point'::"PickupKind"
        AND "pickupDetail" IS NULL;
    This catches the gap between Step 1 (only writes when label IS NOT NULL) and Flip (sets
    customPickupRequested = true for ALL point rows). The fallback string is >= 5 chars.

  [CORRECTNESS / DATA-LOSS] prisma/migrations/20260622100000_remove_pickup_area_system/migration.sql
    For `point` rows that have BOTH a non-null `pickupAreaLabel` AND a non-null `pickupDetail`
    (the traveler typed a note like "goi truoc khi den" alongside the named stop), Step 1
    skips those rows because `pickupDetail IS NOT NULL`. After the migration the `pickupDetail`
    retains only the traveler note — the area name (`pickupAreaLabel`) is silently lost when
    the column is dropped in Step 4. Operators viewing historical bookings will see the note
    but not the stop name.
    Fix: For rows where both are non-null, concatenate:
      UPDATE "Hold"
      SET "pickupDetail" = "pickupAreaLabel" || ' - ' || "pickupDetail"
      WHERE "pickupKind" = 'point'::"PickupKind"
        AND "pickupDetail" IS NOT NULL
        AND "pickupAreaLabel" IS NOT NULL;
    (Same for Booking.) Run this BEFORE the existing Step 1. Adjust the pad step's WHERE to
    re-check length after concatenation (unlikely to produce <5 chars but be defensive).

  [DEAD CODE / CORRECTNESS] lib/trips/errors.ts:15 + app/api/op/trip-templates/route.ts:38-39
    The error code `'invalid_pickup_area'` remains in the `TripErrorCode` union (errors.ts:15)
    and is still caught/returned in the trip-templates route handler (route.ts:38-39). But the
    only code that ever threw this error (`resolveOwnedAreas` in snapshotPickupAreas.ts) was
    deleted in this PR. Dead error code in a union violates the CLAUDE.md Mistake Log rule
    (Issue 013): "when an error-code variant is added to a service's TripErrorCode, grep the
    service file for an actual throw of that code." The inverse is also a defect — a variant
    that can never be thrown is dead code and misleads future readers.
    Fix: Remove `'invalid_pickup_area'` from TripErrorCode in errors.ts. Remove the catch
    branch in app/api/op/trip-templates/route.ts:38-39. Remove the UI error mapping in
    app/op/(console)/trip-templates/TemplatesClient.tsx:59.

PRIORITY 2 — Fix before merge:

  [CORRECTNESS / UI] app/(customer)/booking/review/ReviewClient.tsx:176-184
    The pickup display for the `station` branch now unconditionally shows the hard-coded
    string "Tai ben xe". This is correct for the new two-branch model (custom vs station).
    However, the `custom` branch on line 179 renders `holdDetails.pickupDetail` WITHOUT
    a null/empty guard. pickupDetail is typed `string | null`. If for any reason a custom
    hold has a null pickupDetail (e.g. race condition, direct DB edit, or a hold created
    before the validation was tightened), the UI will render nothing after the warning label.
    Fix: Add a fallback: `{holdDetails.pickupDetail || '(khong co dia chi)'}`.

  [TEST COVERAGE] The `listOperatorBookings.ts` Prisma select now includes `pickupDetail`
    (line +2961) and drops `pickupAreaLabel` (line -2969). The `BookingQueueRow` interface
    and `toBookingQueueRow` mapper were both updated. However, no existing or new test
    verifies that the dashboard queue row correctly maps `pickupDetail` from the DB row
    through `toBookingQueueRow` to the UI table cell. The `DashboardClient.tsx` (line 917)
    and `StaffDashboardClient.tsx` (line 2441) both switched from `row.pickupAreaLabel` to
    `row.pickupDetail` — if the select or mapper has a typo, it silently renders "—" for all
    rows. The `operatorBookingQueue.int.test.ts` change only removed the `pickupAreaLabel`
    assertion but did not add a `pickupDetail` assertion.
    Fix: In `operatorBookingQueue.int.test.ts`, add
    `expect(booking).toHaveProperty('pickupDetail')` alongside the existing property checks.

  [DIFF HYGIENE] prisma/seed.ts:118 (line 4567 of diff)
    The removal of `import { listProvinces, listDistricts, listWards, resolveLabel }`
    leaves a blank line followed by another blank line (two consecutive blank lines) at the
    top of the file. Minor but triggers lint warnings in some configs.
    Fix: Remove the extra blank line.

  [DIFF HYGIENE] Documentation files under `documentation/current-status/` still reference
    the deleted pickup-area system extensively:
    - `09-lib-catalog.md` references `RoutePickupAreaServiceError`, `setRoutePickupAreas`,
      `PickupAreaServiceError`, `createOperatorPickupArea`, etc.
    - `10-lib-trips.md` references `invalid_pickup_area`, `resolveOwnedAreas`,
      `snapshotPickupAreas`, `setTripPickupAreas`, `TripPickupAreaItem`
    - `21-api-operator.md` references `/api/op/pickup-areas/**`, `/routes/[id]/pickup-areas`,
      `/trips/[id]/pickup-areas`
    These docs describe deleted code and will mislead anyone reading them.
    Fix: Update or remove the deleted sections in these three files.

PRIORITY 3 — Address when convenient:

  [NAMING / READABILITY] app/(customer)/booking/customer/CustomerForm.tsx
    Removing the block comment at the top of the file drops the only documentation of the
    component's responsibilities (pre-fill logic, sold-out handling, useActionState pattern).
    The inline comments explaining "why" (e.g. "Pre-fill buyer name from the logged-in
    customer's display name (AC4)") were also removed. While the code is self-explanatory for
    the pickup simplification, the AC reference comments aid traceability.
    Fix: Keep a one-line module-level comment and retain AC-reference comments.

  [NAMING / READABILITY] Several stale comments remain in non-documentation source files:
    - lib/booking/getManifest.ts:4 still references "pickupAreaLabel" in the module docstring
    - app/op/(console)/bookings/[id]/page.tsx:4 mentions "active pickup points"
    - lib/core/validation/route.ts:2-3 references "pickup-point schemas"
    - components/geo/AdminUnitPicker.tsx:7-8 references "the console pickup-area menu"
    Fix: Update the stale comments to reflect the simplified model.

  [DIFF HYGIENE] The PR includes 11 documentation guide renames (setup-github.md ->
    01-setup-github.md, etc.) that are unrelated to the pickup-area removal. These are
    pure renames with no content changes but they inflate the diff and make review harder.
    Fix: Split into a separate PR or at minimum note in the PR body that these are unrelated.

  [DEAD CODE] `app/op/(console)/trip-templates/TemplatesClient.tsx:59` still has a switch
    case mapping `'invalid_pickup_area'` to a Vietnamese error string. This case can never
    trigger since `createTemplate` no longer validates pickup areas. Benign but misleading.
    (Covered by the P1 above; listing here for completeness of the dead-code audit.)

SUMMARY: 3 P1, 4 P2, 4 P3
