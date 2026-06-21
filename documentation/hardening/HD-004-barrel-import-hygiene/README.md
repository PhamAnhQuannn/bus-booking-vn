# HD-004: Barrel Import Hygiene

> Status: NOT_STARTED | References: ADR-016, SI-003 §2.5 (A3), SI-004, Mistake Log Issue 092b

## Purpose

Verify that the barrel-import architecture (ADR-016) is fully enforced: cross-domain imports go through barrels, intra-domain uses deep imports, and `'use client'` components never import server-tainted barrels. This is the gate that prevented the Issue 092b incident (88 broken routes across the entire operator portal).

## Skill Invocation

- **Primary**: ESLint `eslint-plugin-boundaries` (`entry-point` rule) + `eslint-plugin-import-x` (`no-cycle` rule)
- **Supplementary**: `/type-safety-audit` -- DTO and type consistency review

## Acceptance Criteria

### Barrel Architecture (ADR-016)

- [ ] Every domain in `lib/` has a barrel `index.ts` exporting its public API
- [ ] Cross-domain imports use barrel paths only (e.g., `@/lib/auth` not `@/lib/auth/internal`)
- [ ] Intra-domain imports use deep paths (not self-barrel imports)
- [ ] `lib/core` and `lib/utils` are exempt from barrel-only rule (infrastructure layer)

### Client Component Safety (ADR-016 D3)

- [ ] Zero `'use client'` files import `@/lib/auth`, `@/lib/booking`, or `@/lib/payment` barrels
- [ ] Client components import only client-safe deep modules (e.g., `@/lib/auth/csrfClient`)
- [ ] data-leak-audit check A3 passes with zero violations
- [ ] Greppable guard G6 passes: `grep -rln "from ['\"]@/lib/auth['\"]" app/ components/ | xargs head -1 | grep "use client"` returns zero

### ESLint Enforcement

- [ ] `eslint-plugin-boundaries` `entry-point` rule at error severity (not warn)
- [ ] `eslint-plugin-import-x` `no-cycle` rule at error severity (not warn)
- [ ] Both rules gated by `pnpm lint` in CI (SI-003 Stage 1)
- [ ] `eslint-plugin-import@2` NOT in use (legacy CJS, no flat-config export -- use `import-x`)

### Test/Dev Boundary Exceptions

- [ ] Test files (`__tests__/**`) and dev routes (`app/dev/**`) are boundary-exempt
- [ ] Internal-only exports (`_resetEnvCache`, `STUB_BLOBS`) kept as deep imports for test/dev use

## Automated Enforcement

This audit is **fully CI-enforced** via:
1. `pnpm lint` (ESLint boundaries + import-x rules)
2. `scripts/audit/data-leak-grep.sh` check A3
3. `scripts/audit/invariants.sh` check G6 — if script not yet implemented, run manual equivalent:
   ```bash
   grep -rln "from ['\"]@/lib/auth['\"]" app/ components/ | xargs head -1 | grep "use client"
   # Must return zero lines. Repeat for @/lib/booking and @/lib/payment barrels.
   ```

## Verdict

**PASS** when `pnpm lint` and data-leak-audit A3 both pass with zero barrel-related violations.

## Cross-References

- ADR-016 -- module boundaries and import architecture
- SI-003 §2.5 -- data-leak-audit check A3
- SI-003 §13.2 -- greppable invariant G6
- SI-004 -- ESLint configuration
- Mistake Log Issue 092b -- barrel sweep that crashed operator portal
