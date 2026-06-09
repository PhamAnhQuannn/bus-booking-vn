SECURITY REVIEW — PR #4 "feat(op): operator console redesign" @ 55c043d6
─────────────────────────────
Scope: auth/admin attack-surface walk of the PR #4 diff + the unchanged-but-touched
security-relevant code on the pages this PR modifies.
Reviewed: 2026-05-28 (manual pass — built-in /security-review couldn't bootstrap
because the local `origin/HEAD` 3-dot range balloons past the actual PR scope;
reviewed exactly the PR surface via `git diff 4ac6ac3.._pr4-review`).
Delivery: report only, no PR comment, no PR mutation.

INTRODUCED BY THIS PR: 0 P1, 0 P2.
The redesign is largely presentational + adds one well-gated read endpoint
(`/api/op/activity`). CSRF, tenant isolation, requireOperatorAuth all preserved.
Findings below are pre-existing on pages this PR modifies — surfaced because a
security pass on operator pages should report them.

PRIORITY 1 — (pre-existing on modified pages; fix in a follow-up, does not block this PR):
  [AUTHZ / RSC PRE-FETCH BYPASSES ROLE GATE]
    `app/op/(console)/staff/page.tsx` → `lib/op/getOperatorStaff.ts`
    The /op/staff page is the only `adminOnly` nav item (see components/op/navConfig.ts
    line ~133), and the matching API routes correctly gate via
    `requireOperatorAuth({ adminOnly: true })` (verified across
    `app/api/op/staff/route.ts`, `[id]/route.ts`, `[id]/disable/route.ts`,
    `[id]/assign-service/route.ts`).

    BUT: the RSC pre-fetch path bypasses that gate. `getOperatorStaff()`:
        - reads bb_op_access JWT
        - verifies, checks `disabledAt`
        - calls `listStaff(operator.operatorId)` and returns the full roster
        - returns `isAdmin: operator.role === 'admin'` as a FLAG, not as a gate
    The page renders `<StaffClient initialStaff={view.staff} isAdmin={view.isAdmin} />`,
    so a `role: 'staff'` user navigating to `/op/staff` server-renders the entire
    staff roster (names, phones, statuses) and ships it down the wire. Client-side
    mutation buttons may be hidden by `isAdmin`, but the READ data has already left
    the server.

    Severity qualifiers:
      - Intra-tenant only — staff sees their OWN operator company's roster, not
        another company's. (`listStaff(operator.operatorId)` scopes correctly.)
      - PII scope: coworker phone numbers + names + roles. Mild internal leak;
        staff likely knows colleagues' phones already. But the role gate is the
        contract; this breaks it.
      - Pre-existing (Issue 017 authorship). Modified — but not introduced — by
        PR #4 (the redesign added the PageHeader rendering only).
      - The API enforces the gate; the RSC path is the gap. Symmetrically a
        defense-in-depth violation.

    Fix (one-liner, in getOperatorStaff.ts):
      if (operator.role !== 'admin') return null;
    Then the page's existing `if (!view) redirect('/op/login')` handles it — though
    `redirect('/op/bookings')` would be a friendlier non-admin landing. Either way,
    move the role check INTO the lib so the same gate covers all consumers (matches
    the API's `adminOnly: true` shape).

PRIORITY 2 — Fix before merge:
  (none introduced by this PR)

PRIORITY 3 — Address when convenient:
  [LOCALSTORAGE — non-sensitive data] components/op/CommandPalette.tsx
    `RECENT_KEY = "op:cmdk-recent"` stores nav-item IDs (e.g. "dashboard",
    "bookings") in localStorage. Not PII, not authz-bearing. Reading is guarded
    by `typeof window === "undefined"` + try/catch. No issue — noted only so a
    future audit doesn't re-flag it.

  [DUPLICATED FROM PR #3] safeReturnTo / resendOtp.test / register/login auth
    files appear in this diff because the branch wasn't rebased after PR #3's
    squash merge. Content matches master. Same authz posture as already reviewed
    in security-review-pr2; not re-litigated here.

CONFIRMED CLEAN (checked in PR #4):
  - **NEW API ROUTE `/api/op/activity`**: requireOperatorAuth() wraps the handler.
    `ctx.operatorId` is the ONLY tenant identifier passed to `getActivityFeed()`.
    `limit` is clamped 1–100 with NaN→30 fallback. `withErrorHandler` covers throw.
  - **getActivityFeed tenant isolation**: every Prisma query scopes via
    `operatorId: input.operatorId` or `trip.operatorId: input.operatorId`
    (verified across all 4 parallel reads in `lib/op/getActivityFeed.ts`).
  - **No CROSS-tenant data leak**: response shape (bookingRef, buyerName, totalVnd,
    route origin/destination) is operator-visible-by-design; never includes other
    operators' data because the query filter is rigorous.
  - **CSRF preserved**: CommandPalette logout sends `X-CSRF-Token: readCsrfToken()`.
    No other mutating client calls were added in this PR.
  - **getOperatorSession**: solid — JWT verify + `disabledAt !== null` rejection
    + role from JWT claim (Issue 010 pattern). One DB hit, returns null on failure.
  - **No SECRETS in source**: no env literal *_KEY / *_SECRET / *_TOKEN / *_PASSWORD.
  - **No DANGEROUS SINKS**: no `dangerouslySetInnerHTML`, no `eval` / `Function` /
    `child_process.exec`, no raw-SQL template-string, no SSRF (no external `fetch`).
  - **No NEW SCHEMA / no PII vector via FunnelEvent**: contrary to early scan,
    FunnelEvent and proxy.ts changes are NOT in PR #4 (they live on master).
    Nothing to assess here.
  - **RSC purity**: no Date.now / Math.random / crypto.randomUUID in new RSC
    render bodies (Issue 016 rule). Activity page uses in-process getActivityFeed,
    not self-fetch (Issue 002 rule).

SUMMARY: 0 P1 introduced / 1 P1 pre-existing surfaced, 0 P2, 2 P3

RECOMMENDED NEXT STEPS:
  → This PR does NOT introduce a security regression — safe to merge on security
    grounds.
  → File a follow-up issue for the staff-page RSC role gate. One-line lib fix
    matches the API's existing `adminOnly: true` shape and closes the
    defense-in-depth gap. Cross-link: it's the operator-side analog to PR #2's
    open-redirect (real defect, surfaced during a redesign review, gets a small
    tracked issue).
  → Architecture findings (dashboard prisma direct, statusLabels type reversal)
    are operationally orthogonal to security; addressed by /architect-review.
