OBSERVABILITY REVIEW — PR #259 "feat(auth): migrate OTP to email + enable customer auth (#168, #169, #170)"
──────────────────────────────────────────────────────────────────────────────────────────────────────────
PR:        https://github.com/PhamAnhQuannn/bus-booking-vn/pull/259
Base/Head: master ← feat/customer-auth-enable @ 026729fb
Decision:  (none — no review yet)
Size:      +1368 / -779 across 60 files
Generated: 2026-07-07T00:00:00Z

Project conventions detected:
  logger:  `logger.info({...}, 'msg')` / `.warn` / `.error` — pino instance from `@/lib/logger`
           (or the request-scoped `loggerForRequest(getOrCreateRequestId(req.headers))` from
           `@/lib/observability`, e.g. `app/api/holds/route.ts`). All 500s additionally funnel
           through `withErrorHandler` (`@/lib/withErrorHandler`), which does a generic
           `logger.error({...}, 'Unhandled handler error')` on any uncaught throw.
  tracer:  none detected anywhere in first-party code (no `startSpan`/`withSpan`/OTel usage
           project-wide — Cat 2 findings below are advisory, not a regression this PR introduces).
  metrics: none detected (no `metrics.inc`/`counter.inc`/statsd anywhere) — Cat 4 does not apply.
  client:  `@/lib/observability/sentry.ts` (`captureException`/`captureMessage`) is the project's
           only error-telemetry seam, but it imports `@/lib/logger` (pino) + `@/lib/config`
           (server-only) — it is NOT client-safe and cannot be used from `'use client'` code per
           the AGENTS.md "operator-smoke" client-boundary rule. The project currently has **no**
           client-safe error-telemetry helper at all.

Findings: 10  (P1: 3 · P2: 4 · P3: 3)

P1 — BLOCKING:
  app/api/auth/login/route.ts:32-135  🔇 P1: New customer-login branch (lines 104-134, previously
    the branch just returned 410 `customer_login_disabled`) wires a live HTTP endpoint to
    `login()` with zero logger/span/metric calls anywhere in the handler — not on entry, not on
    the invalid-credentials catch (lines 112-120), not on success. Contrast with the established
    convention in `app/api/holds/route.ts` (`loggerForRequest` + `logger.info`/`.warn` on every
    branch). Customer sign-in — arguably the highest-value new auth surface in this PR — is
    completely dark: an incident (credential-stuffing burst, silent login failures) leaves no
    trace beyond the generic `withErrorHandler` 500 log, which only fires on truly unhandled
    exceptions, not on the `INVALID_CREDENTIALS` branch that returns 401.
    Fix: add `const logger = loggerForRequest(getOrCreateRequestId(req.headers))` at handler
    entry; `logger.warn({ scope }, 'login.invalid_credentials')` in the catch; `logger.info({
    scope, customerId: result.customer.id }, 'login.success')` before the 200 response. (Never
    log the raw email/password — `email`/`password` are not yet redact-listed at top level, see
    P3 note below.)

  lib/auth/clientSession.ts:117-136 (catch at 131-132)  🔇 P1: `attemptRefresh()` — the
    single-flight token-refresh helper backing every authenticated client fetch — swallows any
    fetch/JSON error with `catch { return null; }` and a code comment only. No `console.error`,
    no telemetry call of any kind. This is new code (Issue 168/170) and the exact "client session"
    surface this review was asked to focus on: a broken refresh (network blip, malformed JSON,
    CORS misconfig) silently degrades every signed-in user to logged-out with zero forensic
    trail — oncall has no way to distinguish "browser network hiccup" from "refresh endpoint is
    down for everyone."
    Fix: at minimum `console.error('[auth] refresh failed', err)` until a client-safe telemetry
    seam exists (see conventions note above); ideally introduce one (e.g. a `navigator.sendBeacon`
    or `fetch('/api/client-errors', {keepalive:true})` POST that server-side calls the existing
    `captureException`) and call it here.

  components/auth/CustomerAccountMenu.tsx:19-27 (catch at 25-27)  🔇 P1: `handleLogout()` —
    `catch { // best-effort }` is an empty catch block (comment only), the literal Cat-3 P1
    pattern. The logout POST failing is swallowed entirely; the UI still clears local session
    state and redirects regardless, so a broken server-side session revoke (stale refresh token
    left valid server-side) is completely invisible.
    Fix: same as above — at minimum `console.error`, ideally route through a client-safe
    telemetry seam once one exists.

P2 — SHOULD FIX:
  app/api/auth/register/route.ts:50-57  ⚠️ P2: catch on `AuthServiceError('EMAIL_TAKEN')` returns
    409 with no log (pre-existing pattern, carried over verbatim from the phone-based version —
    was `PHONE_TAKEN`). Not a new gap, but registration is now a live customer-facing flow for
    the first time via email; a spike in EMAIL_TAKEN (e.g. enumeration probing) is invisible.
    Fix: `logger.info({ scope: 'register' }, 'register.email_taken')` before the return.

  lib/auth/sendOtp.ts:70-76  ⚠️ P2: `await sendEmail({...})` — the `SendEmailResult` (`{ ok,
    externalRef?, error? }`) is discarded entirely; `sendOtp()` unconditionally returns
    `{ ok: true }` even when the Resend call failed. `sendEmail()` itself logs the failure
    (`email.resend.api-error` / `email.resend.exception` in `lib/notification/email.ts:149,155`),
    so the raw error isn't fully silent, but there is no `otp.send.email-failed`-shaped log at
    the OTP-orchestration layer to correlate "this OTP-send request" with "the email delivery
    that backed it failed" — and functionally the caller (the API route, and thus the customer)
    is told success when delivery failed.
    Fix: `const emailResult = await sendEmail({...}); if (!emailResult.ok) { logger.warn({ email
    }, 'otp.send.email_failed'); }` (redact/hash the email before logging).

  lib/account/customerOtp.ts:102-108  ⚠️ P2: identical pattern to the sendOtp.ts finding above —
    `sendCustomerAccountOtp()` (forgot-password OTP) also discards `sendEmail()`'s result and
    always returns `{ ok: true }`.
    Fix: same as above.

  lib/account/resetPassword.ts (whole file, no logger import)  ⚠️ P2: `resetPassword()` hashes a
    new password and revokes ALL sessions for the customer (lines 47-57) — a security-sensitive
    state transition — with zero audit-style logging. Session-reuse/step-up-adjacent events like
    this are exactly what oncall needs a trail for when a customer disputes "I didn't reset my
    password."
    Fix: `logger.info({ customerId: customer.id }, 'password.reset.success')` after the
    transaction commits.

P3 — ADVISORY:
  lib/notification/email.ts (sendViaResend, called from the new email-OTP hot path)  📡 P3: the
    outbound Resend HTTP call has no span wrapper — consistent with the rest of the codebase
    (no tracer convention exists anywhere), so this is not a regression, just a note that OTP
    email delivery latency/failures are only log-visible, not trace-visible, should the project
    adopt tracing later.

  lib/auth/clientSession.ts:43-50 `decodeExp()`  📡 P3: `catch { return null; }` on JWT payload
    parse — low severity (expected fallback for a malformed/absent `exp` claim, not a delivery or
    auth-decision failure), but silent. Consider at least a `console.debug` if this ever fires
    unexpectedly in practice, since it would explain "proactive refresh never fires" symptoms.

  lib/logger.ts redact list  📊 P3: this PR introduces top-level `email` as a primary identifier
    across the auth surface (OTP send/verify, login, register, forgot-password bodies), but the
    pino redact list (`lib/logger.ts:59-107`) only covers `customerEmail` / `buyerEmail`, not a
    bare top-level `email` key. No current log call in this PR logs raw `email` (all findings
    above recommend NEW log lines), so nothing leaks today — but the moment any of the P1/P2 fixes
    above are implemented with a naive `logger.info({ email }, ...)`, it will leak plaintext email
    PII into logs. Add `'email'` to the redact `paths` array in the same commit that adds the
    first `email`-bearing log call in this domain.

RECOMMENDED NEXT:
  - Address the 3 P1s before merge — the new customer-login branch and the new client-session
    code are both currently unobservable in production.
  - Fold the `email` redact-list addition into whichever commit adds the first auth-domain log
    call, to avoid a PII-leak follow-up.
  - If reviewer already requested changes: /pr-feedback-route 259

SUMMARY: 3 P1 · 4 P2 · 3 P3 · pinned to 026729fb
