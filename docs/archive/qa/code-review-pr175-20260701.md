CODE REVIEW — PR #175 "fix(auth): operator auth QA fixes" @ e06f9d07
────────────────────────────────
Diff scope: 24 files, +806 / -3 lines (3 code files, 5 QA docs, 16 screenshots)

Code-only diff: proxy.ts (+1), app/op/login/page.tsx (+10/-1), playwright.config.ts (+2/-2)

## Category 1 — Correctness

No findings. All three changes are minimal and correct:

- **proxy.ts**: Single string addition to an exact-match `Set`. No logic change, no new branching.
- **page.tsx**: `res.status === 429` check correctly placed inside the existing `if (!res.ok)` block. The `.json().catch(() => ({}))` fallback handles non-JSON 429 responses gracefully. The `as { error?: string }` cast is safe (fallback `??  ''` handles missing field). Three distinct error messages map to three distinct server responses (401, 429/RATE_LIMITED, 429/LOCKED_OUT).
- **playwright.config.ts**: Port literal change only. `PLAYWRIGHT_BASE_URL` env override preserved.

## Category 2 — Security smells

No findings. No new auth routes, no input validation changes, no secrets in diff. The proxy.ts change adds a path to the auth-free allowlist — `/op/forgot-password` is a public page (pre-auth by definition), consistent with the existing `/op/login` and `/op/register` entries.

## Category 3 — Failure mode

No findings. The `res.json().catch(() => ({}))` in page.tsx correctly handles the edge case where a 429 response body is not valid JSON.

## Category 4 — Test coverage

No new exported functions or route handlers in this diff. The changes modify existing UI error handling (client component) and a config allowlist. Validated via 3 rounds of multi-agent testing (see QA reports in this same diff). No additional unit tests required.

## Category 5 — Naming + readability

No findings.

## Category 6 — Diff hygiene

No findings. No console.log, no debugger, no commented-out code. The 21 non-code files are all QA documentation and validation screenshots — appropriate for the scope of work.

SUMMARY: 0 P1, 0 P2, 0 P3

RECOMMENDED NEXT STEPS:
  → No P1 findings. Clear to merge.
  → QA docs provide comprehensive validation evidence.
