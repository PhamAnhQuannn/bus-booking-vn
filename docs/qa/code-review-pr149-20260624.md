CODE REVIEW — PR #149 "fix(search): snapshot/restore mobile filter state on sheet dismiss" @ 9959ce7d
────────────────────────────────
Diff scope: 1 file, +33 / -4 lines

PRIORITY 1 — Block push, fix first:
  (none)

PRIORITY 2 — Fix before merge:
  (none)

PRIORITY 3 — Address when convenient:
  [TEST / NON-RISK] components/search/SearchFilters.tsx
    No test added for snapshot/restore behavior. Acceptable for a pure UI
    interaction fix — no route handler, no server action, no risk-path domain.
    Sheet dismiss → URL revert is hard to unit-test without a browser; Playwright
    e2e would be the right layer if coverage is desired later.

SUMMARY: 0 P1, 0 P2, 1 P3

RECOMMENDED NEXT STEPS:
  → No P1 findings. Proceed to CI / merge.
