CODE REVIEW — PR #340 "feat(booking): email typo suggestion + clearer phone validation" @ 603eee53
────────────────────────────────
Diff scope: 4 files, +249 / -2 lines
Files: lib/booking/emailSuggest.ts (new), lib/booking/__tests__/emailSuggest.test.ts (new),
       app/(customer)/booking/customer/CustomerForm.tsx, eslint.config.mjs

PRIORITY 1 — Block push, fix first:
  (none)

PRIORITY 2 — Fix before merge:
  (none)

PRIORITY 3 — Address when convenient:
  [TEST / INTERACTION] app/(customer)/booking/customer/CustomerForm.tsx
    The onChange-hint + submit-time soft-gate + emailAckRef "nudge once" branch has
    no automated test (unit or e2e). It was verified live in-browser this session
    (valid → review; typo → nudge → second-press proceeds; accept-suggestion fills;
    click-steal fixed). The pure logic that drives it (suggestEmail) IS covered by 7
    unit tests. Consider a Playwright e2e asserting the soft-gate nudges once and the
    button no longer reflows on submit. Non-blocking — booking path, not payment/auth.

Notes (checked, NOT findings):
  - Correctness: suggestEmail guards no-@ / empty-local / no-dot-domain; lastIndexOf('@')
    handles stray '@'; Levenshtein is standard; budget (≤1, ≤2 for len≥10) is conservative
    (mycompany.xyz / fpt.vn → null, proven by tests). ✓
  - emailAckRef flow: null→typo nudges once (sets ref), same value proceeds, edited value
    re-checks, accepted suggestion (correct addr) → suggestEmail null → proceeds. No loop. ✓
  - acceptSuggestion sets emailRef.current.value imperatively; handleSubmit reads via
    new FormData(currentTarget) (DOM), so the corrected value flows. ✓
  - Security: activeSuggestion + error message rendered as JSX TEXT (React-escaped), no
    dangerouslySetInnerHTML; suggestion domain is from a hardcoded allowlist. No secrets,
    SQL, eval, redirect. Client-side only; holdInputSchema (server) unchanged. ✓
  - 'use client' boundary: emailSuggest deep-imported + allowlisted in eslint.config.mjs
    (barrel would leak server-only siblings → 500). Compliant with the CLAUDE.md rule. ✓
  - Hygiene: no console/debugger/.only/.skip in the diff. ✓

SUMMARY: 0 P1, 0 P2, 1 P3

RECOMMENDED NEXT STEPS:
  → No blockers. P3 (interaction e2e) can ride a follow-up; core logic is unit-covered.
