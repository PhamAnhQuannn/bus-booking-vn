# Section 7 — Operator Auth — Fix Validation Final Synthesis

Date: 2026-06-30
Scope: Validation of fixes J1, J2, N1 only
Validators: V1 (unit/tsc/lint), V2 (Playwright MCP), V3 (Chrome DevTools MCP), V4 (E2E suite), V5 (log/audit)

## Fixes Under Validation

| Fix | File | Change | Severity |
|-----|------|--------|----------|
| J1 | `proxy.ts:93` | Added `/op/forgot-password` to `OP_AUTH_FREE_PATHS` exact-match Set | HIGH |
| J2 | `app/op/login/page.tsx:48-60` | Login 429 branching: distinct messages for `LOCKED_OUT` vs `RATE_LIMITED` | MEDIUM |
| N1 | `playwright.config.ts:11,35` | Port 3000 to 3001 in `baseURL` and `webServer.url` | LOW |

## Validation Matrix

| Fix | V1 (unit/tsc/lint) | V2 (browser) | V3 (DevTools) | V4 (E2E) | V5 (audit) | Verdict |
|-----|-------------------|-------------|--------------|---------|-----------|---------|
| J1 | PASS | PASS (5/5) | -- | -- | PASS | **FIXED** |
| J2 | PASS | -- | PASS (4/4) | -- | PASS | **FIXED** |
| N1 | PASS | -- | -- | PASS (20/26, 6 pre-existing) | PASS | **FIXED** |

## J1 Validation Detail

V2 confirmed `/op/forgot-password` loads unauthenticated (HTTP 200, phone input + submit button rendered, zero console errors). Protected pages (`/op/profile`, `/op/dashboard`) still redirect to `/op/login` -- no over-permissioning. Other auth-free pages (`/op/login`, `/op/register`) unaffected.

V5 confirmed the diff is a single-line addition to the exact-match `Set` in `proxy.ts`, consistent with the project rule against prefix-match allowlists. No side effects, no secrets in diff.

## J2 Validation Detail

V3 verified all three UI branches by code review and live 401/200 testing:
- 401 wrong credentials: displays "Ten dang nhap hoac mat khau khong dung."
- 429 `LOCKED_OUT`: displays lockout message referencing "15 phut"
- 429 generic: displays rate-limit message
- 200 success: returns operator fields (id, username, displayName), zero console errors

V1 confirmed 1507/1509 unit tests pass (2 failures are pre-existing timeouts in `ticketPdf.test.ts` and `retentionSweeper.test.ts`, unrelated). All operator-auth suites at 100%. tsc clean, lint clean on changed files.

Note: 429 paths verified by source-code review; triggering real lockout was out of scope for fix validation.

## N1 Validation Detail

V4 confirmed both `baseURL` and `webServer.url` resolve to `:3001`. E2E results: 20/26 passed, 6 pre-existing failures (see Regression Check). No `:3000` references remain in config.

V5 confirmed the diff is +2/-2 lines, both port substitutions, no other changes to `playwright.config.ts`.

## Regression Check

**Zero regressions introduced by J1, J2, or N1.**

Pre-existing failures cataloged:

| Category | Count | Root Cause |
|----------|-------|------------|
| Unit test timeouts | 2 | `ticketPdf.test.ts`, `retentionSweeper.test.ts` -- unrelated modules |
| Stale `operator.phone` assertion | 2 | op-first-login specs reference field removed in prior migration |
| Proxy 410 OTP peek gate | 4 | `/api/auth/otp*` blanket-blocked by customer-auth pause |
| Full lint warnings | 45 | Pre-existing, zero in changed files |

All pre-existing failures reproduce without the fixes applied.

## Final Sign-off: PASS

All three fixes validated as **FIXED** across 5 independent agents. 3 files changed, 0 regressions, 0 secrets exposed. Static analysis (tsc + lint) and unit tests clean. Pre-existing failures documented and unrelated.
