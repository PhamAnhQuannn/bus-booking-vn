# Dead Code Scan

Date: 2026-06-12  
Scope: Full codebase — files, exports, schema columns, enum values, routes, deps  
Prior scan: 2026-06-05 (no knip.json, noisy)

## Summary

4 dead production components confirmed still dead (`KpiTile`, `DetailLayout`, `DataTable`, `FilterBar` — all in `components/op/`). `lib/catalog/updatePickupPoint.ts` was deleted since the prior scan. `Trip.pairedTripId` is a zombie DTO field with no active route/service consumer after paired-return deletion. `CharterStatus.SUBMITTED` is a reachable-in-theory but never-created state value; all three non-`pending` `ContactStatus` values (`reached`, `no_answer`, `callback`) have read infrastructure but zero production write paths. `shadcn` is misclassified as a production dependency (should be `devDependencies`). `tw-animate-css` is CSS-only. Estimated cleanup effort: 2–3 hours for P1 items, 4–6 hours for schema/enum cleanup with migrations.

---

## Prior Scan Status (2026-06-05 findings)

| Item | Was dead? | Now dead? | Action taken since? |
|---|---|---|---|
| `components/op/KpiTile.tsx` | Yes | **Yes** | None — still 0 importers |
| `components/op/DetailLayout.tsx` | Yes | **Yes** | None — still 0 importers |
| `lib/catalog/updatePickupPoint.ts` | Yes | **No — deleted** | Deleted (file no longer exists) |
| `components/op/DataTable.tsx` | Possibly | **Yes** | None — confirmed 0 importers |
| `components/op/FilterBar.tsx` | Possibly | **Yes** | None — confirmed 0 importers |
| `@sentry/nextjs` unlisted dep | Unlisted | **Not installed** | Not in package.json — deferred to go-live |
| `lint-staged` unused devDep | Suspect | **Active** | Wired to husky pre-commit; used |

---

## P1 — Dead Production Code (safe to delete)

### 1. `components/op/KpiTile.tsx`
Zero importers in all of `app/`, `lib/`, `components/`. No barrel re-export. Grep for `KpiTile` across the entire codebase yields no matches outside the file itself.

### 2. `components/op/DetailLayout.tsx`
Zero importers in all of `app/`, `lib/`, `components/`. No barrel re-export. Grep for `DetailLayout` yields no matches outside the file itself.

### 3. `components/op/DataTable.tsx`
Zero importers in all of `app/`, `lib/`, `components/`. No barrel re-export. Grep for `DataTable` yields no matches outside the file itself.

### 4. `components/op/FilterBar.tsx`
Zero importers in all of `app/`, `lib/`, `components/`. No barrel re-export. Grep for `FilterBar` yields no matches outside the file itself.

**Deletion command:**
```
rm components/op/KpiTile.tsx components/op/DetailLayout.tsx components/op/DataTable.tsx components/op/FilterBar.tsx
```

---

## P2 — Likely Dead (needs manual verification)

### 1. `Trip.pairedTripId` column (zombie field)

The paired-return routes were deleted in Issue 040. The `pairedTripId` column still exists on the `Trip` model. All current references are DTO pass-through only — no route, service, or business-logic function reads this field for decision-making:

- `lib/trips/createTrip.ts:32,47,113` — accepted as optional param, passed to DB
- `lib/trips/toTripDto.ts:18,47` — copied into `TripDto.pairedTripId`
- `lib/trips/tripDto.ts:21` — DTO interface field declaration
- `lib/trips/__tests__/*.test.ts` — only asserted as `null` (4 files)

No route handler, no service function, no UI component reads `pairedTripId` for any purpose other than "reflect it back from the DB." The column is a zombie — kept alive only by the DTO round-trip. Dropping it requires a migration + removing from `createTrip.ts` inputs + stripping from the DTO interface and `toTripDto.ts`.

**Verification needed:** Confirm no external integration (e.g. a future paired-return feature) needs the FK. Then safe to file a cleanup issue.

### 2. `CharterStatus.SUBMITTED` enum value

The state machine defines `SUBMITTED → [ADMIN_REVIEW, CANCELLED]` but no code path ever creates a row in `SUBMITTED` status. `lib/charter/createCharterRequest.ts:105` documents this explicitly: "the submit IS SUBMITTED→ADMIN_REVIEW; we create DIRECTLY in ADMIN_REVIEW." The value exists in the transition table and `CUSTOMER_CANCELLABLE_STATUSES` set but is unreachable in practice.

**Risk of removing:** The schema enum change requires a migration. Since no row in the DB should ever have `status = 'SUBMITTED'`, the migration is safe — but should confirm with `SELECT count(*) FROM "CharterRequest" WHERE status = 'SUBMITTED'` before running. Mark P2 because the state machine code was clearly designed to handle this state; removing it requires careful coordination across the enum, transition table, and tests.

### 3. `ContactStatus` non-`pending` values (`reached`, `no_answer`, `callback`)

These three values are defined in the enum, declared in the `BookingContactStatus` TS type, included in filter validation schema (`lib/booking/listOperatorBookings.ts`), mapped in `lib/op/statusLabels.ts`, and shown in the operator dashboard dropdown (`DashboardClient.tsx`). However, **no production code path writes any of them** — only the DB default (`pending`) is ever set.

Evidence:
- `lib/booking/bookingRepo.ts:161–167` — raw INSERT omits `contactStatus`, DB default applies
- Grep for `contactStatus.*update` across `app/`, `lib/` (excluding `__tests__`) — zero matches
- The only writes of non-`pending` values are in `operatorBookingQueue.int.test.ts:227,236` (test fixtures)

The UI infrastructure (filter dropdown, label map) is wired but the write path (a "mark as reached/no-answer" action) was apparently never implemented. These values are dead until a contact-tracking feature is shipped. Keeping for now is harmless but the filter dropdown presents options the user can never set — mildly confusing UX.

---

## P3 — Dead Test/Dev Code

### 1. `app/dev/stub-pay/` and `app/dev/stub-storage/`

These routes are gated by `PAYMENTS_STUB` / `STORAGE_STUB` env flags (not `NODE_ENV`), so they exist in the production bundle but 404/error when the flags are off. This is by design — not dead, but worth noting that they rely on runtime env checks rather than build-time tree-shaking.

No action needed; gating is correct per the payment deferral strategy.

---

## Dead Schema Columns

| model.column | spec says | current production usage | action |
|---|---|---|---|
| `Trip.blockedSeats` | S15: "DELETE" (Phase B deferred) | **Active** — read by `lib/trips/reassignBus.ts:73–89` capacity guard; written by trip-create and template generation | Keep; Issue 088 descoped Phase B |
| `Trip.pairedTripId` | S15: "DELETE" (Phase B deferred, paired-return deleted) | **Zombie** — only in DTO round-trip; zero route/service consumers | File cleanup issue; safe to drop with migration |
| `Booking.contactStatus` | S15: listed | **Active** — filter param + manifest display in 4+ operator pages | Keep; write path incomplete but read path live |
| `Booking.pickedUpAt` | S15: listed | **Active** — manifest display in `ManifestRefresh.tsx`, `StaffDashboardClient.tsx` | Keep; Issue 014 UI |
| `Booking.escalationNote` | S15: listed | **Active** — manifest highlight + booking detail in 4 operator pages | Keep; Issue 014 UI |
| `Booking.escalatedAt` | S15: listed | **Active** — manifest highlight + booking detail in 4 operator pages | Keep; Issue 014 UI |

---

## Dead Enum Values

| enum | value | written anywhere? | read anywhere? | action |
|---|---|---|---|---|
| `CharterStatus` | `SUBMITTED` | No — creation goes direct to `ADMIN_REVIEW` | Yes — transition table, `CUSTOMER_CANCELLABLE_STATUSES`, tests | P2: remove after confirming 0 DB rows; requires migration + test cleanup |
| `ContactStatus` | `reached` | No production write (test only) | Yes — filter schema, label map, UI dropdown | P2: dead until contact-tracking write path ships |
| `ContactStatus` | `no_answer` | No production write (test only) | Yes — filter schema, label map, UI dropdown | P2: dead until contact-tracking write path ships |
| `ContactStatus` | `callback` | No production write (test only) | Yes — filter schema, label map, UI dropdown | P2: dead until contact-tracking write path ships |
| `BookingStatus` | `pending_cash_payment` | No — cash flow deleted | No matches anywhere | Confirm removed from schema; grep shows 0 occurrences in any `.ts/.tsx/.prisma` |

Note: `BookingStatus.pending_cash_payment` shows 0 occurrences in the entire codebase including schema — this was already cleaned up (confirmed removed from `prisma/schema.prisma`).

---

## Dead Dependencies

| package | location in package.json | imported in production code? | action |
|---|---|---|---|
| `shadcn` `^4.7.0` | `dependencies` (line 46) | No JS import — CSS only (`@import "shadcn/tailwind.css"` in `globals.css`) | Move to `devDependencies`; it's a CLI scaffolding tool |
| `tw-animate-css` `^1.4.0` | `dependencies` (line 48) | No JS import — CSS only (`@import "tw-animate-css"` in `globals.css`) | Move to `devDependencies`; it's a Tailwind plugin |
| `@sentry/nextjs` | Not in package.json | N/A — not installed | Deferred to go-live (Issue 094); correct per payment deferral strategy |
| `lint-staged` `^17.0.5` | `devDependencies` (line 81) | N/A (CLI tool) | Active — wired to husky pre-commit; keep |
| `knip` | Not in package.json | N/A — not installed | Not configured; prior scan noted no `knip.json`; still absent |

**Note on `shadcn` and `tw-animate-css`:** Both are installed as production `dependencies` but have zero JavaScript module imports. They are used exclusively as CSS stylesheet inputs (`@import` directives in `globals.css`). For CSS-only Tailwind plugins and CLI scaffolding tools, the conventional placement is `devDependencies`. Moving them does not change runtime behavior (Next.js bundles CSS at build time regardless of dep classification) but corrects the semantic classification and reduces production install weight on deployment targets that skip devDeps.

---

## Dead Routes/Pages

| path | linked from UI? | called by client code? | tested? | verdict |
|---|---|---|---|---|
| `app/dev/stub-pay/` | No nav link | Yes — MoMo/ZaloPay stub redirect target | Yes (e2e) | Intentional; gated by `PAYMENTS_STUB` env flag |
| `app/dev/stub-storage/[...key]/` | No nav link | Yes — storage client when `STORAGE_STUB` on | Yes (e2e) | Intentional; gated by `STORAGE_STUB` env flag |
| `app/(customer)/lien-he-dat-xe/` | Yes — SiteHeader + SiteFooter + home hero | Yes | Yes | Live; correctly linked |
| `app/(customer)/routes/` | Yes — search page link | Yes | Yes | Live; correctly linked |
| `app/op/(console)/trip-templates/` | No — intentionally excluded from navConfig | Internal links from Trip detail | Partial | By design per `navConfig.ts` comment |
| `app/admin/(console)/system/` | Yes — admin navConfig line 38 | Yes | Yes | Live; correctly linked |
| `app/api/cron/*` | N/A | Yes — all wired in `vercel.json` | Yes | All cron routes have matching `vercel.json` entries |

No dead routes found. The `trip-templates` page being nav-excluded is intentional and documented in `components/op/navConfig.ts`.

---

## Spec-Mandated Deletions Not Yet Done

From rebuild-plan.md S15 ratification and Issue 088 descope notes:

| item | spec action | current state | blocker |
|---|---|---|---|
| `Trip.blockedSeats` column drop | Phase B migration | Column present; **actively used** by `reassignBus.ts` capacity guard | Load-bearing; descoped from Phase B; no cleanup until feature redesign |
| `Trip.pairedTripId` column drop | Phase B migration | Column present; **zombie field** (DTO only) | Safe to drop; no code consumer; needs cleanup issue filed |
| `CharterStatus.SUBMITTED` removal | Implicit (state unreachable) | Enum value present; never created | Confirm 0 DB rows, then migrate; low risk |
| `ContactStatus` write path | Issue 014 Phase 2 | Read infra exists; write path not implemented | Feature gap, not cleanup gap — ship write path or remove read infra |
| Cash/`pending_cash_payment` cleanup | Phase A | Already done — 0 references found | Complete |

---

## Recommendations

### Priority 1 — Quick wins (< 1 hour total)

1. **Delete 4 dead components:** `KpiTile.tsx`, `DetailLayout.tsx`, `DataTable.tsx`, `FilterBar.tsx` from `components/op/`. No importers anywhere. One-line `rm`, one commit.

2. **Move `shadcn` and `tw-animate-css` to `devDependencies`:** Two-line edit in `package.json`. No runtime impact; corrects misleading dep classification and reduces production install size.

### Priority 2 — Schema cleanup (2–4 hours, requires migration)

3. **Drop `Trip.pairedTripId`:** Paired-return routes deleted in Issue 040. The column is DTO-only dead weight. Migration: `ALTER TABLE "Trip" DROP COLUMN "pairedTripId"`. Also remove from `lib/trips/createTrip.ts` param type, `lib/trips/tripDto.ts` interface, and `lib/trips/toTripDto.ts` mapping. Update 4 test fixtures that assert `pairedTripId: null`.

4. **Remove `CharterStatus.SUBMITTED` from schema enum:** First verify `SELECT count(*) FROM "CharterRequest" WHERE status = 'SUBMITTED'` returns 0. Then: migration to remove the enum value, update `charterStatus.ts` transition table, update `CUSTOMER_CANCELLABLE_STATUSES`, update 8 test assertions. Low risk given explicit design decision documented in `createCharterRequest.ts`.

### Priority 3 — Feature decision needed (not pure cleanup)

5. **`ContactStatus` non-`pending` values:** Either (a) ship the contact-tracking write path (PATCH `/api/op/bookings/[id]/contact-status`) so operators can mark bookings as `reached`/`no_answer`/`callback`, or (b) remove the filter dropdown options and the enum values as dead UI. Currently the dropdown shows options the user can never set — confusing UX. File a decision issue.

### Not recommended

- Do not touch `Trip.blockedSeats`, `Booking.contactStatus`, `Booking.pickedUpAt`, `Booking.escalationNote`, `Booking.escalatedAt` — all are actively read in operator-facing UI and confirmed load-bearing per Issue 088 descope decision.
- Do not remove `app/dev/` routes — correctly gated by env flags per payment deferral strategy.
