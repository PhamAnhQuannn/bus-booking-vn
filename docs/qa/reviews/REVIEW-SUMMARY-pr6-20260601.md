# PR #6 — Consolidated Review Summary (4 skills)

**PR:** feat/ota-redesign → master · @ 02e6eab5 · 258 files, +15538/-854 · mergeable: CONFLICTING
**Reviewed:** 2026-06-01 via /pr-review, /code-review, /architect-review, /security-review-deep

## Verdict
**No P1 on any money path.** All 5 correctness fixes (oversell, double-book, overpay, payout T+1,
guest-attach) are correct and unit/int-tested. Guest-attach + underpay-guard are net security-POSITIVE.
The real blockers are **merge-readiness** (CI never ran on HEAD; 8-file conflict with master), not code.

## Ranked findings (deduped across the 4 reports)

| # | Sev | Source | Finding | Action |
|---|-----|--------|---------|--------|
| 1 | P1 | pr-review | MERGE READINESS — HEAD has 0 CI checks + PR is CONFLICTING (8 op files) | **Phase B**: resolve conflicts, push, get CI green |
| 2 | P1 | pr-review | SCOPE — ≥4 unrelated intents (UI redesign + money fixes + docs + tooling) bundled | Advisory split; user opted to keep bundled |
| 3 | P1 | pr-review | SIZE — 258 files / ~8030 net code lines, unbisectable | Advisory split; mitigated by money-path being verified-clean |
| 4 | P2 | code-review | Overpay delta is log-only, not a queryable column (refund-out rail 051 needs it) | Accept-with-note: reconstructable from PaymentEvent − Booking |
| 5 | P2 | code-review | searchTrips may double-subtract a hold+booking for same seat (SAFE direction) | Verify hold released on booking; add int-test |
| 6 | P2 | architect | op-console built twice (master #4 ∥ branch) → 8-file conflict; dashboard+reports near-rewrites | **Phase B**: 3-way merge, prefer branch side (see drift) |
| 7 | P2 | architect | recharts ^3.8.1 added, no docs/adr/ exists | /adr-writer, follow-up |
| 8 | P2 | pr-review | New op/activity endpoint, no API-contract doc | /api-contract, follow-up |
| 9 | P3 | security | Operator trip mutations have no actor-audit trail | /audit-log-design, follow-up issue |
| 10 | P3 | code/pr | .env.example still lists removed SEARCH_USE_BLOCKED_SEATS | drop 2 lines |
| 11 | P3 | code-review | /lien-he-dat-xe contact form submits nowhere (TODO) | wire endpoint or "coming soon" |

## Drift (architect, positive)
Branch RESOLVED 2 violations from the PR #4 op-console baseline: dashboard UI→DB bypass (was P1) and
statusLabels lib→UI reversal (was P2). → **When resolving conflicts, prefer the branch side**; it is
architecturally cleaner. Graft in any master-#4 features the branch lacks; do NOT take master's
dashboard wholesale (would reintroduce the bypass).

## Phase B plan
1. Resolve 8 conflicts (prefer branch; verify no master #4 feature dropped — esp. dashboard +
   reports/overview). 2. Local gate: lint + tsc + test. 3. Push → fresh CI on new HEAD. 4. Watch green.

Reports: pr-review-pr6 · code-review-pr6 · architect-review-pr6 · security-deep-pr6 (all 20260601).
