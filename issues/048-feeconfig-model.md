---
depends-on: [047-ledger-entry-model-immutability]
type: FEATURE
wave: 1
spec: [S13, S08, SYS17]
---

## Parent PRD

`issues/prd.md` · spec `rebuild-plan.md` [S13] / [S08] (Ledger slice b)

## What to build

`FeeConfig` — the effective-dated, audited platform-fee source. Today the fee is hard-coded
`DEFAULT_PLATFORM_FEE_PCT = 0.06` in `calcPayout.ts:10` and baked into a `Payout.platformFee`
column. Spec [S13]: fee rate read from a global + per-operator-override, effective-dated,
change-audited model — NOT a constant, and NOT a feature flag ([SYS17] note).

- `model FeeConfig(id, operatorId?, ratePpm-or-decimal, effectiveFrom, effectiveTo?, createdBy,
  createdAt)`. `operatorId NULL` = global default; non-null = per-operator override. Effective-
  dated rows (new row supersedes; never edit in place — change-audited).
- Read helper `getEffectiveFeeRate(operatorId, atTime)` → resolves override-then-global for
  the effective date. Used at credit time (slice c, issue 049).
- Seed the current global rate (6%) as the first effective row so behavior is unchanged at
  cutover.
- Store rate so BigInt fee math stays exact (per Mistake-Log Issue 016 — encode pct as
  scaled integer, e.g. ppm, not a float).

## Acceptance criteria

- [ ] `FeeConfig` model (global + per-operator override, effective-dated) + migration.
- [ ] Seeded global 6% effective row; `getEffectiveFeeRate` returns 6% for the cutover date.
- [ ] Per-operator override resolves ahead of global for its effective window.
- [ ] Rate encoded for exact BigInt math (no float pct).
- [ ] Changing the rate = a NEW effective row (old retained for audit); no in-place edit.

## Blocked by

- Blocked by `issues/047-ledger-entry-model-immutability.md`

## User stories addressed

- [S13]/[S08] fee from FeeConfig (global + override, effective-dated, change-audited); fee
  is its own ledger entry.
