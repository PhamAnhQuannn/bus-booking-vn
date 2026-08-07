# Login scenario suite — run report (2026-08-07)

Target: this branch on `http://localhost:3001` (real Google OAuth client wired). Driven via Playwright MCP
+ the page's API (CSRF-authenticated `fetch`) + `pg` for DB setup/verify. OTP read from
`GET /api/auth/otp/test-peek`.

Method legend: **UI** = clicked in the browser · **API** = page `fetch` (deterministic status) ·
**DB** = `pg` setup/verify · **USER** = requires the owner's Google login.

## Result matrix

| # | Scenario | Method | Result |
|---|----------|--------|--------|
| EP1 | Login success → session | API | **PASS** — 200, session minted |
| EP2 | Wrong password | API/UI | **PASS** — 401 `invalid_credentials`; UI "Email hoặc mật khẩu không đúng." |
| EP3 | Lockout: 5 wrong → 6th | API/UI | **PASS** — 5×401 then **429 `LOCKED_OUT`**; UI "Tài khoản tạm khóa… 15 phút." (F2) |
| EP5 | Suspended customer | DB+API | **PASS** — 401 `invalid_credentials` (uniform, no state leak) |
| R1 | Register (OTP peek → 201 → logged in) | API | **PASS** — 201, session |
| R2 | Duplicate email | API | **PASS** — 409 **`EMAIL_TAKEN`** → UI "Email đã được đăng ký." |
| R3 | Wrong OTP | API | **PASS** — 400 `invalid` → UI "Mã OTP không đúng." |
| S1 | Reload persists session + name | UI | **PASS** — account menu keeps the real name after hard reload (F1) |
| S2 | Logout → guest, `bb_rt` cleared | UI | **PASS** |
| S3 | Guest → `/account/bookings` redirect | UI | **PASS** — → `/auth/login?returnTo=…` |
| OP1 | Operator `PB-0001` → dashboard | UI | **PASS** |
| G1 | "Đăng nhập với Google" button renders | UI | **PASS** (flag on) |
| G2 | Button → real Google sign-in | UI | **PASS** — → `accounts.google.com/v3/signin`, real `client_id`, `redirect_uri=…localhost:3001/api/auth/google/callback`, PKCE S256, `scope=openid email profile`, `state` |
| G5 | Callback CSRF/error | UI | **PASS** — bad callback → `/auth/login?error=google` → "Đăng nhập Google thất bại. Thử lại." |
| G3 | Full consent → new Customer + Account (DS-033 L3) | USER+DB | **PASS** — real Google login (hackersieupham@gmail.com) created 1 `Account` (provider=google, providerAccountId=`102703…605` = Google `sub`, email) + 1 `Customer` (`passwordHash` NULL, `emailVerifiedAt` set); Account table has **no token columns** |
| G4 | Second Google sign-in → L1 idempotent (no dup Account) | USER+DB | **PASS** — after 2nd sign-in, still exactly **1** google `Account` + **1** `Customer` for that email (same `customerId`) — no duplicate (L1). Also covered by `linkGoogleAccount`/`googleCallback.int` tests |

Notes: EP4 (IP rate-limit → `RATE_LIMITED`) shares the 10/min per-IP window with the other login
scenarios; not run in this pass to avoid contaminating EP1/EP3 (behaviour is covered by unit tests). EP6
(delete → re-register frees the email) covered by `lib/account/__tests__/reregisterAfterDelete.int.test.ts`.

## Google end-to-end (G3/G4) — DONE (owner completed the consent; DB verified)

The Google login+consent can't be automated (no Google password; Google blocks automated sign-ins — the
owner's 2nd sign-in even hit Google's `g.co/sc` device-verification challenge, a Google-side risk check on
an unfamiliar browser, not an app issue). The owner completed it in their own browser; verified via `pg`:

- **G3 (new account, DS-033 L3):** 1 new `Customer` (`hackersieupham@gmail.com`, `passwordHash` NULL,
  `emailVerifiedAt` set) + 1 `Account` (`provider=google`, `providerAccountId=102703462223302511605`,
  `email`), and `Account` has only `id, customerId, provider, providerAccountId, email, createdAt,
  updatedAt` — **no access/refresh/id token columns** (ADR-008 / DS-033). **PASS.**
- **G4 (repeat sign-in, DS-033 L1):** after a 2nd Google sign-in, still exactly **1** google `Account` +
  **1** `Customer` for that email (same `customerId`, unchanged `createdAt`) — no duplicate. **PASS.**

Result: **16/16 scenarios PASS.**

## Evidence (screenshots, `.playwright-mcp/`)
- `g2-real-google-signin.png` (this run) · `google-button-login.png` · `google-button-register.png`
- `f1-name-persists-after-reload.png` · `f2-lockout-message.png` · `a3-email-taken-message.png`
- `a2-registered-loggedin.png` · `a13-operator-dashboard.png`
