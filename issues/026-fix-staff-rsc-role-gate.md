---
priority: must
source: security-review
fingerprint: sec-staff-rsc-role-bypass
severity: P1
---

## Parent PRD

`issues/prd.md` (fix-issue derived from PR #4 security-review — pre-existing defect)

## What to build

Fix: `/op/staff` (the only admin-only nav item — see `components/op/navConfig.ts`)
server-renders the full staff roster to ANY authenticated operator including
`role: 'staff'`. The API routes correctly gate via `requireOperatorAuth({ adminOnly: true })`
across `app/api/op/staff/route.ts` + `[id]/route.ts` + `[id]/disable/route.ts` +
`[id]/assign-service/route.ts`, but the RSC pre-fetch through
`lib/op/getOperatorStaff.ts` bypasses that gate. The page passes `isAdmin={view.isAdmin}`
to `StaffClient` as a FLAG (for hiding mutation buttons), not as a gate — staff data
has already left the server by then.

Severity: intra-tenant only (staff sees own company's roster), but breaks the
adminOnly contract that the API enforces. Defense-in-depth gap.

Pre-existing (Issue 017 authorship); PR #4 only modified the page's PageHeader.
Surfaced because the review touched the file.

Suggested fix (one line in `lib/op/getOperatorStaff.ts`, mirroring the API's gate):

```ts
const operator = await prisma.operatorUser.findUnique({ ... });
if (!operator || operator.disabledAt !== null) return null;
if (operator.role !== 'admin') return null;   // ← add this
```

Then the page's existing `if (!view) redirect('/op/login')` handles non-admin —
or replace with `redirect('/op/bookings')` for a friendlier landing.

## Acceptance criteria

- [ ] `getOperatorStaff()` returns `null` when `operator.role !== 'admin'`.
- [ ] A `staff`-role user hitting `/op/staff` is redirected (no roster server-rendered).
- [ ] An integration test for `getOperatorStaff` covers both admin and staff roles.
- [ ] /security-review no longer emits fingerprint `sec-staff-rsc-role-bypass`.

## Blocked by

None - can start immediately.
