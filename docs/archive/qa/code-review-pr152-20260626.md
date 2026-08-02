CODE REVIEW — PR #152 "fix(search): mobile hamburger nav + route visibility gates" @ 07220fed
────────────────────────────────
Diff scope: 3 files, +94 / -19 lines

PRIORITY 1 — Block push, fix first:
  (none)

PRIORITY 2 — Fix before merge:
  (none)

PRIORITY 3 — Address when convenient:
  (none)

NOTES:

1. [CORRECTNESS ✓] getActiveRoutes.ts — New WHERE predicates (`moderatedAt IS NULL`,
   `o.status = 'APPROVED'`, `o."disabledAt" IS NULL`) are parameterized via Prisma.sql
   template tag. No SQL injection risk. Predicates align with searchTrips.ts visibility
   gates (verified: moderatedAt on both Route and Trip, operator status + disabledAt).

2. [CORRECTNESS ✓] SiteHeader.tsx — Dialog.Root wraps <header>, meaning the sticky
   header remains the landmark even when drawer is closed. `md:hidden` on Trigger +
   Backdrop + Popup, `hidden md:flex` on desktop nav — correct responsive split.
   `onClick={() => setDrawerOpen(false)}` on every drawer link ensures navigation
   closes the drawer (same pattern as OperatorNav.tsx:273-280).

3. [SECURITY ✓] No new route handlers. No auth/payment paths touched. SiteHeader is
   a client component rendering static nav links — no trust boundary.

4. [FAILURE MODE ✓] getActiveRoutes uses Prisma.sql template — parameterized,
   no raw string interpolation. JOIN on Operator is INNER JOIN — routes with no
   matching operator (shouldn't exist due to FK) would be excluded, which is correct
   (orphaned routes should not appear).

5. [TEST COVERAGE ✓] No new exported functions or route handlers. The visibility gate
   change is covered by existing integration tests (searchTrips.int.test.ts tests
   moderatedAt filtering). SiteHeader is a presentational component — browser smoke
   verification documented in PR description.

6. [HYGIENE ✓] No console.log, debugger, .only/.skip. No unrelated formatting churn.
   Comments are WHY-oriented (date-stamped context on customer accounts pause,
   operator login scope).

7. [MISTAKE LOG CHECK] Scanned all CLAUDE.md Mistake Log entries:
   - `'use client'` barrel import rule: SiteHeader imports `@base-ui/react/dialog`
     (deep path), not the barrel — SAFE.
   - RSC purity: SiteHeader is `'use client'` — useState is fine here.
   - seed.ts `moderatedAt: new Date()` — uses Date in seed (imperative script),
     not in RSC render body — SAFE.

SUMMARY: 0 P1, 0 P2, 0 P3

RECOMMENDED NEXT STEPS:
  → Clean review. Proceed to /pr-review and CI.
