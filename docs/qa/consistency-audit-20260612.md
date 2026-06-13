# Consistency Audit — Refresh

Date: 2026-06-12
Scope: Full codebase (focus on delta since 2026-06-05; PRs 12, 15, 16)
Prior audit: backcompat-review-20260612.md (error code casing already reported — not re-reported here)

---

## Summary

The codebase is structurally consistent in its most safety-critical areas: zero `'use client'` files import domain barrels (the operator-smoke regression pattern is clean), Prisma model accessors are uniformly camelCase, and the test suite uses vi exclusively with no jest.mock residue. The main consistency gaps are: (1) the Zod validation error code split between `'invalid_input'` and `'validation_failed'` within the `/api/op/` route group with no governing rule; (2) fourteen pairs of duplicate type declarations where a service file declares a hand-written interface and `lib/core/validation/` independently declares a Zod-inferred type alias for the same shape; (3) the `/api/trips/search` success envelope returns a raw array while every other list endpoint wraps in an object key; and (4) hardcoded `+07:00` offset strings in seven analytics/ledger files that should centralize through `lib/core/time/`.

---

## P1 — Must Fix (functional inconsistency causing bugs)

**1. `/api/trips/search` returns a raw array; all other list endpoints return `{ <key>: [...] }`**

- `app/api/trips/search/route.ts:82` — `return NextResponse.json(trips, { status: 200, headers })`
- Every other collection endpoint: `{ trips }`, `{ buses }`, `{ routes }`, `{ staff }`, `{ rows }`, etc.

A raw-array response breaks any client that destructures `const { trips } = await res.json()`. The customer-facing `SearchClient` component must be checked to verify it handles the raw array correctly and will not regress if this is ever normalised to `{ trips }`. If the client is already handling the raw array correctly, document the exception explicitly; do not leave it as silent divergence.

**2. `'invalid_input'` vs `'validation_failed'` split within `/api/op/` has no governing rule**

Within the operator portal, Zod parse-failure responses use two different error codes:
- `validation_failed` — used by: `op/trips/route.ts`, `op/trips/[id]/route.ts`, `op/trips/[id]/cancel/route.ts`, `op/trips/[id]/reassign-bus/route.ts`, `op/trips/[id]/pickup-areas/route.ts`, `op/trips/[id]/sales-toggle/route.ts`, `op/bookings/route.ts`, `op/payout-account/route.ts`, `op/money/withdraw/route.ts`, `op/trip-templates/route.ts`, `op/trip-templates/[id]/route.ts`, `op/trips/upcoming/route.ts`, `op/reports/revenue.csv/route.ts`
- `invalid_input` — used by: `op/buses/route.ts`, `op/buses/[id]/route.ts`, `op/buses/[id]/maintenance/route.ts`, `op/routes/route.ts`, `op/routes/[id]/route.ts`, `op/staff/route.ts`, `op/staff/[id]/route.ts`, `op/staff/[id]/assign-service/route.ts`, `op/pickup-areas/route.ts`, `op/pickup-areas/[id]/route.ts`

Both codes are paired with Zod `issues` arrays. The split appears to follow "trips/bookings domain" vs "fleet/catalog domain" historically but is not documented and is invisible to API consumers. Operator-portal clients already drive both; a frontend that normalises on one string breaks silently for the other group.

**Fix:** Pick one code (`validation_failed` — it's the majority, 13 vs 10 files) and rename all `invalid_input` occurrences to `validation_failed` in the ten fleet/catalog routes in a single commit. Update tests in the same commit.

**3. `HoldDetails` interface declared in two files with divergent field sets**

- `lib/booking/getHoldDetails.ts:14` — authoritative server-side definition (has all fields)
- `app/(customer)/booking/review/ReviewClient.tsx:30` — client-side duplicate (may drift)

This was flagged in the prior audit as a known duplicate. It is still present. If `getHoldDetails.ts` adds or changes a field, `ReviewClient.tsx` silently retains the old shape. Fix: export `HoldDetails` from `lib/booking` barrel and import it in `ReviewClient.tsx`; remove the local redeclaration.

**4. `MaintenanceWindow` declared with incompatible field types in two files**

- `lib/catalog/getOperatorBus.ts:11` — `startAt: Date; endAt: Date` (server-side Date objects)
- `lib/api/busesClient.ts:20` — `startAt: string; endAt: string` (ISO string after JSON serialisation)

These are genuinely different runtime types (Date vs string) and should have different names to prevent cross-boundary confusion. Rename the client-side shape to `MaintenanceWindowJson` or `MaintenanceWindowDto` and add a JSDoc comment explaining the serialisation boundary. Leaving them with identical names and structurally different field types is a runtime bug waiting to surface when one type is used in a context expecting the other.

---

## P2 — Should Fix (developer confusion, maintenance burden)

**5. Fourteen duplicate Input type declarations (Zod alias + hand-written interface)**

The following type names are declared twice — once as a Zod-inferred type alias in `lib/core/validation/` and once as a hand-written TypeScript interface in the service file:

| Type name | Zod location | Interface location |
|---|---|---|
| `CreateBusInput` | `lib/core/validation/bus.ts:35` | `lib/catalog/createBus.ts:12` |
| `UpdateBusInput` | `lib/core/validation/bus.ts:55` | `lib/catalog/updateBus.ts:15` |
| `CreateTripInput` | `lib/core/validation/trip.ts:24` | `lib/trips/createTrip.ts:24` |
| `CreateStaffInput` | `lib/core/validation/staff.ts:38` | `lib/staff/createStaff.ts:26` |
| `UpdateStaffInput` | `lib/core/validation/staff.ts:48` | `lib/staff/updateStaff.ts:14` |
| `AssignServiceInput` | `lib/core/validation/staff.ts:58` | `lib/staff/assignService.ts:23` |
| `LoginInput` | `lib/core/validation/auth.ts:51` | `lib/auth/authService.ts:27` |
| `RegisterInput` | `lib/core/validation/auth.ts:50` | `lib/auth/authService.ts:21` |
| `OperatorLoginInput` | `lib/core/validation/auth.ts:52` | `lib/auth/operatorAuthService.ts:17` |
| `OperatorProfile` | `lib/auth/types.ts:67` (Zod) | `lib/op/getOperatorProfile.ts:15` |
| `HoldResult` | `lib/core/db/holdRepo.ts:54` | `lib/api/holdsClient.ts:38` (union) |

Pattern: service files declare their own interface matching the shape of the Zod schema, so tsc does not enforce that the two agree. If the Zod schema adds a field, the hand-written interface is not automatically updated — tsc may still compile if the new field has a compatible type alias. Fix: in each service file, replace the hand-written interface with `type X = z.infer<typeof xSchema>` imported from the validation module.

**6. `get*` vs `list*` naming split in `lib/admin/` is inconsistently applied**

- `listAdmins`, `listOperators`, `listAllOperators` — use `list` prefix
- `getApprovalQueue`, `getActionQueue`, `getPayoutQueue`, `getCharterDispatchQueue` — use `get` for functions that return collections (queues = lists)
- `getAuditLog`, `getLedgerView`, `getModerationQueue` — same `get` prefix for collections

Convention in `lib/trips/` and `lib/catalog/` is clearer: `list*` for arrays, `get*` for single-entity or composite queries. The `lib/admin/` queue functions (`getApprovalQueue`, `getActionQueue`, etc.) all return arrays but use `get`. This is a cosmetic deviation but confuses new contributors. Rename to `listApprovalQueue` → `listApprovalOperators`, `listActionQueue`, `listPayoutQueue`, `listCharterDispatchQueue` (or keep `get` consistently for all admin read functions — just document the rule).

**7. `/api/op/reports/revenue` and `/api/op/reports/payouts` use `{ rows }` key; peer endpoints use entity-name keys**

- `app/api/op/reports/revenue/route.ts:60` — `{ rows }`
- `app/api/op/reports/payouts/route.ts:19` — `{ rows }`
- All other operator list endpoints: `{ trips }`, `{ buses }`, `{ routes }`, `{ staff }`

`rows` is a generic SQL term, not domain-specific. Clients consuming these endpoints must know that `rows` means revenue rows vs payout rows by context. Rename to `{ revenueRows }` / `{ payoutRows }` for clarity, or align with the entity-name convention (`{ revenue }` / `{ payouts }`).

**8. Validation error HTTP status split: `invalid_input` uses 400, `validation_failed` uses 422**

- `op/buses/route.ts:39` — `invalid_input` → status **400**
- `op/staff/route.ts:37` — `invalid_input` → status **400**
- `op/staff/[id]/route.ts:33` — `invalid_input` → status **400**
- `op/routes/route.ts:38` — `invalid_input` → status **422**
- `op/trips/route.ts:50` — `validation_failed` → status **422**
- `op/bookings/route.ts:24` — `validation_failed` → status **422**

The `invalid_input` group mixes 400 and 422 within itself (buses and staff use 400; routes use 422). Once the error code is normalised to `validation_failed` (P1.2), the HTTP status should also be normalised to 422 (the majority, and semantically more correct for schema validation failures that aren't malformed JSON).

**9. `lib/trips/generateFromTemplate.ts` exports `createTemplate`, `getTemplate`, `listTemplates` from a single file named `generateFromTemplate`**

The file name describes one function (`generateFromTemplate`) but it has become a module for the entire template domain. The three exports are not related to the filename. This is a maintenance burden: contributors looking for `createTemplate` will search for `createTemplate.ts` and find nothing. Refactor into `lib/trips/templates/` directory with separate files, or at minimum rename to `lib/trips/templateRepo.ts`.

---

## P3 — Cosmetic / Advisory

**10. `+07:00` hardcoded offset in seven analytics/ledger files instead of deriving from `lib/core/time/`**

`lib/core/time/index.ts:4` defines `TZ = 'Asia/Ho_Chi_Minh'` as the project timezone constant. Seven files bypass this and hardcode `+07:00` directly in template literals:

- `lib/reports/getOperatorKpis.ts:58-59`
- `lib/reports/getBusPerformance.ts:47-48`
- `lib/analytics/getAdminMetrics.ts:20,62-63`
- `lib/analytics/getFunnel.ts:37-38`
- `lib/ledger/getRevenueReport.ts:39-40`
- `lib/ledger/getBookingRevenueRows.ts:51-52`
- `lib/booking/listOperatorBookings.ts:75-76`

Vietnam does not observe DST so `+07:00` is safe for now, but the AGENTS.md Mistake Log (Issue 014) already documented a timezone-awareness bug in `listOperatorBookings.ts`. Centralising via `lib/core/time/` makes future DST or region changes a single-file edit. Advisory only since Vietnam DST is not a near-term risk.

**11. `app/api/admin/admins/route.ts:49` wraps success body without a key**

`return NextResponse.json({ adminUserId: result.adminUserId, tempPassword: result.tempPassword }, { status: 201 })` — this is fine (201 with the new resource fields), but `create-account/route.ts:42-45` returns the same shape as `{ username, tempPassword }`. The peer admin-invite route uses `adminUserId` as the resource identifier while the operator-account-creation route uses `username`. These are different resources so different keys are correct, but a comment at each site explaining the difference would help auditors.

**12. `formatDate` helper is copy-pasted into at least two admin RSC pages**

- `app/admin/(console)/operators/[id]/page.tsx:35-37` — `function formatDate(d: Date | null): string`
- `app/admin/(console)/approvals/page.tsx:36-38` — `function formatDate(d: Date): string`

Same logic, slightly different signatures (nullable vs non-nullable). Extract to `lib/utils/formatDate.ts` or `components/admin/formatDate.ts`.

---

## Error Response Shape Audit

| Route group | Success envelope | Validation error shape | Auth error shape | Business logic errors | HTTP codes used |
|---|---|---|---|---|---|
| `GET /api/trips/search` | **Raw array** (no wrapper key) | `{ errors: Record<string,string> }` 400 | — | — | 200, 400, 429 |
| `POST /api/holds` | `{ holdId, expiresAt }` | `{ error: 'INVALID' }` 400 | — | `{ error: 'SOLD_OUT' }` 409, `{ error: 'HOLD_CAP_EXCEEDED' }` 429 | 201, 400, 409, 429 |
| `GET /api/holds/[id]` | Raw `details` object | — | `{ error: 'UNAUTHORIZED' }` 401 | `{ error: 'NOT_FOUND' }` 404 | 200, 401, 404 |
| `POST /api/bookings/initiate` | `{ bookingId, payUrl }` | `{ error: 'INVALID' }` 400 | `{ error: 'FORBIDDEN' }` 403 | SCREAMING_SNAKE codes → 404/409/503/502 | 200, 400, 403, 404, 409, 429, 502, 503 |
| `GET /api/bookings/[id]` | `{ booking }` | — | — | `{ error: 'not_found' }` 404 | 200, 404 |
| `/api/auth/*` | Varies (see below) | `{ error: 'INVALID' }` 400 | `{ error: 'UNAUTHORIZED'/'INVALID_CREDENTIALS' }` 401 | lowercase_snake codes → 400/401/409 | 200, 400, 401, 409, 410, 429 |
| `/api/op/trips` (list) | `{ trips }` | `{ error: 'validation_failed', issues }` 422 | — | — | 200, 422 |
| `/api/op/trips` (create) | `{ trip }` 201 | `{ error: 'validation_failed', issues }` 422 | — | snake_case codes → 404/409/422 | 201, 404, 409, 422 |
| `/api/op/buses` | `{ buses }` / `{ bus }` 201 | `{ error: 'invalid_input', issues }` **400** | — | snake_case codes → 404/422 | 200, 201, 400, 404, 422 |
| `/api/op/routes` | `{ routes }` / `{ route }` 201 | `{ error: 'invalid_input', issues }` 422 | — | snake_case codes → 404/422 | 200, 201, 404, 422 |
| `/api/op/staff` | `{ staff }` / `{ staff }` 201 | `{ error: 'invalid_input', issues }` **400** | — | snake_case codes → 404/409 | 200, 201, 400, 404, 409 |
| `/api/op/reports/revenue` | `{ rows }` | `{ error: 'validation_failed', issues }` 422 | — | — | 200, 422 |
| `/api/op/reports/payouts` | `{ rows }` | — | — | — | 200 |
| `/api/admin/*` (actions) | `{ ok: true }` | `{ error: 'INVALID' }` 400 | SCREAMING_SNAKE 401/403 | SCREAMING_SNAKE 404/409/422 | 200, 400, 401, 403, 404, 409, 422 |
| `/api/admin/admins` (create) | `{ adminUserId, tempPassword }` 201 | `{ error: 'INVALID' }` 400 | — | SCREAMING_SNAKE 409/403 | 201, 400, 403, 409 |

**Auth route success shapes (not standardised):**
- `POST /api/auth/otp/verify` → `{ otpProof }`
- `POST /api/auth/register` → `{ accessToken, customer }`
- `POST /api/auth/login` → sets cookie, body varies
- `POST /api/admin/auth/login` → `{ role, totpDisabled }`
- `POST /api/admin/auth/totp/verify` → `{ role }`
- `POST /api/admin/auth/refresh` → `{ role }`

Auth endpoints do not follow a uniform success envelope — each returns whatever the consumer needs at that step. This is intentional (different consumers need different fields) but should be documented in the auth API contract.

**Key finding:** The `/api/trips/search` raw-array response is the sole structural outlier. All other endpoints use either `{ <entity> }` (single), `{ <entities> }` (list), or `{ ok: true }` (command). No endpoint uses a `{ data }` generic wrapper.

---

## Date/Time Handling

| Pattern | Files | Timezone | Consistent? |
|---|---|---|---|
| `new Date()` | ~130 lib/ + 16 app/ files | UTC (wall-clock) | Yes — used for "current time" comparisons |
| `Date.now()` | ~154 lib/ + 11 app/ files | UTC (ms epoch) | Yes — used for token TTL math |
| `date-fns` | 6 files (seed, e2e, searchTrips, generateFromTemplate, UI pickers) | UTC | Yes — date arithmetic |
| `date-fns-tz` | 6 files (same as date-fns) | Asia/Ho_Chi_Minh | Yes — timezone conversion at search boundary |
| `Intl.DateTimeFormat` | 30+ files | Asia/Ho_Chi_Minh | Yes — display formatting |
| `+07:00` hardcoded offset | 7 files (analytics, ledger, listOperatorBookings) | Asia/Ho_Chi_Minh | **No** — bypasses `lib/core/time/` constant |
| `${date}T00:00:00+07:00` | 7 files | Asia/Ho_Chi_Minh | Functional but fragile |
| `toISOString().slice(0,10)` | 60+ files | UTC | **Conditional** — safe only when UTC date == local date |

**Specific risk:** The Mistake Log (Issue 014) documents a `toISOString().slice(0, 10)` timezone collision bug. The pattern remains prevalent in 60+ locations. Most are in tests or display contexts where UTC vs local date doesn't matter; the risky sites are those where a date string derived from `toISOString()` is compared against a VN-local business-date filter. Grep smell: `.toISOString().slice(0, 10)` within 5 lines of a `serviceDate` or `date` query parameter.

---

## Naming Convention Audit

| Area | Convention | Deviations |
|---|---|---|
| Prisma model accessors | camelCase (`prisma.operatorUser`, `prisma.adminUser`) | None found |
| API response fields | camelCase (`tripId`, `routeOrigin`, `contactPhone`) | None — no snake_case in responses |
| Route handler error codes — admin portal | `SCREAMING_SNAKE_CASE` | None within admin |
| Route handler error codes — customer auth | `lowercase_snake` | `consent_required` in `initiate` surrounded by SCREAMING (P1 in backcompat review) |
| Route handler error codes — operator portal | `snake_case` (validated) | None within op |
| Function naming — `lib/trips/` | `get*` single, `list*` array, `create*`, `cancel*` | `generateFromTemplate` bundles `create/get/list` — see P2.9 |
| Function naming — `lib/catalog/` | `get*`, `list*`, `create*`, `update*`, `find*` | `findMaintenanceOverlaps`, `findTripOverlaps` use `find` prefix — only two, consistent with each other |
| Function naming — `lib/admin/` | `get*` for everything (single + array) | `listAdmins`, `listOperators`, `listAllOperators` use `list`; queue readers use `get` — **mixed** |
| DTO field types | camelCase, all non-null scalar fields present | None found (Issue 013 TripDto.price fix verified) |
| Test assertion style | `.toBe()` dominant (1217 vs 262 `.toEqual()`) | No `.toStrictEqual()` — acceptable |
| Test mock strategy | `mockResolvedValue` for async (546 uses) | `mockReturnValue` used for sync (42 uses) — correct split |

---

## Import Pattern Audit

Post-092b barrel sweep status:

**Client component barrel safety — CLEAN.** Zero `'use client'` files in `app/` or `components/` import from the `@/lib/auth` domain barrel. All client components use `@/lib/auth/csrfClient` (the established safe deep path). Verified across admin console (`app/admin/(console)/**/*Actions.tsx`), operator console (`app/op/(console)/**/*Client.tsx`), and customer-facing components.

**PR16 new files — CLEAN.** `app/admin/(console)/operators/[id]/CreateAccountAction.tsx:20` correctly uses `@/lib/auth/csrfClient`. Comment in the file explicitly references the operator-smoke Mistake Log. `OperatorActions.tsx:23` also uses the deep import.

**PR15 new pages — CLEAN.** `app/admin/(console)/approvals/page.tsx` is an RSC (no `'use client'`); imports `@/lib/auth` barrel correctly (server-only boundary, no client risk).

**Cross-domain reach-in in lib/ — CLEAN.** No files in `lib/auth/` import from `lib/booking/` internal paths; no files in `lib/catalog/` import from `lib/trips/` internal paths.

**Remaining advisory:** `lib/api/busesClient.ts` declares its own `MaintenanceWindow` type (string dates) rather than importing from a shared type. This is the root of the duplicate-type issue in P1.4.

---

## Component Pattern Audit

| Pattern area | Dominant implementation | Deviations |
|---|---|---|
| Dialog/Modal | `@base-ui/react` Dialog primitive + custom wrapper | None found — consistent |
| Form submit | Native `<form onSubmit={}>` with `useState` for loading | None found — consistent |
| Loading states | `Skeleton` from `@/components/ui/skeleton` | Some use `aria-busy` on containers, some do not — cosmetic only |
| Page layout | `<div className="mx-auto max-w-*xl space-y-6">` | Consistent across all three portal layouts |
| Error display | `<Alert variant="warning/danger">` | Consistent |
| Date formatting | `Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })` | Consistent |
| VND formatting | `new Intl.NumberFormat('vi-VN')` | Consistent |
| `formatDate` helper | Local inline function in each RSC page | Duplicated in at least `operators/[id]/page.tsx` and `approvals/page.tsx` — see P3.12 |

---

## Prior Findings Status

| Prior finding (backcompat-review-20260612.md) | Status |
|---|---|
| `bus_overlap_with_outbound` returns 409 vs 422 on different routes | Still open — SPEC CONFLICT comment in place, no fix yet |
| `consent_required` lowercase in SCREAMING_SNAKE route | Still open |
| OTP verify error codes bare lowercase | Still open |
| Auth route uses `customer_login_disabled` → HTTP 410 (undocumented) | Still open |
| No API versioning scheme | Still open — pre-launch decision needed |
| `X-Next-Cursor` pagination header on trips/search | Still open |

| Prior finding (operator-smoke Mistake Log) | Status |
|---|---|
| Client components importing `@/lib/auth` barrel | **FIXED** — zero violations found |

| PR-specific findings (PR16 — Issue 113) | Status |
|---|---|
| `tempPasswordPlain` exposed in `getOperatorDetail` response | Present by design (admin-only, in-process, not API). Memory note says this blocks 094 go-live — tracked separately |
| `loginTempPassword` passed as prop to `CreateAccountAction` client island | Correct — RSC reads from server, island receives prop. No barrel import issue. |

---

## Recommendations

1. **P1.2 (highest priority):** Normalise `invalid_input` → `validation_failed` in 10 operator fleet/catalog routes, and align HTTP status to 422. Single commit, update tests. Unblocks frontend clients from needing two error code branches.

2. **P1.1 (raw array):** Decide whether `/api/trips/search` stays raw-array (document it as the explicit exception, add a JSDoc comment in the route) or normalise to `{ trips }`. The customer `SearchPage` component must be checked before changing.

3. **P1.3 + P1.4 (duplicate types):** Export `HoldDetails` from the `lib/booking` barrel. Rename client-side `MaintenanceWindow` to `MaintenanceWindowJson`. Both are single-file edits.

4. **P2.5 (Zod duplicates):** Replace hand-written Input interfaces with `z.infer<typeof schema>` in 11 service files. Low risk (tsc enforces the rename at build time). Can be done domain by domain.

5. **P2.7 (rows key):** Rename `{ rows }` to `{ revenueRows }` / `{ payoutRows }` in the two report endpoints. Check `RevenueClient.tsx` and `PayoutsClient.tsx` call sites.

6. **P3.12 (formatDate duplication):** Extract to `lib/utils/formatDate.ts`. Three-line change.

7. **P3.10 (hardcoded +07:00):** Low urgency (Vietnam has no DST), but route `listOperatorBookings.ts` already had one timezone bug — making it derive from `lib/core/time/TZ` would have made the Mistake Log fix more obvious.
