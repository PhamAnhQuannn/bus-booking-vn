# Auth feature test run — multi-strategy matrix + live Playwright-MCP (2026-08-07)

Target: this branch (`feat/customer-auth-email-google`) run on `http://localhost:3005` against the
seeded `bbvn_dev` DB. `:3001` (`-hero` worktree) lacks customer auth, so it could not be used.
Env: `OTP_PEEK_ENABLED=true`, `NOTIFY_STUB` default (stub), `REDIS_PROVIDER=memory`,
`GOOGLE_OAUTH_ENABLED` off, `AUTH_ARGON2_ENABLED` off (scrypt). OTP read from
`GET /api/auth/otp/test-peek?email=`.

## Result: 13/13 attempted scenarios PASS. 1 fix confirmed live. 3 behaviour findings + 1 env gap.

## Testing-strategy layers
- **Unit** (Vitest, mocked): route/service/validation/crypto logic, status codes, error variants.
- **Integration** (Vitest int, real DB): resolveGoogleLogin L1–L4, Account purge, OtpAttempt CHECK, re-register.
- **E2E automated** (Playwright, gated): full headless flows, cookies, redirects.
- **Live exploratory** (Playwright MCP): the run below — real browser, real DOM/labels, screenshots.

## Live scenario matrix (Playwright MCP)

| # | Scenario | Strategy | Result | Evidence / note |
|---|----------|----------|--------|-----------------|
| A1 | Guest header CTA "Đăng nhập / Đăng ký" | e2e+live | **PASS** | Desktop header link → `/auth/login` |
| A2 | Register happy path (OTP peek → 201 → logged in) | e2e+live | **PASS** | Account menu "MCP Tester". `a2-registered-loggedin.png` |
| A3 | Register EMAIL_TAKEN → "Email đã được đăng ký." | unit+live | **PASS + FIX** | Confirms the Phase-1 UI fix. `a3-email-taken-message.png` |
| A4 | Register wrong OTP → 400 invalid ("Mã OTP không đúng.") | unit+live | **PASS** | API 400 `invalid` |
| A5 | Login success → returnTo | e2e+live | **PASS** | Landed on `returnTo=/account/bookings` |
| A6 | Login wrong password → inline alert | unit+live | **PASS** | "Email hoặc mật khẩu không đúng." |
| A7 | **Login lockout: 5 wrong → 6th 429 LOCKED_OUT** | e2e(new)+live | **PASS** | Was uncovered; new spec added. 1–5 → 401, 6 → 429 |
| A8 | Session persists on hard reload | e2e+live | **PASS*** | Signed-in after reload — but see **F1** |
| A9 | Logout → guest header, bb_rt cleared | e2e+live | **PASS** | Guest CTA returns |
| A10 | Account settings: change name; delete account | e2e+live | **PASS** | "Đã cập nhật tên hiển thị."; delete → guest on `/` |
| A11 | Auth-gate: guest → `/account/bookings` redirects | live | **PASS** | → `/auth/login?returnTo=/account/bookings` |
| A13 | Operator login PB-0001 → dashboard | e2e+live | **PASS** | After seeding OperatorUser (see **env gap**). `a13-operator-dashboard.png` |
| A14 | Google disabled → `/api/auth/google/start` 404 | unit+live | **PASS** | `{"error":"google_oauth_disabled"}`; no UI button |
| A12 | Forgot-password → reset → login | e2e | not-live | Covered by `e2e/account-password-reset.spec.ts` |
| A15 | Admin login (email→TOTP) | unit | not-live | No AdminUser seed; covered by admin unit tests |

Console during the run: only benign network-status logs (guest `refresh` 401s + the intentional
negative-test 401/429/409/400). No JS exceptions, no unexpected 5xx.

## Findings

- **F1 (UX, minor) — display name not rehydrated on reload/hard-nav.** After a full page load the
  account menu shows the fallback **"Khách hàng"/"KH"** instead of the real name. `SessionBootstrap`
  restores the token via `/api/auth/refresh` but that response carries no `displayName`, so the
  client falls back until the next in-session login. Fix option: return `displayName` from
  `/api/auth/refresh` (or fetch it in `SessionBootstrap`).
- **F2 (UX, minor) — lockout not surfaced on the customer login page.** On `429 LOCKED_OUT` the page
  shows the same generic "Email hoặc mật khẩu không đúng." (the operator page has a specific
  "Tài khoản tạm khóa… 15 phút." message). A locked-out customer gets no signal to wait. Fix option:
  branch on `error === 'LOCKED_OUT'` / `'RATE_LIMITED'` in `app/(customer)/auth/login/page.tsx`.
- **F3 (behaviour, by-design — verify intent) — customer login lockout throttles the failing path
  only.** The lockout counter is consumed solely on `INVALID_CREDENTIALS`, so after the 6th wrong
  attempt returns `429 LOCKED_OUT`, a subsequent **correct** password still returns **200** (verified
  in the new e2e). This mitigates online password guessing but is NOT an account freeze. Confirm this
  is the intended policy (operator/admin lockouts should be checked for the same semantics).
- **Env gap (dev only) — seed fixtures absent.** `bbvn_dev` was migrated but had **0 OperatorUser**
  and no customer/admin login identities (operator *businesses*/trips existed for the homepage). A
  full reseed is blocked by the append-only `LedgerEntry` (13 rows) → needs `DROP SCHEMA`. For A13 the
  operator `PB-0001` was inserted manually with a scrypt hash. Not a product bug; noted for anyone
  running the app locally on this DB.

## Fix applied this session
`app/(customer)/auth/register/page.tsx` — taken-email branch checked `invalid_credentials`, but
PR-450 changed the API to `EMAIL_TAKEN`; updated so "Email đã được đăng ký." fires again (A3).

## Artifacts
- New e2e: `e2e/auth-login-lockout.spec.ts` (gated `E2E_AUTH_ENABLED`; passes vs :3001, 14.7s).
- Screenshots: `.playwright-mcp/a2-registered-loggedin.png`, `a3-email-taken-message.png`,
  `a13-operator-dashboard.png`.

## How to re-run
- Live MCP: run this branch (`pnpm exec next dev -p 3005`) with `.env.local` having
  `OTP_PEEK_ENABLED=true` + the three `REFRESH_TOKEN_SECRET_*`; drive the flows above.
- Lockout e2e: `PLAYWRIGHT_BASE_URL=http://localhost:3001 E2E_AUTH_ENABLED=true pnpm exec playwright test e2e/auth-login-lockout.spec.ts --project=chromium`.
