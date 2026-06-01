# Product-ready gate — Bus Booking VN — 2026-05-28
**Class:** M · **Stage:** pre-launch (21/21 PRD issues DONE) · **Verdict:** READY-WITH-NOTES
**CI:** SKIPPED push (no `.understand/ci-gate.json`) — but real CI already green on `master` (run a3e3057, all 5 jobs success)

## Rubric results
| Category | Check | Result | Severity |
|----------|-------|--------|----------|
| Issues | all 21 PRD issues DONE, no open P0/P1 | PASS | — |
| Build | `next build` (e2e job builds it) | PASS | — |
| Types | `tsc --noEmit` | PASS | — |
| Lint | `eslint` (32 warnings, 0 errors) | PASS | — |
| Tests | unit 665 + integration 155 all pass | PASS | — |
| Coverage | `@vitest/coverage-v8` not installed → unmeasured | NOTE | P3 |
| Security | gitleaks clean (no secrets) · `pnpm audit`: 2 moderate, 0 high/critical | PASS | — |
| Artifacts | rollback-plan / nfr / prod-smoke docs absent | NOTE | P2 |
| Smoke | e2e golden paths (28 specs) green in CI | PASS | — |
| CI | latest `master` run = success | PASS | — |

**Verdict: READY-WITH-NOTES** — zero P0, zero P1. Mechanically shippable; notes below are tracked, not blocking.

## Notes (P2/P3 — non-blocking)
- **P2 — release artifacts missing:** no `docs/ops/rollback-<release>.md`, `docs/nfr.md`, or prod-smoke doc. Run `/rollback-plan` + `/nfr-template` before a real deploy.
- **P3 — no coverage instrumentation:** `@vitest/coverage-v8` not installed; CI `pnpm test` runs without `--coverage`, so the ≥70% bar is unenforced. Add the dep + a coverage gate if you want the metric.
- **P3 — 2 moderate dependency CVEs:** `pnpm audit` (none high/critical). Triage with `/dependency-update`.

## ⚠ Out-of-rubric launch blocker (product completeness, not a code gate)
- **Payments + SMS run on the local STUB** (`PAYMENTS_STUB`, eSMS deferred — per project memory). The mechanical gate passes because the stub satisfies build/test/CI, but **you cannot take real money or send real confirmations until the MoMo/ZaloPay/card adapters + real eSMS land.** This is the chosen "productionize for launch" direction and is the true gate to a public launch.

## Next
- Ship-prep path is open (`/commit-split` on any pending diff). 
- Before public launch: real PSP adapters + eSMS, then `/rollback-plan`, `/nfr-template`, re-run this gate.
