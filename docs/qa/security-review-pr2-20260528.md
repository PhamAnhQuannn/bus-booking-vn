SECURITY REVIEW — PR #2 "Redesign auth pages with split-panel brand layout" @ 4ac6ac30
─────────────────────────────
Scope: auth attack-surface walk of the 10-file PR diff + the unchanged security-relevant
code on the pages this PR modifies (redirect/token sinks).
Reviewed: 2026-05-28 (manual pass — the built-in /security-review preamble could not bootstrap:
`origin/HEAD` was unset and the local `origin/master` ref is stale, so its 3-dot range
ballooned far past the 10 PR files. Reviewed exactly the PR surface instead.)
Delivery: report only, no PR comment, no PR mutation.

INTRODUCED BY THIS PR: 0 P1, 0 P2.
The redesign is presentational. CSRF, API calls, redirect logic, and selectors are unchanged
(matches PR body). The findings below are PRE-EXISTING surface on the modified pages — surfaced
because a security pass on auth pages should report them, NOT because this PR caused them.

PRIORITY 1 — (pre-existing on modified pages; fix in a follow-up, does not block this PR):
  [OPEN REDIRECT] app/auth/login/page.tsx:35,60  AND  app/auth/register/page.tsx:76,192
    `const returnTo = searchParams.get('returnTo') ?? '/'` is read from the URL query string
    and passed directly to `router.push(returnTo)` after a successful auth — with no
    validation. An attacker link like `/auth/login?returnTo=https://evil.tld` (or the
    protocol-relative `returnTo=//evil.tld`) bounces a freshly-authenticated user off-site —
    a phishing / session-handoff primitive. Classic post-login open redirect.
    NOT introduced by this PR (these lines are unchanged; the diff only touched JSX below
    line 65). Fix (follow-up issue): allow only same-origin relative paths — reject any value
    that doesn't start with a single `/`, and reject `//` and `/\`. e.g.
      const raw = searchParams.get('returnTo') ?? '/';
      const returnTo = /^\/(?!\/)/.test(raw) ? raw : '/';
    Apply identically in both login and register. Consider a shared `safeReturnTo()` helper.

PRIORITY 2 — Fix before merge:
  (none)

PRIORITY 3 — Address when convenient:
  [OTP RESEND — client cooldown is not a security control] app/auth/register/page.tsx:46-71
    The new resend button + 30s `resendIn` cooldown is UX only — a page refresh resets it to
    0. This is acceptable: the server `/api/auth/otp/send` rate-limit is authoritative (the
    `rate_limited` / `retryAfter` branch is handled). Noting so no one later mistakes the
    client timer for the abuse guard. No fix needed; confirm server rate-limit covers the
    resend path (it shares the same endpoint, so it does).

  [TOKEN IN MODULE SINGLETON — pre-existing] app/auth/register/page.tsx:33
    Access token kept in a module-level `_accessToken` variable (readable by any same-bundle
    code; XSS could exfiltrate it). In-memory only — not persisted to localStorage, so it
    dies on reload (better than localStorage, worse than httpOnly cookie). Unchanged by this
    PR; flag for the same follow-up that lifts client-session state into lib/auth/.

CONFIRMED CLEAN (checked, no issue):
  - CSRF: register `sendOtp` sends `X-CSRF-Token: getCsrf()`; op pages use `readCsrfToken()`.
    Double-submit token (bb_csrf cookie) preserved on every mutating call. No regression.
  - XSS: all error text rendered as `{error}` / `{`…${retryAfter}…`}` React text nodes
    (auto-escaped). No `dangerouslySetInnerHTML`, no raw HTML sink. Error strings are fixed
    Vietnamese literals + a numeric `retryAfter`. Safe.
  - SECRETS: no API key / token / secret literal in the diff. CSRF token sourced from cookie,
    not an env secret.
  - OPERATOR REDIRECTS: app/op/login + op/first-login push only static in-app paths
    (`/op/first-login`, `/op/dashboard`) — no user-controlled redirect target. Safe.
  - CHROME-HIDE PATH MATCH: `startsWith('/auth')` gates UI chrome only, not authorization —
    not a security decision (Issue 010's exact-match-Set rule is about authz path-bypass).

SUMMARY: 0 P1 introduced / 1 P1 pre-existing surfaced, 0 P2, 2 P3

RECOMMENDED NEXT STEPS:
  → This PR does not introduce a security regression — safe to merge on security grounds.
  → File a follow-up issue for the open-redirect (`safeReturnTo()` guard in login + register).
    It pre-dates this PR but is the single highest-value auth hardening item on these pages.
  → Bundle the token-in-singleton cleanup into the same follow-up (also flagged P3 by
    /architect-review as cross-page coupling).
