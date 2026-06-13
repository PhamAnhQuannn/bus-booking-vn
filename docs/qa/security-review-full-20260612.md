# Security Review — Full Codebase

**Date:** 2026-06-12 | **Scope:** All production code on `master` | **Method:** 4-agent parallel scan + 2-agent false-positive verification

## Findings

### Vuln 1: Authentication Bypass on All Cron Endpoints — `app/api/cron/*/route.ts`

* **Severity:** HIGH
* **Confidence:** 0.9
* **Category:** `authentication_bypass`

* **Description:** All 11 `/api/cron/*` route handlers use a failing-open authentication pattern:
  ```typescript
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  ```
  When `CRON_SECRET` is not set (undefined/empty), `cronSecret` is falsy, the entire `if` block is skipped, and the endpoint executes without authentication. The `CRON_SECRET` variable is **not in the Zod env schema** (`lib/config/env.ts`) — there is no startup validation, no `.min()` constraint, and no fail-fast behavior. The proxy middleware (`proxy.ts`) provides rate-limiting but no authentication gate for `/api/cron/*` paths.

* **Affected endpoints (all 11):**
  - `app/api/cron/process-payouts/route.ts:25` — triggers operator payouts (financial)
  - `app/api/cron/reconcile-payments/route.ts:36` — modifies payment reconciliation state
  - `app/api/cron/retention/route.ts` — deletes/anonymizes user PII data
  - `app/api/cron/complete-trips/route.ts:25` — marks trips complete (triggers payout pipeline)
  - `app/api/cron/sweep-holds/route.ts:28` — expires active seat holds
  - `app/api/cron/generate-trips/route.ts:31` — creates recurring trips
  - `app/api/cron/close-sales/route.ts:24` — closes trip sales
  - `app/api/cron/charter-expiry/route.ts:32` — expires charter requests
  - `app/api/cron/dispatch-notifications/route.ts:31` — dispatches SMS/email
  - `app/api/cron/send-reminders/route.ts:24` — sends reminder notifications
  - `app/api/cron/generate-ticket-pdfs/route.ts:35` — batch PDF generation

* **Corroborating evidence:** Unit test at `app/api/cron/process-payouts/__tests__/route.test.ts:51-54` explicitly documents the failing-open behavior:
  ```typescript
  it('allows access when CRON_SECRET is not set (no auth required)', async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
  });
  ```

* **Exploit Scenario:** Attacker discovers a deployment where `CRON_SECRET` was never configured (self-hosted, non-Vercel, or misconfigured Vercel). Attacker sends `GET /api/cron/process-payouts` with no `Authorization` header. The payout sweep runs, potentially triggering financial disbursements. Similarly, `GET /api/cron/retention` could delete user data, and `GET /api/cron/complete-trips` could prematurely complete trips (triggering the payout pipeline for trips still in progress).

* **Recommendation:** Change all cron handlers from `if (cronSecret && ...)` to `if (!cronSecret || authHeader !== ...)`:
  ```typescript
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  ```
  Additionally, add `CRON_SECRET` to the Zod schema in `lib/config/env.ts` as a required field with `.min(16)` so the application fails at startup if the variable is missing — matching the existing pattern for `HOLD_SECRET`.

---

## Investigated and Cleared

The following areas were audited and found secure:

| Area | Files | Verdict |
|------|-------|---------|
| **JWT verification** | `lib/auth/jwt.ts` | HS256, strict scope claim validation, proper expiry. No bypass paths. |
| **CSRF double-submit** | `proxy.ts`, `lib/auth/csrf.ts` | Constant-time comparison, proper exemptions (webhooks), exact-match path allowlists. |
| **Operator login timing** | `lib/auth/operatorAuthService.ts` | `dummyVerify()` called for missing/disabled users — timing equalized. NOT vulnerable. |
| **Admin login timing** | `lib/auth/adminAuthService.ts` | Dummy hash verification on missing/disabled users. Timing-safe. |
| **Refresh token rotation** | `lib/auth/refreshToken.ts`, `lib/auth/operatorSession.ts`, `lib/auth/adminSession.ts` | Family reuse detection, SHA-256 hash storage, constant-time HMAC verification. |
| **TOTP implementation** | `lib/auth/totp.ts`, `lib/auth/adminTotp.ts` | 160-bit secret, RFC 6238 compliant, constant-time comparison, enrollment gate. |
| **OTP generation** | `lib/auth/otp.ts`, `lib/auth/operatorOtp.ts` | `crypto.randomInt()` (not Math.random), SHA-256 hash storage, lockout sentinel. |
| **SQL injection** | All `$queryRaw` / `$executeRaw` sites | All use Prisma.sql tagged templates with parameterized values. No unsafe interpolation. |
| **XSS** | 3 `dangerouslySetInnerHTML` sites | All JSON-LD structured data from controlled functions — no user HTML. |
| **Webhook HMAC** | `lib/payment/adapters/momo.ts` | Signature verified BEFORE any processing, constant-time comparison, replay blocked by unique constraint. |
| **Tenant isolation** | All `/api/op/*` routes | `operatorId` from JWT claim, never from request body. `withOperatorScope()` utility enforces DB-level scoping. |
| **Admin RBAC** | All `/api/admin/*` routes | Role-based gates, step-up auth for finance ops, exact-match path allowlists. |
| **Customer IDOR** | `/api/bookings/*`, `/api/account/*` | All queries scoped to `customerId` from JWT. Non-owned resources return 404 (not 403). |
| **Cron middleware** | `proxy.ts` | Rate-limited but no auth gate — relies on handler-level CRON_SECRET check (which has the vuln above). |
| **Cookie flags** | All Set-Cookie sites | HttpOnly, Secure (prod), SameSite=lax/strict as appropriate. No sensitive data in non-HttpOnly cookies except CSRF token (by design). |
| **Password hashing** | `lib/auth/password.ts` | scrypt with N=16384, r=8, p=1, 64-byte key, 16-byte random salt. Argon2id optional upgrade path. |
| **Path traversal** | `lib/storage/storage.ts` | `sanitizeKeyHint()` strips traversal chars, keys are server-generated UUIDs. |
| **Command injection** | Full codebase grep | No `exec`/`spawn`/`child_process` in production code. |
| **SSRF** | All fetch/http calls | All URLs from env config or hardcoded endpoints — no user-controlled URLs. |
| **Deserialization** | All JSON.parse sites | Wrapped in try-catch, no eval/Function usage. |
| **Hold cookie** | `lib/security/holdCookie.ts` | HMAC-SHA256 signed, constant-time verification, 12-min TTL. |
| **Price tampering** | `/api/holds/route.ts`, `lib/booking/bookingRepo.ts` | Price read from Trip DB row, never from request body. Capacity enforced via advisory lock. |

## Summary

| Severity | Count | Description |
|----------|-------|-------------|
| **HIGH** | 1 | CRON_SECRET failing-open auth bypass (11 endpoints) |
| **MEDIUM** | 0 | — |
| **LOW** | 0 | — |

**Overall security posture: STRONG.** The codebase demonstrates mature security practices — constant-time comparisons throughout, proper tenant isolation, timing-attack mitigations, and defense-in-depth on payment flows. The single HIGH finding is a configuration-gating bug (fail-open vs fail-closed), not a fundamental design flaw.
