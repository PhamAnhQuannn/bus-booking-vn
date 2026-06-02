---
name: product-ready-gate
description: Pre-launch product-readiness gate. Self-checks a product against a readiness rubric (all issues DONE, build/typecheck/lint clean, tests pass + coverage, no secrets / P0-P1 vulns, required release artifacts present, smoke pass, and real GitHub CI green), then emits one READY / BLOCKED verdict plus a fingerprinted findings table to `docs/qa/product-ready-YYYYMMDD.md`. On BLOCKED it chains `/findings-to-issues` so problems become fix-issues `/autopilot` picks up next cycle. Distinct from `/deploy-health-gate` (post-deploy monitoring) and `/inception-gate-review` (pre-build go/no-go). Use when user says "product ready", "ship readiness", "launch gate", "are we ready to ship", "go/no-go", "/product-ready-gate", or at pre-launch/mature stage when all issues are DONE.
output_size:
  XS: skip
  S:  1h
  M:  2h
  L:  3h
  XL: 4h
---

# /product-ready-gate — pre-launch readiness verdict

Invoke as `/product-ready-gate`. Run every readiness check, fold the results into one verdict, and — when blocked — hand the problems to `/findings-to-issues`.

## Why you'd care

`/verify` proves the last diff is clean. `/smoke-test` proves the golden paths run. `/deploy-health-gate` watches the window *after* you ship. None of them answer the single question that gates a launch: **is this whole product ready to go out?** That answer is an aggregate — every issue closed, the build green, the test suite passing at the coverage bar, no secret in the repo, no critical dependency CVE, the rollback plan written, and the *real* CI run (not just local checks) concluding success. This skill is that aggregate, and it is the one place the loop turns back on itself: a BLOCKED verdict is not a dead end — it becomes fix-issues that `/autopilot` builds, then re-gates, until READY.

This is a **read-only aggregator**. It never edits source. Its only side-effect is writing its report and, *when explicitly authorized*, pushing a dedicated gate branch to read real CI (see § CI authorization).

## Pre-flight

1. Read `docs/classify/<project>.md`.
   - **XS → SKIP** (single-user hobby project; local `/verify` is enough).
   - S / M / L / XL → run, depth scales with class (XL adds the security + artifact rows; S may waive them).
2. Read `docs/nfr.md` if present — surfaces the coverage bar and any latency/error budgets. Defaults below if absent.
3. Confirm the stage is **pre-launch** or **mature** (all issues DONE). If issues remain open, this is premature — say so and recommend finishing the build first.
4. Read `.understand/ci-gate.json` if present — the CI push authorization (see § CI authorization). Absent → CI row runs **local-only** and records `CI: SKIPPED — no push authorization` (a note, not a P0/P1).
5. Detect the stack (package.json / pyproject.toml / go.mod / Cargo.toml …) to resolve the build / typecheck / lint / test commands.

## Inputs

- Class (from classify doc) — gates which rows are mandatory.
- Coverage bar + budgets (from `docs/nfr.md`, defaults below).
- CI authorization (`.understand/ci-gate.json` or `--allow-push` arg).
- Stack command map (build / typecheck / lint / test).

Defaults when `docs/nfr.md` absent:
- Test coverage ≥ 70%.
- Zero typecheck / lint errors.
- Zero P0/P1 security findings (secrets, critical CVE).

## Readiness rubric

The authoritative row-by-row rubric — pass criteria, severity on failure, and source — lives in `refs/readiness-rubric.md`. Read it when running the gate. Summary:

| Category | Check | Fail severity |
|----------|-------|---------------|
| Issues   | all issues DONE, no open P0/P1 issue | P0 |
| Build    | compiles (build cmd exit 0) | P0 |
| Types    | typecheck clean | P1 |
| Lint     | clean (or no new errors) | P2 |
| Tests    | all pass + coverage ≥ bar | pass→P1, coverage→P2 |
| Security | no secrets in repo, no P0/P1 dependency CVE | P0 |
| Artifacts| required release docs present (class-aware) | P2 |
| Smoke    | golden paths pass | P1 |
| CI       | latest real run green (authorized push → `gh run watch`) | P1 |

**Verdict rule: READY only if zero P0 and zero P1 findings.** Any P0/P1 → BLOCKED. P2/P3-only → READY-WITH-NOTES (ship allowed; notes tracked).

## Process

1. **Resolve the rubric** for the current class (drop waived rows).
2. **Run each row** in order; capture every failure as a finding. Do NOT stop at the first failure — the gate's value is the *full* problem list in one pass.
3. **Fingerprint each finding** — `fp = short-hash(category + check + file + normalized-message)`. The fingerprint is stable across runs (strip line numbers, timestamps, run-ids from the message before hashing) so `/findings-to-issues` and the dedup ledger can match the same problem next cycle.
4. **CI row** (see § CI authorization) — local-only or authorized-push.
5. **Compute the verdict** per the rule above.
6. **Write** `docs/qa/product-ready-YYYYMMDD.md`.
7. **Chain:**
   - READY / READY-WITH-NOTES → recommend `/commit-split` (then manual `/ultrareview` — billed, never auto).
   - BLOCKED → fire `/findings-to-issues "docs/qa/product-ready-YYYYMMDD.md"` (not merely suggest).

## CI authorization

Reading *real* CI requires a push, and the autopilot contract is **never push**. This gate owns that push under an explicit, verifiable, revocable authorization. **Without authorization the CI row is local-only — it never pushes.**

Authorization marker — `.understand/ci-gate.json`:
```json
{ "allow_autopilot_push": true, "gate_branch": "autopilot/ci-gate", "remote": "origin" }
```
(or the `--allow-push` arg for a one-off manual run).

When authorized:
1. **Hard refuse** if `gate_branch` resolves to the repo's default branch (`main` / `master` / whatever `git symbolic-ref refs/remotes/<remote>/HEAD` reports). The gate branch must be a dedicated, non-default branch.
2. Push the current HEAD to `<remote> <gate_branch>` — **never** `--force`, **never** the default branch.
3. `gh run watch <run-id>` (or `gh pr checks`) for the real conclusion. `conclusion == success` → PASS; anything else → P1 finding with the failing job/step quoted.
4. **Append** to `docs/qa/ci-gate-pushes.log`: `<UTC timestamp> · <gate_branch> · <sha> · <run-id> · <conclusion>`.

When unauthorized: run the local equivalents (build/typecheck/lint/test already cover most of CI), record `CI: SKIPPED — no push authorization` as a **note** (not a blocking finding), and proceed. A divergence between local and CI is possible — the report says so.

## Output Format

```markdown
# Product-ready gate — <project> — <YYYY-MM-DD>
**Class:** L · **Stage:** pre-launch · **Verdict:** BLOCKED
**CI:** authorized → autopilot/ci-gate (conclusion: failure)  |  or  "SKIPPED — no push authorization"
**Cycle:** gate_fix_cycles = 1 / 3

## Rubric results
| Category | Check                         | Result | Severity |
|----------|-------------------------------|--------|----------|
| Issues   | all DONE, no open P0/P1       | PASS   | —        |
| Build    | npm run build                 | PASS   | —        |
| Types    | tsc --noEmit                  | FAIL   | P1       |
| Lint     | eslint                        | PASS   | —        |
| Tests    | vitest (cov 64% < 70%)        | FAIL   | P2       |
| Security | secrets / npm audit           | PASS   | —        |
| Artifacts| rollback-plan, nfr            | PASS   | —        |
| Smoke    | golden paths                  | PASS   | —        |
| CI       | gh run watch                  | FAIL   | P1       |

## Findings
| id | fingerprint | severity | category | check | file:line | message | suggested-fix |
|----|-------------|----------|----------|-------|-----------|---------|---------------|
| F1 | a3f9c1 | P1 | Types | tsc | src/cart.ts:42 | Type 'string | undefined' not assignable to 'string' | narrow before assign |
| F2 | 7b2e08 | P2 | Tests | coverage | src/checkout.ts | coverage 64% < 70% bar | add tests for error paths |
| F3 | c4d710 | P1 | CI | gh run watch | .github/workflows/ci.yml | job "e2e" failed: timeout | inspect e2e flake |

## Verdict: BLOCKED — 2× P1, 1× P2
Next: /findings-to-issues "docs/qa/product-ready-YYYYMMDD.md"
```

## Verification

- Verdict is exactly one of READY / READY-WITH-NOTES / BLOCKED — no "looks mostly ok".
- Every FAIL row produces exactly one finding with a stable fingerprint.
- READY only when zero P0 and zero P1.
- CI row never pushes without `.understand/ci-gate.json` (or `--allow-push`); when it does push, the branch is non-default and the push is logged to `docs/qa/ci-gate-pushes.log`.
- On BLOCKED, `/findings-to-issues` is **fired** (not just named).
- File written to `docs/qa/product-ready-YYYYMMDD.md`.

## Cross-skill references

- **Upstream:** `/project-status` (issue-DONE state + stage), `/verify` (local checks), `/smoke-test` (golden paths), `/coverage-map` (coverage), `/dependency-update` (CVE scan), `/nfr-template` (coverage bar), `/rollback-plan` + `/prod-smoke` (artifacts the gate looks for).
- **Downstream:** `/findings-to-issues` (BLOCKED → fix-issues), `/commit-split` (READY → ship prep). Manual after READY: `/ultrareview` (billed, never auto-recommended).

## When to re-run

- Every time `/autopilot` re-surveys at pre-launch (the gate is the loop's checkpoint).
- After a batch of fix-issues lands (re-gate to see if BLOCKED → READY).
- Before any manual launch, as the final go/no-go.
