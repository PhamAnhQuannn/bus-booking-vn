CODE REVIEW — PR #2 "Redesign auth pages with split-panel brand layout" @ 4ac6ac30
────────────────────────────────
Diff scope: 10 files, +340 / -102 lines · single domain (auth UI, presentational)
Pinned to: 4ac6ac30

PRIORITY 1 — Block push, fix first:
  (none)

PRIORITY 2 — Fix before merge:
  [TEST / COVERAGE] app/auth/register/page.tsx (resend-OTP path) + components/auth/AuthSplitLayout.tsx
    New resend-OTP UI behavior (cooldown timer, `sendOtp` helper) and the new
    `AuthSplitLayout` shell ship without a unit/e2e test in this diff. Underlying
    OTP send + rate-limit is already covered server-side (e2e/auth-otp-roundtrip),
    and auth wiring is unchanged — hence P2, not P1.
    Fix (optional, deferrable): add a component test for AuthSplitLayout audience
    variants + a register-resend cooldown test, or extend auth-otp-roundtrip.

PRIORITY 3 — Address when convenient:
  (none)

SUMMARY: 0 P1, 1 P2, 0 P3

NOTES (verified clean):
  - Auth wiring preserved verbatim across all 6 pages: API endpoints/bodies, CSRF
    headers (getCsrf / readCsrfToken), Suspense boundary, operator
    requiresPasswordChange→/op/first-login redirect, no-enumeration on forgot-password,
    module-level setAccessToken/setDisplayName store (login still imports it).
  - Selectors stable: name=phone/password, op-* ids, [type=submit] — e2e contract intact.
  - No secrets, no console.log/debugger, no .only/.skip, no commented-out code.
  - register `sendOtp`: fetch + json both awaited; error paths handled; useEffect
    cleanup clears the cooldown timeout. No missing-await / leak.
  - No new money/auth-logic branch — Category 1/2/3 clean.

RECOMMENDED NEXT STEPS:
  → P1 == 0 → no push block from code-review.
  → P2 test-gap can ride this PR or defer (presentational, server path already tested).
