PR REVIEW — PR #4 "feat(op): operator console redesign — analytics landing, shared composers, charts, palette, activity feed" @ 55c043d6
─────────────────────────────
Diff scope: 79 files, +5040 / -395 (net +4645), 9 commits (PR body says 7)
PR exists: yes
State: open (ready, not draft)
Base: master ← feat/ota-redesign
Reviewed: 2026-05-28 (standalone PR mode — report only, no PR comment)

PRIORITY 1 — Block push, fix first:
  [SHAPE / UN-REBASED BRANCH] gh reports 9 commits in this PR; the PR body lists 7.
    The 2 extras — `357113af fix(auth): guard returnTo open-redirect`
    and `2ed4a207 docs(qa): PR #2 review reports + tracked fix-issues` — were
    SQUASH-merged into master via PR #3 (squash commit `c827c3b`). They still
    live on feat/ota-redesign as original commits because the branch never
    rebased onto master after the squash. Result: 4 already-merged files bleed
    into PR #4's diff:
      app/auth/login/page.tsx
      app/auth/register/page.tsx
      app/auth/register/__tests__/resendOtp.test.tsx
      lib/auth/safeReturnTo.ts
      (+ .understand/findings-ledger.json, also already on master)
    Net code change for the operator-console work is ~+595 lines OVER-COUNTED
    in the +5040 total. Even with no merge conflict, history is muddled.
    Fix: `git fetch origin master && git rebase origin/master` on feat/ota-redesign,
    force-push. The 2 orphan commits drop out (their content is in master); the
    file count drops by ~5 and the size threshold may move from P1 to P2.

  [SIZE] 79 files, +4645 net lines (even after subtracting the 4 squash-duplicates).
    Threshold: > 40 files / > 800 lines = MUST SPLIT. This is well past it.
    PR body acknowledges: "Original 8-PR plan executed as 7 commits". Combining
    8 planned PRs into one is a deliberate velocity choice that trades
    reviewability — but at this size the diff is genuinely hard to bisect /
    revert / land in pieces.
    Fix: split into 3-4 PRs along the existing commit groupings, e.g.:
      (1) shared composers + nav shell + route rename (commits 1+2+4)
      (2) dashboard landing tiles (commit 3)
      (3) recharts + command palette (commits 5+6)
      (4) activity feed (commit 7)
    Each is reviewable on its own and ships independently per the PR body's
    own scope-delta note ("each is a clean follow-up PR").
    Pragmatic alternative: rebase to drop the 2 orphans (P1 #1), accept the
    size as a single landing if velocity matters, and document the deliberate
    decision in the PR body. (This downgrades from a hard P1 to a documented
    P2-with-rationale — but ONLY if the PR body explicitly acknowledges it.)

  [NEGATIVE SPACE / TEST] app/api/op/activity/route.ts is a NEW route handler.
    No test file added in this diff (neither `__tests__/activity.test.ts` nor
    `.int.test.ts`). Admin/operator endpoints sit on a risk path (tenant
    isolation, auth gating).
    Fix: add an integration test exercising at minimum:
      - 401 without an operator session
      - tenant scoping (operator A cannot read operator B's feed)
      - happy-path shape

PRIORITY 2 — Fix before merge:
  [NEGATIVE SPACE / DEP LICENSE] package.json adds `recharts@^3.8.1`.
    PR body lists it under commit 5 but does NOT mention license or
    `/licensing-audit` reference. recharts is MIT (safe) but the rule
    exists so license drift never enters silently.
    Fix: add a one-line "recharts is MIT" to the PR body under a new "## Deps
    added" section, or run `/licensing-audit` and link the report.

PRIORITY 3 — Address when convenient:
  [PR DESC] PR title is 92 chars (limit 70).
    Title: "feat(op): operator console redesign — analytics landing, shared
    composers, charts, palette, activity feed"
    Fix: shorten, e.g. "feat(op): operator console redesign — analytics landing
    + composers + charts + palette + feed" (still long; truthfully this PR's
    title is long because the PR's scope is large — the size finding above is
    the real fix).

SUMMARY: 3 P1, 1 P2, 1 P3

─────────────────────────────
CATEGORY NOTES (pass detail)

Cat 1 — Scope discipline: the operator-console author scoped this as one
  coherent thread (8 op commits, single domain). The 2 orphan commits from
  the un-rebased branch contribute a foreign `fix(auth)` + `docs(qa)` intent —
  folded into the un-rebased-branch P1 above (not a separate scope finding).

Cat 2 — Diff size: hard P1 (see above).

Cat 3 — Commit message quality: PASS. All 9 commits conventional-format,
  all ≤ 72 chars, every commit has a non-empty body (lengths 307–926 chars).
  Exemplary.

Cat 4 — Negative-space audit:
  - Schema change → migration companion present. ✓ (FunnelEvent + 3 SQL
    migrations land in the diff.) Note: also verify @@index ↔ raw-SQL parity
    per the Mistake Log (Issue 007/012) — that's an architect-review concern,
    not a pr-review one.
  - New env var → none added in diff.
  - New route handler → test MISSING (see P1 above).
  - New runtime dep `recharts` → license note MISSING (see P2 above).
  - New cron / external API → none.
  - Feature flag → none new (`MANUAL_BOOKING_ENABLED` pre-existed).

Cat 5 — Rollback path: PASS. No DROP COLUMN / DROP TABLE / ALTER ... DROP /
  payment mutation / queue purge / s3 delete / `rm -rf` in the diff. FunnelEvent
  is additive. Fully reversible by revert.

Cat 6 — PR description completeness: STRONG.
  - Title 92 chars → P3 (above).
  - ## Summary present. ✓
  - ## Test plan (named "Test plan for reviewer") present with 8 steps. ✓
  - ## Out of scope explicitly lists pre-existing dirty files. ✓ Excellent.
  - ## Plan-vs-delivered scope deltas honestly enumerates the 4 deferred items
    with rationale. Notable quality — explicit deferrals beat hidden ones.
  - No linked issue (none expected; PR body table captures scope).
  - Body non-empty. ✓

Cat 7 — Negative-space on PR body: dep license note is the only gap
  (folded into Cat 4 / P2 above).

─────────────────────────────
RECOMMENDED NEXT STEPS:
  → Rebase first. `git rebase origin/master` on feat/ota-redesign; force-push.
    This drops the 2 orphan commits and the 4 already-merged files, and is a
    prerequisite for the size finding (the rebase MAY move size from P1 to P2
    if enough lines fall away).
  → After rebase, decide between (a) split into 3-4 follow-up PRs along commit
    groupings, or (b) keep as one PR and add a deliberate "large-PR acknowledged"
    line to the PR body.
  → Add /api/op/activity test before merge. Tenant isolation case is mandatory.
  → Add a one-line license note for `recharts` in PR body.
  → P3 title-length is cosmetic; ignore unless size is split out (in which case
    each sub-PR will have a shorter title naturally).
