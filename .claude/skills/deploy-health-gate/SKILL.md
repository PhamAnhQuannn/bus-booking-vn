---
name: deploy-health-gate
description: Watch error rate, p95 latency, and 5xx count for N minutes after a prod deploy and decide hold / pass / rollback against SLO budgets. Polls Sentry / Datadog / Vercel Analytics / homegrown observability and writes `docs/qa/deploy-health-YYYYMMDD-HHMM.md`. Distinct from `/prod-smoke` (one-shot canary at T+0) — this watches the rolling window. Use when user says "deploy gate", "post-deploy monitor", "health check after deploy", "watch deploy", "rollback if bad", "/deploy-health-gate", or after any L/XL prod deploy.
output_size:
  XS: skip
  S:  skip
  M:  30m
  L:  1h
  XL: 2h
---

# /deploy-health-gate — post-deploy rolling health window

Invoke as `/deploy-health-gate`. Sample observability for N minutes, compare to SLO, decide hold / pass / rollback.

## Why you'd care

`/prod-smoke` proves T+0 is healthy. A regression that triggers only at p99 traffic, or only after the cache warms, or only when the cron fires at HH:00 — those don't show up in the smoke pass. The health gate is the rolling watch that catches them in the next N minutes, while the deploy is still cheap to roll back.

Three failure shapes this catches:

- **Slow regression** — error rate climbs from 0.2% → 1.5% over 8 minutes as a memoization bug evicts cache; smoke at T+0 saw 0.2% and passed.
- **Latency cliff** — p95 was 600ms at smoke; once real concurrent load arrives, p95 walks to 2.4s. Budget is 1s.
- **Cron-triggered fault** — the new build's nightly cron crashes at HH:05; the gate window must cover at least one expected cron fire.

The gate is *the decision point*: at minute N, if SLO budget is intact, ship is locked in; if not, the gate fires `/rollback-plan`.

## Pre-flight

1. Read `docs/classify/<project>.md`.
   - XS / S → SKIP (single-user hobby projects ride on `/prod-smoke` alone).
   - M → 15 min window.
   - L → 30 min window.
   - XL → 60 min window (or until first scheduled cron + 5 min, whichever larger).
2. Read `docs/nfr.md` — surfaces the error-rate / latency / 5xx budgets (default below if absent).
3. Read `docs/ops/rollback-plan.md` if present — the gate fires this on breach; the runbook must exist before the gate opens.
4. Confirm `/prod-smoke` ran in the last 5 min and PASSED. If smoke failed, do not open a gate window — go straight to `/rollback-plan`.
5. Confirm observability endpoint is reachable (Sentry API key, Datadog token, Vercel Analytics scope, or the project's own `/metrics`).

## Inputs

- Prod base URL + observability source (Sentry / Datadog / Vercel / custom `/metrics`).
- Build SHA + deploy id (must match the SHA `/prod-smoke` validated).
- Window length (auto from class, override allowed).
- SLO budgets (auto from `docs/nfr.md`, defaults below).
- Cron schedule (optional; if present, window must cover at least one fire).

Default SLO if `docs/nfr.md` absent:
- Error rate ≤ 1.0% over rolling 5-min window.
- p95 latency ≤ 1.0s (HTML) / 500ms (API).
- 5xx count ≤ 5 per minute.

## Process

1. **Open window.** Record `gate_open` timestamp and the deploy id under test.
2. **Sample every 60s.** For each tick, fetch: error rate (5xx + uncaught exceptions / total requests), p95 / p99 latency per route group, 5xx count, top-5 exception types.
3. **Compare to budget.** Per tick, mark PASS / SOFT-BREACH (one tick over) / HARD-BREACH (≥3 consecutive ticks over).
4. **Cron coverage check.** If the deploy includes a cron change, the window must include the cron fire timestamp + 5 min margin. Extend if needed.
5. **Decision at gate-close:**
   - All ticks PASS → **HOLD CLOSED → PASS**. Log and exit.
   - Any HARD-BREACH → **ROLLBACK**. Fire `/rollback-plan`.
   - Only SOFT-BREACH ticks → **EXTEND** window by 50%; if still soft at extended close → **PASS WITH NOTE** (incident-runbook ref for follow-up).
6. **Diff vs baseline.** Compare error rate / p95 to the 24h pre-deploy baseline. >2× increase on any tracked route → HARD-BREACH even if absolute budget intact.
7. **Write** `docs/qa/deploy-health-YYYYMMDD-HHMM.md`.

## Output Format

```markdown
# Deploy health gate — <project> — <YYYY-MM-DD HH:MM TZ>
**Build SHA:** <git-sha> · **Deploy id:** <vercel-deploy-id>
**Window:** <HH:MM → HH:MM> (<N> min) · **Class:** L · **Source:** Sentry + Vercel Analytics
**Smoke ref:** docs/qa/prod-smoke-YYYYMMDD.md (PASS)

## SLO budgets
- Error rate ≤ 1.0% over rolling 5-min window
- p95 latency: HTML ≤ 1.0s · API ≤ 500ms
- 5xx ≤ 5 / min

## Ticks
| T+   | Err %  | p95 HTML | p95 API | 5xx/min | Top exception          | Verdict       |
|------|-------:|---------:|--------:|--------:|------------------------|---------------|
| 1m   | 0.18%  | 480ms    | 220ms   | 0       | —                      | PASS          |
| 2m   | 0.22%  | 510ms    | 240ms   | 1       | TimeoutError (db)      | PASS          |
| …    | …      | …        | …       | …       | …                      | …             |
| 14m  | 0.31%  | 620ms    | 280ms   | 2       | TimeoutError (db)      | PASS          |
| 15m  | 0.28%  | 590ms    | 260ms   | 1       | TimeoutError (db)      | PASS          |

## Baseline diff (vs 24h pre-deploy)
- Error rate 0.20% → 0.25% (+25%, within margin)
- p95 HTML 460ms → 555ms (+21%, within margin)
- p95 API 210ms → 250ms (+19%, within margin)

## Cron coverage
- nightly-billing-aggregate fired at T+12m → exit 0 → covered.

## Decision: PASS
Window held within budget for full 15 min. Deploy is locked in. No rollback action required.

## If we had failed
- Hard-breach (≥3 consecutive ticks over budget) → fire `docs/ops/rollback-plan.md` step 1.
- Top-exception spike → page on-call (`docs/ops/incident-runbook.md`).
```

## Verification

- Window length matches class (M=15 / L=30 / XL=60 min) or has an explicit override note.
- Every minute in the window has a tick row — no gaps.
- Decision is exactly one of PASS / PASS-WITH-NOTE / EXTEND / ROLLBACK — no ambiguous "we'll watch it".
- Baseline diff is present (catches regressions inside budget).
- File written to `docs/qa/deploy-health-YYYYMMDD-HHMM.md`.
- If verdict = ROLLBACK, `/rollback-plan` is fired (not merely suggested).

## Cross-skill references

- **Upstream:** `/prod-smoke` (T+0 canary; must PASS before gate opens), `/nfr-template` (SLO budgets), `/observability-design` (the data source), `/blue-green-deploy` + `/canary-deploy` (deploy mechanics).
- **Downstream:** `/rollback-plan` (fired on HARD-BREACH), `/incident-runbook` (page on-call on exception spike), `/release-notes` (gate PASS → release is locked in), `/post-mortem` (if gate fired rollback).

## When to re-run

- Immediately after every prod deploy (L / XL ship-block).
- After every config change that hits prod without a new build (e.g. env-var flip on an existing deploy).
- After any feature-flag rollout step (each ramp = new effective deploy).
- Synthetically — at start of every sensitive traffic window (Black Friday morning, regulatory deadline, marketing campaign launch).
