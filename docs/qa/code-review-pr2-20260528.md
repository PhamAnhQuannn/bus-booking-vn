CODE REVIEW — PR #2 "Redesign auth pages with split-panel brand layout" @ 4ac6ac30
────────────────────────────────
Diff scope: 10 files, +482 / -102
Reviewed: 2026-05-28 (standalone PR mode — report only, no PR comment)
Pinned: 4ac6ac30 (== local HEAD; diff fetched locally after gh rate-limit)

PRIORITY 1 — Block push, fix first:
  (none)

  Mistake-Log auto-P1 scan: CLEAR.
  - CSRF (Issue 007): `X-CSRF-Token: getCsrf()` preserved on the refactored register
    `sendOtp` fetch; op pages still use `readCsrfToken()`. No header dropped.
  - Issue 010 exact-match-Set rule does NOT apply here: `startsWith('/auth')` in
    SiteHeader/SiteFooter hides UI chrome — it is NOT a security path-bypass allowlist.
    No authz decision rides on it. (See P3 note for the cosmetic over-match.)
  - Issue 016 Date.now()-in-RSC: SiteFooter `new Date().getFullYear()` is fine — the file
    is `'use client'`. AuthSplitLayout has no non-deterministic calls.

PRIORITY 2 — Fix before merge:
  [TEST / NEW BEHAVIOR] app/auth/register/page.tsx:46-71 (sendOtp + handleResend + resend cooldown)
    The redesign adds genuinely NEW client behavior — extracted `sendOtp()`, a resend
    button, and a 1s-tick cooldown (`useEffect` on `resendIn`). No automated test covers it.
    PR body lists "DOM asserts ×6" + screenshots but commits no test file. Not a money/
    authz/data-loss branch (server rate-limit still authoritative), so P2 not P1.
    Fix: add a component/e2e test for the resend path — cooldown disables the button,
    `rate_limited` response seeds `retryAfter`, button re-enables at 0. The existing
    e2e suite drives auth via URL/DOM; mirror that.

PRIORITY 3 — Address when convenient:
  [SCOPE / HYGIENE] components/layout/SiteHeader.tsx:17
    Adds NAV item `{ href: '/routes', label: 'Tuyến đường' }`. Route exists
    (app/routes/page.tsx) so the link is valid — but this is an undocumented change: the
    PR summary scopes this PR to "presentational only" + chrome-hide. A new top-nav entry
    is neither. Fix: either drop it from this PR or add a line to the PR Summary.

  [READABILITY / PREFIX MATCH] components/layout/SiteHeader.tsx:24, SiteFooter.tsx:29
    `pathname.startsWith('/auth')` also matches a hypothetical `/authors`-style route.
    Cosmetic only (chrome hide), and consistent with the pre-existing `/op` + `/dev`
    prefix checks — so low priority. Fix (optional): tighten to `=== '/auth' ||
    startsWith('/auth/')` if a sibling `/auth*` route is ever added.

  [FAILURE MODE / UX] app/auth/register/page.tsx:53
    `const json = await res.json()` runs before the `!res.ok` check. A non-JSON error
    body (e.g. a 500 HTML page) throws at `.json()`, falls to the caller's
    `catch { setError('Lỗi kết nối…') }` — so an HTTP failure is reported as a connection
    error. Pre-existing pattern (unchanged semantics), minor. Fix (optional): guard
    `res.json()` or branch on `res.ok` first.

SUMMARY: 0 P1, 1 P2, 3 P3

────────────────────────────────
WHAT'S GOOD (noted, not required)
  - a11y improvements land throughout: error <p> now `role="alert" aria-live="assertive"`,
    submit buttons get `aria-busy={loading}`, decorative SVG/StepDots `aria-hidden`,
    logo link `aria-label`. Matches the design spec.
  - `json.retryAfter ?? 30` adds the null-fallback the old inline code lacked.
  - STEP_INDEX / STEP_SUBTITLE are named maps, not magic numbers/strings.
  - AuthSplitLayout is hook-free and prop-driven; safe to compose inside the 'use client'
    pages. `audience` discriminated union keeps customer vs operator styling type-safe.
  - useEffect cooldown timer clears its timeout on unmount — no leak.

RECOMMENDED NEXT STEPS:
  → No P1 — nothing blocks merge on line-level grounds.
  → P2: add the resend-OTP test before merge (or file a follow-up if deferring).
  → P3s are low-risk; the /routes nav add is worth a one-line PR-body mention for honesty.
  → Deeper auth attack-surface walk deferred to /security-review.
