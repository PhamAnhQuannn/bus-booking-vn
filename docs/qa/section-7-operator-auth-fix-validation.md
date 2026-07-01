# Section 7 — Operator Auth — Fix Validation Report

Date: 2026-06-30

## Fixes Applied

| Fix ID | File:Line | What Changed | Severity |
|--------|-----------|-------------|----------|
| J1 | `proxy.ts:90-95` | Added `'/op/forgot-password'` to `OP_AUTH_FREE_PATHS` Set | High — page was unreachable |
| J2 | `app/op/login/page.tsx:48-60` | Login error handler now branches on `res.status === 429`, distinguishing `LOCKED_OUT` vs `RATE_LIMITED` messages | Medium — wrong UX feedback |
| N1 | `playwright.config.ts:11,35` | Changed default `baseURL` and `webServer.url` from `:3000` to `:3001` | Low — test infra only |

## Validation Matrix

| Fix | Unit Tests | Type Check | Lint | Browser Test | E2E | DevTools | Verdict |
|-----|-----------|-----------|------|-------------|-----|---------|---------|
| J1 | PASS (95/95) | PASS (0 errors) | PASS | PASS (4/4 checks) | PASS (N/A direct) | PASS (0 errors, 41 req 200/304) | **FIXED** |
| J2 | PASS (95/95) | PASS (0 errors) | PASS | PASS (3/3 states verified) | PASS (N/A direct) | PASS (expected 429 only) | **FIXED** |
| N1 | PASS (95/95) | PASS (0 errors) | PASS | N/A | PASS (all requests hit :3001) | N/A | **FIXED** |

## Fix J1: /op/forgot-password Unreachable

### Before
Unauthenticated users navigating to `/op/forgot-password` were intercepted by `proxy.ts` Edge middleware and redirected to `/op/login`. The path was missing from the `OP_AUTH_FREE_PATHS` allowlist.

### After
`'/op/forgot-password'` added to the exact-match `OP_AUTH_FREE_PATHS` Set at `proxy.ts:90-95`. The page now loads without authentication.

### Evidence
- **V-Agent 2 (Playwright MCP):** Direct navigation to `/op/forgot-password` renders the form (phone input, "Gui ma OTP" button, "Quay lai dang nhap" link). Clicking "Quen mat khau?" from `/op/login` navigates correctly. POST `/api/op/auth/forgot-password` returns 202 and advances to OTP entry.
- **V-Agent 2:** Auth guards on protected pages (`/op/profile`, `/op/dashboard`) still redirect to `/op/login` — no over-permissioning.
- **V-Agent 5 (DevTools):** `/op/forgot-password` loads with 0 console errors, all 41 network requests return 200/304.

### Verdict: FIXED

## Fix J2: Login Error Message Conflation

### Before
All non-ok responses from the login endpoint displayed the generic wrong-password message ("Ten dang nhap hoac mat khau khong dung."), including 429 responses for rate limiting and account lockout.

### After
`app/op/login/page.tsx:48-60` now branches on `res.status === 429` and reads the response body to distinguish:
- `LOCKED_OUT` -> "Tai khoan tam khoa sau nhieu lan dang nhap sai. Vui long thu lai sau 15 phut."
- `RATE_LIMITED` -> "Qua nhieu yeu cau. Vui long thu lai sau."
- Other non-ok -> original wrong-password message (unchanged)

### Evidence
- **V-Agent 3 (Chrome DevTools MCP):** All 3 error states verified in a single session:
  - Wrong credentials (401): correct generic message displayed
  - IP rate limit (429 `RATE_LIMITED`): correct rate-limit message displayed
  - Account lockout (429 `LOCKED_OUT`): correct lockout message displayed
- **Screenshots:** `docs/qa/screenshots/j2-test1-wrong-credentials.png`, `j2-test2-rate-limited.png`, `j2-test3-locked-out.png`
- **V-Agent 3:** Structural code review confirms branching logic is correct.

### Verdict: FIXED

## Fix N1: Playwright Config Port Mismatch

### Before
`playwright.config.ts` had `baseURL` and `webServer.url` set to `http://localhost:3000`. Dev server runs on port 3001 (port 3000 is occupied by a different app), causing all E2E tests to target the wrong server.

### After
`playwright.config.ts:11,35` updated to `http://localhost:3001`.

### Evidence
- **V-Agent 4 (E2E Playwright):** Full E2E suite ran against :3001. All requests confirmed hitting the correct port. No :3000 references in test traffic. 16/26 tests passed; all 10 failures are pre-existing issues unrelated to port config (see Regression Analysis below).

### Verdict: FIXED

## Regression Analysis

### E2E Failures (10/26) — Pre-existing, Not Regressions

| Root Cause | Tests Affected | Relation to Our Fixes |
|-----------|---------------|----------------------|
| **Stale field assertion** — test asserts `loginJson.operator.phone` but 2026-06-06 username migration removed `phone` from login response | 2 (op-first-login "full flow" x2 projects) | None — test/spec drift from prior migration |
| **Proxy 410 gate swallows OTP peek** — `proxy.ts:204-214` blanket-blocks `/api/auth/otp*` with 410 `customer_accounts_disabled`; operator E2E calls `/api/auth/otp/test-peek?type=operator` which is caught | 4 (op-forgot-password "full OTP flow" + "lockout" x2 projects) | None — pre-existing gap from customer-auth pause |
| **WebKit + plain-HTTP cookie loss** — `playwright.config.ts` documents "WebKit drops Secure cookies on http" | 4 (op-first-login AC1 redirect + 3 op-profile tests, mobile-390 only) | None — known WebKit limitation on non-HTTPS |

All 10 failures reproduce without our fixes applied. Zero new failures introduced.

## New Findings During Validation

| # | Finding | Severity | Source | Relation to Fixes |
|---|---------|----------|--------|-------------------|
| 1 | **OTP input pre-populated with phone number** — after submitting phone on forgot-password form, the OTP input field shows the phone number value instead of being empty. Step-transition state leak. | Low | V-Agent 2 | Unrelated to J1 (page routing fix); separate UI bug |
| 2 | **`clientIp()` trusts `X-Forwarded-For` without trusted-proxy validation** (`app/api/auth/login/route.ts:30-34`) — spoofable header allows IP rate-limit bypass | Medium | V-Agent 3 | Pre-existing; not caused by J2 |
| 3 | **45 pre-existing lint warnings** — none in files changed by our fixes | Info | V-Agent 1 | Pre-existing |

## Final Verdict

All three fixes (J1, J2, N1) are validated as **FIXED** with zero regressions. The 10 E2E failures are pre-existing issues with documented root causes unrelated to the applied changes. Static analysis (tsc, lint) and unit tests (95/95) are fully clean. Two new findings (OTP pre-population bug, `X-Forwarded-For` trust) are pre-existing issues surfaced during validation and should be tracked separately.

**Sign-off: PASS**
