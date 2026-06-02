PR REVIEW — PR #6 "feat: OTA redesign + payment/booking correctness fixes + rebuild backlog" @ 02e6eab5
─────────────────────────────
Diff scope: 258 files, +15538 / -854, 31 commits
PR exists: yes
State: open (not draft), reviewDecision: none, mergeable: CONFLICTING
Base: master ← feat/ota-redesign
Reviewed: 2026-06-01 (PR mode)

PRIORITY 1 — Block push, fix first:

  [SCOPE] ≥4 unrelated intents bundled in one PR.
    Detected threads: (a) OTA UI redesign — feat(home/op/account/auth/ui/search),
      (b) money-path correctness fixes — fix(payment overpay), fix(payout T+1),
      fix(search oversell), fix(trips double-book), fix(booking guest-attach),
      (c) docs/backlog drop — docs(issues 030-101), docs(rebuild-plan/order/mismatches),
      (d) tooling — chore(claude skills + skills-lock), chore(config), chore(gitignore).
    Risk: the 5 money-path fixes (each a P1-class correctness change) cannot be reverted
      independently of an 8000-line UI redesign. If overpay/payout logic regresses in prod,
      rollback drags the entire redesign with it. Bisection across 31 commits is impractical.
    Fix: carve into ≥3 PRs — (1) money-path fixes (small, high-scrutiny, ship first),
      (2) OTA UI redesign, (3) docs/backlog + skills (docs-only, low-risk). Rerun /commit-split.

  [SIZE] 258 files, +15538/-854, 31 commits — far over the >40 files / >800 net-line P1 line.
    Net of exceptions (23 images, 103 md docs, skills-lock.json): still 128 code files,
      ~+8030/-835. Single largest reviewable unit in repo history.
    Fix: split as above. No reviewer can give 128 code files a real line-level pass in one sitting.

  [MERGE READINESS] PR is unlandable as-is — two hard blockers:
    1. HEAD 02e6eab has ZERO CI check-runs (statusCheckRollup empty). Last green CI was
       2026-05-28 on an older SHA; ~18 commits landed after with no validation. Test-plan
       boxes for unit/int/e2e are unchecked ("run in CI") — but CI never ran on this tip.
    2. mergeable: CONFLICTING — 8 op-console files conflict with master (add/add + content):
       app/op/(console)/dashboard/page.tsx, app/op/(console)/reports/overview/page.tsx,
       components/charts/RevenueLineChart.tsx, components/op/{ActivityFeed,ConsoleHeader,KpiTile,
       OperatorNav}.tsx, lib/op/statusLabels.ts. An operator-console redesign already merged to
       master; this branch evolved the same files in parallel.
    Fix: resolve conflicts against current master, push to trigger a fresh CI run on the new HEAD,
      do not mark ready until CI green AND mergeable=MERGEABLE.

PRIORITY 2 — Fix before merge:

  [NEGATIVE SPACE / API DOCS] New public endpoint app/api/op/activity/route.ts (operator activity
    feed) added with no API-contract / OpenAPI entry.
    Fix: document the endpoint (auth, query params, response shape) or run /api-contract.

  [ROLLBACK] Money-path behavior changes (payout T+3→T+1, webhook overpay branch, oversell flag
    removal) ship together. docs/runbook-hold-rollback.md covers the SEARCH_USE_BLOCKED_SEATS
    flip, but payout-timing change carries only an inline TODO(ledger 048-050) and there is no
    consolidated rollback note in the PR body for the payout/overpay changes.
    Fix: add a rollback paragraph to the PR body (or /rollback-plan) covering payout-timing revert
      + overpay-branch disable. Reversibility is fine (additive); the documentation is the gap.

PRIORITY 3 — Address when convenient:

  [ENV DRIFT] SEARCH_USE_BLOCKED_SEATS removed from lib/config/env.ts but still present in
    .env.example:24,26. Stale env key — readers will set a flag the code no longer reads.
    Fix: drop both lines from .env.example (runbook-hold-rollback.md references are historical, OK).

  [PR DESC] Title 71 chars (limit 70). Trim to ≤70.

  [COMMIT MSG] Several feat/fix commits lack a body (env flag adjustments, calendar primitives,
    account redesign). Bodies present on the high-risk money commits (good). Minor.

SUMMARY: 3 P1, 2 P2, 3 P3

RECOMMENDED NEXT STEPS:
  → SPLIT: the money-path fixes should not ride with the UI redesign. If a re-split is out of
    scope for this session, treat the money path as the review priority (see /code-review +
    /security-review-deep findings) since those changes carry the real blast radius.
  → MERGE READINESS is the gating blocker: resolve the 8 op-console conflicts, push, get CI green.
  → Re-run /pr-review 6 after the conflict-resolution push to confirm mergeable + CI state flip.
