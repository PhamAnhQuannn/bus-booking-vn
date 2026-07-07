CODE REVIEW — PR #259 "feat(auth): migrate OTP to email + enable customer auth (#168, #169, #170)" @ 026729fb
────────────────────────────────
Diff scope: 60 files, +1368 / -779 lines

PRIORITY 1 — Block push, fix first:

  [CORRECTNESS / AUTH] lib/account/customerOtp.ts (whole file) + app/api/account/phone/init/route.ts:38 + confirm/route.ts:47
    Phone-change flow calls sendCustomerAccountOtp(newPhone) and verifyCustomerAccountOtp(newPhone)
    but OTP migration rewrote both functions to email-only (WHERE email=, sendEmail()).
    Passing a phone number as the email argument → Resend rejects invalid recipient → phone-change
    feature is silently broken. Masked in dev by NOTIFY_STUB=true.
    Fix: either (a) give phone-change its own send/verify pair keyed on OtpAttempt.phone + sendSms,
    or (b) branch sendCustomerAccountOtp/verifyCustomerAccountOtp on explicit channel param.
    Scope: this is a pre-existing regression from commit a354843 (OTP migration), not from the
    auth-enable commit. Can be addressed as follow-up issue if phone-change is not in launch scope.

  [SECURITY / AUTHZ] app/api/auth/login/route.ts (customer branch, lines 104-134)
    Customer login has no per-email account lockout. Operator branch has opLoginRatelimit (per-IP)
    + opLoginLockout (per-username). Customer branch relies solely on proxy Layer 2 generic per-IP
    rate limit. Distributed credential stuffing against one email is unthrottled.
    Fix: add customerLoginLockout mirroring opLoginLockout, keyed on normalized email.
    Scope: follow-up issue — customer login was always this way, PR only re-exposes it.

  [TEST / RISK PATH] lib/account/resetPassword.ts — zero test coverage
    Unauthenticated security-critical endpoint (OTP-proof verification, password-reuse check,
    session revocation). This PR changed core lookup (phone→email) with no safety net.
    No unit test, no integration test, no route test for app/api/auth/reset-password/route.ts.
    Fix: add resetPassword.int.test.ts + route.test.ts covering happy path + INVALID_PROOF
    + CUSTOMER_NOT_FOUND + PASSWORD_REUSED + session revocation.

  [TEST / RISK PATH] app/api/auth/otp/verify/__tests__/route.test.ts
    Route maps status='attempt_cap' → 429, but test only exercises 'ok', 'gone', 'mismatch'.
    Fix: add test for 429 attempt_cap branch.

PRIORITY 2 — Fix before merge:

  [FAILURE MODE] lib/auth/clientSession.ts:117-136 (attemptRefresh)
    Any non-2xx response from POST /api/auth/refresh clears session — including transient 500s.
    Only 401 (invalid/reused token) should trigger clearSession(). Other errors should leave
    session intact and let caller retry.
    Fix: check res.status === 401 specifically before clearSession().

  [TEST / NON-RISK] lib/booking/attachGuestBookingByPhone.ts — backfillGuestBookingsByEmail untested
    New function wired into register() but no test asserts the where:{buyerEmail, customerId:null}
    predicate. A broken predicate would pass silently.
    Fix: add describe('backfillGuestBookingsByEmail') block + positive toHaveBeenCalledWith assertion.

  [TEST / NON-RISK] lib/account/customerOtp.ts — sendCustomerAccountOtp rate_limited branch untested
    3-per-15-min limiter never exercised in integration tests.
    Fix: add int test calling forgotPassword() 4x, assert 4th returns retryAfter.

  [SCOPE] .env.example + lib/config/env.ts — VietQR bank detail changes (Agribank→Sacombank)
    Unrelated to auth. Non-blocking since .env.local overrides.

PRIORITY 3 — Address when convenient:

  [READABILITY] lib/ticketing/ticketToken.ts:10-13 + lib/config/env.ts:248-251
    Doc comments say fallback is 't'.repeat(32) gated on NODE_ENV=test. Code actually falls
    back in dev too with 'tk'.repeat(16). Stale comments misrepresent security posture.

  [HYGIENE] app/(customer)/auth/forgot-password/page.tsx:103
    snake_case `code_err` in otherwise camelCase file. Reset-password page uses `errCode`.

  [READABILITY] lib/auth/types.ts — dead LoginCustomerSchema/LoginOperatorSchema exports
    Pre-existing, not introduced by this PR. Login now validates via lib/core/validation/auth.ts.

  [READABILITY] app/api/auth/register/route.ts:53-54
    EMAIL_TAKEN (409) returns {error:'invalid_credentials'} — same string as login 401.
    Consider distinct 'email_taken' error code.

  [CORRECTNESS / STYLE] lib/auth/otp.ts consume() vs lib/account/customerOtp.ts verifyCustomerAccountOtp()
    Two parallel OTP-verify implementations with inconsistent brute-force thresholds (5 vs 3).
    Maintenance smell — consolidation opportunity.

  [CORRECTNESS / STYLE] lib/auth/sendOtp.ts:43
    crypto.randomUUID() called without explicit crypto import. Works via globalThis.crypto but
    inconsistent with sibling file's explicit import.

SUMMARY: 4 P1, 4 P2, 6 P3

NOTE ON P1 SCOPING:
  - Phone-change break: pre-existing regression from OTP migration, not auth-enable. Can be
    follow-up if phone-change is not in Phase 1 launch scope.
  - Customer login lockout: customer login was always this way. PR re-exposes it. Follow-up issue.
  - resetPassword test gap: existed before PR but PR changed the code with no test. Should fix.
  - OTP verify attempt_cap: missing test branch. Should fix.

RECOMMENDED NEXT STEPS:
  → Assess P1 scope: phone-change + login-lockout may be follow-up issues (not blocking this PR)
  → Fix resetPassword test gap + OTP verify attempt_cap test before merge
  → P2 attemptRefresh fix is important but can ride as follow-up
