---
depends-on: [092-domain-barrels-boundary-lint]
type: CHORE
wave: 8
spec: [SYS20]
---

## Parent PRD

`issues/prd.md` · spec `rebuild-plan.md` [SYS20] (final sweep — split out of 092)

## Why this exists (split from 092)

Issue 092 delivered the structural foundation: all 5 rule-4 inversions fixed (domain
repos moved out of `lib/core`), full barrel coverage (31 `lib/<domain>/index.ts`), and
rules 2 + 4 flipped to **error** (green). The remaining AC items turned out to be
issue-sized — a ~600-site import sweep plus two new lint plugins under a hard error
gate — so they were carved here to avoid bulldozing a huge delicate migration onto the
tail of 092. See 092's `> SPLIT` note.

## What to build

1. **Reach-in → barrel conversion (rule 1 / rule 3).** Convert cross-domain deep imports
   `@/lib/<domain>/<internal>` to the barrel `@/lib/<domain>` everywhere they cross a
   domain boundary. Surface measured at split time: **~500 in `app/` + `components/`**,
   **~137 in `lib/`** (latter includes intra-domain false positives that stay deep).
   - Intra-domain deep imports (a file importing its OWN domain's internals) are allowed
     and MUST stay deep — only cross-domain reach-ins convert.
   - Every converted symbol must already be in the target barrel (barrels were authored
     from exactly this cross-domain surface in 092 — verify coverage; add any missing).
   - Merge multiple deep imports from one domain in a file into the single barrel import.

2. **Rule-3 enforcement at error.** Add `eslint-plugin-boundaries` (it knows element
   membership, so it can ban cross-domain reach-ins while allowing intra-domain deep
   imports — plain `no-restricted-imports` cannot express that). Configure element types
   (`app`, `lib-domain`, `lib-core`) and forbid `lib-domain → other lib-domain/<internal>`.
   Get the tree green at error.

3. **No-cycle enforcement (rule: no dependency cycles).** Add `eslint-plugin-import` +
   `eslint-import-resolver-typescript` (for the `@/` path alias under flat config /
   ESLint 9). Enable `import/no-cycle` at error on `lib/**`. Fix any cycle the barrels or
   moves introduced. (Sanity check at split: no obvious new cycle — `trips → onboarding`
   has no `onboarding → trips` back-edge.)

4. **Rule-5 tenant-scope wiring.** `withOperatorScope` (`lib/core/db/tenantScope.ts`) is
   currently used by **zero** operator-owned repo queries — they hand-scope with manual
   `where: { operatorId }`. Wire `withOperatorScope` (or document why a given query is
   exempt) into every operator-owned repo query across `catalog`, `trips`, `op`,
   `booking`, `ledger`, `staff`, onboarding payout, etc. Confirm no operator query reads
   another operator's rows.

## Acceptance criteria

- [ ] No cross-domain reach-ins remain: `rg "from '@/lib/[a-z]+/[a-z]" app components` returns only the exempt core/util paths.
- [ ] `eslint-plugin-boundaries` rule-3 at error, tree green, runs in CI.
- [ ] `import/no-cycle` at error, zero cycles, runs in CI.
- [ ] Every operator-owned repo query uses `withOperatorScope` (or has an inline `// tenant-exempt:` rationale).
- [ ] `pnpm tsc --noEmit` 0, `pnpm eslint .` 0 errors, unit suite ≥ pre-existing baseline.

## Notes / landmines

- The conversion is mechanical-IF every symbol is in its barrel; a path-only rewrite that
  leaves a symbol un-barrelled fails tsc — convert in batches with tsc-green checkpoints.
- ESLint 9 flat config + `@/` alias is the resolver gotcha for both new plugins; configure
  `eslint-import-resolver-typescript` against `tsconfig.json` paths.
- `lib/utils` (dir barrel) vs `lib/utils.ts` (loose file): `@/lib/utils` resolves to the
  loose file. Don't accidentally route barrel imports to the wrong target.

## Blocked by

- Blocked by `issues/092-domain-barrels-boundary-lint.md` (done: rule-4 + barrels + rules 2/4 error).
