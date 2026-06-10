---
depends-on: [109-pickup-v2-schema-migration]
type: FEATURE
labels: [pickup-areas, customer, operator, notification]
---

## Parent PRD

`issues/prd-pickup-areas.md` · design `docs/design/pickup-points-v2.md` §2.3, §4, §5, §7 P2, §8

## What to build

Design phase **P2 — custom request**: a traveler whose pickup is not on the list types a free-text location;
the operator is flagged + notified and phones them back. This is the riskiest surface in the v2 design — the
4-agent QA found it half-built (silently drops at the paid moment in code) and half-thought (no traveler
expectation-setting, operator spam). **All P0 fixes below are required for the feature to function, not
optional hardening.**

- **`area`→`point` reader sweep** (§8) + **3-way picker** (`CustomerForm.tsx`): third group
  "Điểm đón khác (ghi rõ)" reveals a **required** free-text input (≥5 chars trimmed).
- **3-way validator** (`lib/booking/pickupSelection.ts`): `station`/`point` → `areaId` ∈ trip set;
  `custom` → free text required, no `areaId`.
- **Holds route** (`app/api/holds/route.ts`): add the missing `custom` branch →
  `pickupKind='custom', customPickupRequested=true, pickupDetail=<text>, pickupAreaId=null`.
- **Booking snapshot from Hold** (`bookingRepo.ts`) + **manifest** highlight + **operator notification**.

### P0 — verbatim-follow-of-design ships broken without these

- **P0-1 — §8 grep checklist is incomplete.** Grep the safe anchor `'station'` (not just `'area'`) — every
  union carrying `station` needs `point|custom`. Sites the design OMITS:
  - `lib/core/validation/hold.ts:30` — `z.enum(['station','area'])` on the **holds request body**. Not fixed →
    API 422-rejects every `point`/`custom`. **Gating; whole flow dead on arrival.**
  - `app/op/staff/dashboard/StaffDashboardClient.tsx:346` — `=== 'area'` → post-rename mislabels every door
    booking as "Tại bến" (green tsc, wrong UI).
  - `lib/api/holdsClient.ts:21`, `lib/core/db/holdRepo.ts:48`, `app/api/holds/route.ts:67-72`,
    `lib/booking/getManifest.ts:22` (union) **+ `:92` the `as` cast** — replace the unchecked cast with an
    exhaustive map (it currently launders a real `custom` value into a too-narrow type), `getOperatorBooking.ts:28`.
  - Widen `ManifestRow.pickupKind` to `'station'|'point'|'custom'` AND add `customPickupRequested` to the row shape.
- **P0-2 — custom silent-drop chain.** The holds route has no `custom` branch (falls through to `station`
  default, drops `pickupDetail`); `validatePickupSelection` has no `custom` case. **Derive
  `customPickupRequested` in SQL from `pickupKind='custom'`** in the Booking INSERT — do NOT copy a second
  independent boolean Hold→Booking (drift risk, Issue-008 class). Grep `pickupAreaLabel` to find both INSERT
  sites; they move together.
- **P0-3 — notification branches on unfetched data.** `processWebhook.ts:105-132` select does NOT include
  `customPickupRequested`/`pickupDetail`/`tripId` — extend it. Place the `operatorCustomPickupRequest` enqueue
  **inside the `if (updated > 0)` guard (`:205`)** next to `operatorNewBooking` (`:303`) so IPN replay can't
  double-notify.

### P1 — real-user harm

- **Traveler expectation (P1-1)**: custom is fire-and-forget with operator-ack deferred (§5.4), yet traveler
  pays full. Before-submit copy: "Điểm đón này chưa được xác nhận. Nhà xe sẽ gọi xác nhận." Render custom on
  review/ticket/manifest with a distinct **"Chờ nhà xe xác nhận"** badge — NOT identical to a confirmed point
  (today `ReviewClient.tsx:177-184` would show raw free-text as a real stop). Surface operator callback phone
  on confirmation.
- **Manifest re-call ambiguity (P1-2 / operator P2.3)**: `getManifest.ts:25` already exposes `contactStatus`.
  Gate the warning-row highlight on `contactStatus === 'pending'`, not the raw custom flag, so a contacted row
  de-highlights — staff can't otherwise tell who they already phoned on a 40-seat manifest.
- **Notification spam + phantom email (operator P2.1/P2.2)**: there is **no `notificationEmail` column**
  (`schema.prisma:58-60` has `notificationPhone?` only) — drop the §5 "email" half (SMS-only, matching
  `operatorNewBooking`) or it silently falls back to business `contactEmail`. Don't send a second SMS per
  booking — **fold "có yêu cầu điểm đón riêng" into the existing `operatorNewBooking` template**, or aggregate
  per-trip. New template/renderer lives in `lib/notification/esms.ts` (re-exported via `lib/notification/index.ts`),
  dispatched by `lib/notification/dispatchNotifications.ts` core. Add requested-text to logger redaction list (PII).

### P2 — integrity

- **Trust trip snapshot over client kind (edge P2-3)**: holds route currently trusts the client-submitted
  `pickupKind`. Derive `pickupKind` for station|point from the already-fetched `tripPickupArea.kind`; trust the
  client only to distinguish custom-vs-listed.

## Acceptance criteria

- [ ] `area`→`point` swept across ALL sites incl. `hold.ts` validator, `StaffDashboardClient`, `holdsClient`,
      `holdRepo`, `getManifest` (union + the `:92` cast→exhaustive map), `getOperatorBooking`; grep `'station'` confirms none missed.
- [ ] Customer picker has the 3rd "Điểm đón khác" group revealing a required ≥5-char input (focus-moved, `aria-required`/`aria-invalid`/`aria-describedby` wired).
- [ ] `validatePickupSelection` is 3-way; server returns 422 on custom-without-detail and on foreign `areaId`.
- [ ] Holds route has a `custom` branch; `customPickupRequested` is **derived in SQL** from `pickupKind='custom'` at Booking INSERT (no copied second column); integration test asserts a custom hold→booking carries kind+detail+flag.
- [ ] `processWebhook` select includes `customPickupRequested`+`pickupDetail`; the custom-pickup enqueue is inside the `updated>0` guard; IPN-replay test asserts exactly one notification.
- [ ] Custom renders with a "Chờ nhà xe xác nhận" badge on review + ticket + manifest, distinct from a confirmed point; operator phone shown on confirmation.
- [ ] Manifest custom-row highlight is gated on `contactStatus==='pending'`; `ManifestRow.pickupKind` widened + `customPickupRequested` on row.
- [ ] No second SMS per custom booking (folded or aggregated); no email channel referenced unless `notificationEmail` is added; requested text in the logger redaction list.
- [ ] Holds route derives `pickupKind` (station|point) from `tripPickupArea.kind`, not raw client input.
- [ ] `pickupSelection.test.ts` + `createTrip.test.ts` + any `e2e/**`/`prisma/seed.ts` `'area'` literal flipped to `'point'` (grep `pickupKind.*area` across `e2e/`, `seed.ts`, `**/__tests__/**`).
- [ ] `pnpm tsc --noEmit` + `pnpm test` green.

## Blocked by

- Blocked by `issues/109-pickup-v2-schema-migration.md` (`PickupKind` `custom` value + `customPickupRequested` column + CHECK).

## QA provenance

2026-06-09 4-agent QA of `docs/design/pickup-points-v2.md`: edge P1-1/P1-2/P1-4/P2-3/P3-1/P3-2/P3-4, consistency
P0-1/P0-2 (§8 + webhook select), traveler P1.1/P1.2/P2.4/P3.4, operator P2.1/P2.2/P2.3/P2.4.
