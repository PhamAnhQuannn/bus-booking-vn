CODE REVIEW — PR #4 "feat(op): operator console redesign" @ 55c043d6
────────────────────────────────
Diff scope: 79 files, +5040 / -395 (merge-base 4ac6ac3 — un-rebased; ~+595 of the
delta is content already on master via PR #3 squash). Effective NEW code from PR #4's
intended scope ≈ +4445 across ~74 files.
Reviewed: 2026-05-28 (standalone PR mode — report only, no PR comment)
Pinned: 55c043d6 (fetched via `git fetch origin pull/4/head:_pr4-review` after gh diff
preflight; avoided burning gh API on a 5040-line unified diff).

PRIORITY 1 — Block push, fix first:
  [TEST / RISK PATH] app/api/op/activity/route.ts (new file)
    New operator-scoped endpoint. No test file added in this PR. Admin/operator
    routes are a risk path (tenant isolation, JWT gating). The route itself is
    well-written — `requireOperatorAuth()` wraps the handler, `limit` is clamped
    `Math.min(Math.max(Number(...) || 30, 1), 100)`, and `withErrorHandler`
    catches throws. The code-level concerns are all answered; the missing piece
    is the integration test that proves they stay answered.
    Fix: add `app/api/op/activity/__tests__/route.int.test.ts` covering:
      - 401 without an operator session,
      - tenant scoping (operator A's request never returns operator B's events),
      - happy-path response shape (`{ events: [...] }`),
      - limit clamp (limit=9999 returns ≤100; limit=-5 returns ≥1; limit="abc"
        falls back to 30).

  Mistake-Log auto-P1 scan: CLEAR.
  - Issue 002 (RSC self-fetch own API): `/op/(console)/activity/page.tsx` calls
    `getActivityFeed()` IN-PROCESS — comment even says "hydrates initial events
    via in-process getActivityFeed". Correct pattern.
  - Issue 016 (Date.now/Math.random in RSC render body): no NEW occurrences in
    `app/op/(console)/**/page.tsx`. (Two `-` deletions exist but those are pre-
    existing code being removed.)
  - Issue 010 (exact-match Set for path-bypass authz): no new authz allowlist.
  - Issue 007/012 (schema-vs-SQL @@index parity): N/A — no schema changes in
    this PR (FunnelEvent / migrations live on master, NOT in PR #4 contrary to
    the Explore agent's first pass).
  - Issue 013 (I7 client-price invariant): no payment-flow code touched.

PRIORITY 2 — Fix before merge:
  [TEST / NON-RISK PATH] lib/op/getActivityFeed.ts (new file, ~200 lines)
    Exported tenant-scoped data function. 4 parallel Prisma reads + merge-sort
    + slice. Non-risk path (read-only, no writes), but enough logic to deserve
    coverage:
      - empty result returns `[]`,
      - low_capacity bucketing skips trips below the 0.9 threshold,
      - capacity=0 is skipped (divide-by-zero guard),
      - merge-sort is timestamp DESC and truncated at `limit`,
      - tenant isolation (operator A doesn't see operator B's bookings/trips).
    A focused unit test with a Prisma mock or fixture suffices.

PRIORITY 3 — Address when convenient:
  [PERF / REF-STABILITY] components/charts/RevenueLineChart.tsx:64-72
    `const merged = data.map(...)` and `const srRows = data.map(...)` allocate
    new arrays every render. Passed straight to recharts `<LineChart data={merged}>`.
    recharts is robust to data refs changing, but per the Mistake Log
    inline-object → re-render pattern this should be:
      const merged  = useMemo(() => data.map(...), [data, compare]);
      const srRows  = useMemo(() => data.map(...), [data]);
    Same fix in BookingStatusDonut.tsx (`srRows`, `total`).

  [SHAPE / DUPLICATION] app/auth/login/page.tsx, app/auth/register/page.tsx,
    app/auth/register/__tests__/resendOtp.test.tsx, lib/auth/safeReturnTo.ts,
    .understand/findings-ledger.json all appear in the PR diff but already
    exist on master with identical content (via PR #3 squash commit `c827c3b`).
    Code-level review of these files is a no-op — they were already reviewed
    in the PR #2 + PR #3 round. The shape concern (un-rebased branch) is
    covered by /pr-review's P1; restating here as P3 review-noise.
    Fix: rebase onto origin/master before merge (drops the duplication).

  [UX LAG] components/op/CommandPalette.tsx:90 (readRecent inside useMemo)
    `readRecent()` reads localStorage inside a useMemo keyed on `[role, router]`.
    When the user navigates and `pushRecent()` updates localStorage, the palette's
    recent list won't refresh until role or router changes. Minor — recent list
    lag isn't a bug, just stale-on-reopen. Fix (optional): move recent into
    `useState` synced via a `useEffect([open])` so it re-reads each time the
    palette opens.

SUMMARY: 1 P1, 1 P2, 3 P3

────────────────────────────────
WHAT'S GOOD (noted, not required)
  - `/api/op/activity` handler is tight: requireOperatorAuth + clamped limit +
    withErrorHandler. Nothing wasted.
  - `getActivityFeed` uses `Promise.all` across 4 queries (no N+1), every query
    scopes via `operatorId` or `trip.operatorId` for tenant isolation, includes
    a `capacity === 0 continue` divide-by-zero guard, and day-buckets
    `trip.low_capacity` event IDs to prevent re-firing the same alert every
    poll. Clever and correct.
  - CommandPalette: useMemo on the command list, memoized filter, normalizeVi
    runs only on visible commands. Logout swallows fetch error with a comment
    explaining the swallow is safe (clear-cookie idempotent). CSRF threaded
    via `readCsrfToken()`.
  - Global scan: no `dangerouslySetInnerHTML`, no `eval` / `Function` / `exec`,
    no `console.log`/`debugger`/`.only`/`.skip`, no `fetch('https://`)`, no
    secret-shaped env literal — clean diff hygiene at scale (79 files).
  - Commit messages: every one of the 9 commits has a non-empty body. Rare.

RECOMMENDED NEXT STEPS:
  → Add the /api/op/activity integration test before merge (P1 blocker).
  → Add a getActivityFeed unit/integration test (P2).
  → Apply the chart useMemo fix in the same commit if convenient (P3, low risk).
  → Rebase onto origin/master to drop the squash-merge duplication (P3 here,
    P1 in /pr-review — that's the canonical place for the fix).
  → Deeper architecture concerns (lib/op + components/op seams, ADR for recharts)
    deferred to /architect-review; auth-surface concerns to /security-review.
