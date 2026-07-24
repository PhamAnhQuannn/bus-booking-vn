# 05 — Edge Middleware (proxy.ts)

> Current-status snapshot of the Next.js 16 Edge proxy, covering auth guards,
> rate-limiting, CSRF enforcement, session tracking, and request-id propagation.

---

## 1. Overall Purpose

`proxy.ts` is the single Edge middleware file for the application. Next.js 16
renamed the concept from "middleware" to "proxy" — the exported function is
`proxy()` (not `middleware()`) and the file lives at the project root.

It runs on the Edge runtime before every matched request reaches a route handler
or server component. Because the Edge runtime cannot access the database (no
Node.js-only drivers like `pg`), all decisions are made from JWT claims, cookies,
and request metadata alone. JWT verification uses the `jose` library (Edge-safe
pure-JS implementation).

The proxy enforces five cross-cutting concerns in a layered pipeline:

| Layer | Concern |
|-------|---------|
| 0.5 | Customer accounts pause (soft-disable) |
| 1 | Operator auth guard (JWT redirect) |
| 1.5 | Admin auth guard (JWT redirect) |
| 2 | Rate-limit + CSRF double-submit |
| (cross-cutting) | Request-ID propagation, session cookie issuance |

Every response returned by the proxy (redirect, JSON error, or pass-through)
carries the `x-request-id` header for end-to-end correlation.

---

## 2. Matcher Configuration

```ts
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
```

**Matched:** Every request path except Next.js internal static assets
(`_next/static`, `_next/image`) and `favicon.ico`.

**Effect:** All page navigations, API calls, and server-component fetches pass
through the proxy. Static file serving is excluded for performance.

---

## 3. Layer 0.5 — Customer Accounts Pause

Added 2026-06-06 to soft-disable customer authentication while the product
operates in guest-only mode. The code is retained (not deleted) for re-enablement.

### Page routes — redirect to `/`

| Path pattern | Action |
|---|---|
| `/auth` or `/auth/*` | 302 redirect to `/` |
| `/account` or `/account/*` | 302 redirect to `/` |

### API routes — 410 Gone

| Path prefix | Response |
|---|---|
| `/api/auth/register*` | `{ error: 'customer_accounts_disabled' }` 410 |
| `/api/auth/otp*` | `{ error: 'customer_accounts_disabled' }` 410 |
| `/api/auth/forgot-password*` | `{ error: 'customer_accounts_disabled' }` 410 |
| `/api/auth/reset-password*` | `{ error: 'customer_accounts_disabled' }` 410 |
| `/api/auth/refresh*` | `{ error: 'customer_accounts_disabled' }` 410 |
| `/api/account*` | `{ error: 'customer_accounts_disabled' }` 410 |

**Not disabled:** `/api/auth/login` remains live because operator login shares
the same endpoint (the route itself returns 410 for the customer scope).

**To re-enable:** Delete this block and restore the navigation links (spec S04).

---

## 4. Layer 1 — Operator Auth Guard

**Scope:** All paths starting with `/op/` except those in the auth-API prefix
`/api/op/auth/`.

### Auth-free paths (exact-match Set)

```
/op/login
/op/first-login
/op/register
/op/register/confirmation
```

These four paths are accessible without a session. The allowlist uses an
exact-match `Set` (not `startsWith`), so a path like `/op/register-bypass`
is NOT treated as auth-free.

### JWT verification flow

1. Read the `bb_op_access` cookie value.
2. If absent -> redirect to `/op/login`.
3. Verify with `jose.jwtVerify()` using `JWT_OPERATOR_SECRET` (HS256).
   In test mode, falls back to `'b'.repeat(32)`.
4. Validate claims:
   - `scope` must equal `'operator'` (cross-realm guard).
   - `sub` must be a non-empty string.
   - `operatorId` must be a non-empty string (Issue 011: tokens without this
     claim are stale pre-Issue-011 mints and force re-login).
5. If verification fails or any claim is invalid -> redirect to `/op/login`.
6. If `requiresPasswordChange === true` in the JWT -> redirect to
   `/op/first-login` (forced password change on first login).

### Cookie

| Name | Value | Purpose |
|---|---|---|
| `bb_op_access` | HS256 JWT | Operator access token (15-min TTL) |

### JWT claims consumed

| Claim | Type | Purpose |
|---|---|---|
| `scope` | `'operator'` | Cross-realm guard: rejects customer/admin tokens |
| `sub` | string | Operator user ID |
| `operatorId` | string | Tenant ID (Issue 011) |
| `requiresPasswordChange` | boolean | Forces redirect to password-change page |

### Edge constraint

The `requiresPasswordChange` flag is encoded in the JWT claim itself (no DB read
needed). Stale-claim window equals the access token TTL (15 minutes). When the
operator changes their password, the route mints a fresh token with
`requiresPasswordChange: false` in the same transaction.

---

## 5. Layer 1.5 — Admin Auth Guard

**Scope:** Admin page routes only: path equals `/admin` or starts with
`/admin/`. API routes (`/api/admin/*`) are NOT guarded here; they enforce auth
via `requireAdminAuth` in-handler (DB-aware).

### Auth-free paths (exact-match Set)

```
/admin/login
```

Single entry. Exact-match `Set` (Issue 010 rule) prevents sneaky paths like
`/admin/login-bypass`.

### JWT verification flow

1. Read the `bb_admin_access` cookie value.
2. If absent -> redirect to `/admin/login`.
3. Verify with `jose.jwtVerify()` using `JWT_ADMIN_SECRET` (HS256).
   In test mode, falls back to `'c'.repeat(32)`.
4. Validate claims:
   - `scope` must equal `'admin'` (cross-realm guard: operator/customer tokens
     rejected).
   - `sub` must be a non-empty string.
   - `role` must be a non-empty string.
   - `totpVerified` must be strictly `true` (not truthy).
5. If verification fails, any claim is invalid, or `totpVerified` is not
   `true` -> redirect to `/admin/login`.

### Cookie

| Name | Value | Purpose |
|---|---|---|
| `bb_admin_access` | HS256 JWT | Admin access token |

### JWT claims consumed

| Claim | Type | Purpose |
|---|---|---|
| `scope` | `'admin'` | Cross-realm guard |
| `sub` | string | Admin user ID |
| `role` | string | Admin role (e.g. `'superadmin'`) |
| `totpVerified` | `true` | Must have completed the TOTP step |

---

## 6. Layer 2a — Rate-Limit

**Scope:** All non-safe-method (POST, PUT, PATCH, DELETE) requests to `/api/*`
paths, excluding webhook paths (see Section 11).

Rate-limiting runs FIRST in Layer 2 (before CSRF validation) because it is a
cheaper reject — no token comparison needed.

### Configuration

| Parameter | Value |
|---|---|
| Default limit | 60 requests per minute per IP |
| Window | 60,000 ms (1 minute) |
| Key | Client IP from `x-forwarded-for` first hop, fallback `127.0.0.1` |

### Backend selection (via `REDIS_PROVIDER` env var)

| `REDIS_PROVIDER` | Backend | Notes |
|---|---|---|
| `'ioredis'` | `IoRedisRatelimit` | Self-hosted Redis (TCP), Lua sliding window |
| `'upstash'` (or Upstash env vars set) | `UpstashRatelimit` | Vercel/serverless (HTTP REST) |
| unset / default | `InMemoryRatelimit` | Dev/CI (in-process Map, no external deps) |

The `InMemoryRatelimit` uses a fixed-window counter per identifier. The
`IoRedisRatelimit` uses an atomic INCR-first Lua script that eliminates the
GET-then-INCR TOCTOU race. The `UpstashRatelimit` delegates to the
`@upstash/ratelimit` sliding window algorithm.

Both Redis backends fail open on connection/eval errors (return `allowed: true`)
to avoid blocking traffic when Redis is down.

### Breach response

```
HTTP 429 Too Many Requests
Content-Type: application/json

{
  "error": "TOO_MANY_REQUESTS"
}

Headers:
  Retry-After: <seconds until window resets>
  X-RateLimit-Remaining: 0
  x-request-id: <correlation id>
```

The response shape matches the per-route rate limiters so clients see consistent
429 responses regardless of which layer rejects them.

### Scope notes

- The `/search` RSC path is NOT under `/api/*` and is not covered by this
  edge-level limiter. It retains its own per-route protection (Issue 001).
- Non-`/api/*` non-safe requests (e.g., server actions on app pages) pass
  through without rate-limiting.
- CSRF prefix-exempt routes (forgot-password, refresh) are still rate-limited.
  Only webhook exact-match exempt paths skip both gates.

---

## 7. Layer 2b — CSRF Double-Submit Enforcement

**Scope:** All non-safe-method requests to `/api/*` paths that pass the
rate-limit check and are not exempt.

### Mechanism

The double-submit cookie pattern:

1. On any safe-method (GET/HEAD/OPTIONS) request, if the `bb_csrf` cookie is
   absent, the proxy issues a fresh token (see Section 8).
2. Client-side JavaScript reads the `bb_csrf` cookie (it is non-HttpOnly) and
   sends it back as the `X-CSRF-Token` request header on state-changing requests.
3. The proxy reads both the cookie and the header and compares them using
   constant-time comparison (`crypto.timingSafeEqual` via `compareTokens()`).

### Token generation (`lib/auth/csrf.ts`)

`generateToken()` produces a 64-character lowercase hex string (32
cryptographically random bytes via `crypto.randomBytes`).

### Token comparison (`lib/auth/csrf.ts`)

`compareTokens(a, b)` performs constant-time comparison:
- Returns `false` immediately (no timing leak) if either value is empty or
  lengths differ.
- Converts both strings to `Buffer` (UTF-8) and uses `crypto.timingSafeEqual`.
- Catches any exception and returns `false`.

### Validation flow

```
if cookieToken is empty OR headerToken is empty OR !compareTokens(cookie, header):
    return 403 { error: 'csrf_invalid' }
```

### CSRF-exempt paths

**Exact-match exemptions** (skip BOTH CSRF and rate-limit):

| Path | Reason |
|---|---|
| `/api/payments/momo/webhook` | HMAC body verification |
| `/api/payments/zalopay/webhook` | HMAC body verification |
| `/api/payments/card/webhook` | HMAC body verification |
| `/api/payments/vnpay/webhook` | HMAC body verification |

**Prefix exemptions** (skip CSRF only, still rate-limited):

| Path prefix | Reason |
|---|---|
| `/api/op/auth/forgot-password` | Pre-auth; no session cookie available |
| `/api/op/auth/refresh` | Uses HttpOnly refresh cookie; no JS-readable CSRF token |
| `/api/admin/auth/refresh` | Uses HttpOnly refresh cookie; no JS-readable CSRF token |
| `/api/auth/forgot-password` | Customer forgot-password (pre-auth) |
| `/api/auth/reset-password` | Customer reset-password (pre-auth, proof-protected) |

**Not exempt:** Admin login + TOTP POST routes ride the `bb_csrf` double-submit
like operator login (the `/admin/login` GET issues the cookie via this layer).

### Rejection response

```
HTTP 403 Forbidden
Content-Type: application/json

{
  "error": "csrf_invalid"
}

Headers:
  x-request-id: <correlation id>
```

---

## 8. CSRF Cookie Issuance

The `bb_csrf` cookie is issued on safe-method (GET/HEAD/OPTIONS) requests when
the cookie is not already present.

### Cookie attributes

| Attribute | Value | Rationale |
|---|---|---|
| Name | `bb_csrf` | |
| Value | 64-char hex token | `generateToken()` from `lib/auth/csrf.ts` |
| `httpOnly` | `false` | Must be readable by client JS for double-submit |
| `sameSite` | `lax` | Standard CSRF protection baseline |
| `path` | `/` | Available site-wide |
| `secure` | `true` in production, `false` in dev | HTTPS-only in production |

The cookie is set via `NextResponse.cookies.set()` on the pass-through response.

---

## 9. Session ID Cookie (bb_sid)

An anonymous session identifier issued alongside the CSRF cookie on safe-method
requests when absent. Used for funnel tracking and analytics correlation; carries
no PII.

### Cookie attributes

| Attribute | Value | Rationale |
|---|---|---|
| Name | `bb_sid` | |
| Value | 64-char hex token | Same `generateToken()` as CSRF |
| `httpOnly` | `true` | Server-only; never read by client JS |
| `sameSite` | `lax` | |
| `path` | `/` | |
| `maxAge` | 31,536,000 (1 year) | Long-lived anonymous session |
| `secure` | `true` in production | |

Both `bb_csrf` and `bb_sid` are issued in the same response if both are missing.
If either (but not both) is missing, only the missing one is issued.

---

## 10. Request ID Propagation

Every request through the proxy gets a correlation ID via the `x-request-id`
header (Issue 061, AC2/AC3).

### Flow

1. `getOrCreateRequestId(request.headers)` checks for an existing
   `x-request-id` header. If present and non-empty, it is reused (supports
   upstream load-balancer injection). If absent, `crypto.randomUUID()` mints a
   fresh v4 UUID. `crypto.randomUUID()` is Edge-safe.
2. The ID is set on the forwarded request headers so downstream route handlers
   and server components can read it.
3. The ID is set on every response header (redirects, JSON errors, and
   pass-through `NextResponse.next()` responses alike).

### Helper functions in the proxy

- `nextWithRid()` — Creates a `NextResponse.next()` with the request-id
  forwarded on request headers and echoed on the response.
- `withRid(res)` — Stamps the request-id on an already-built response (redirect
  or JSON error) and returns it.

### Downstream usage

Route handlers can read the header and create a correlated logger:

```ts
import { getOrCreateRequestId, loggerForRequest } from '@/lib/observability/requestId';

const rid = getOrCreateRequestId(req.headers);
const log = loggerForRequest(rid); // pino child logger bound to { requestId }
```

---

## 11. Webhook Exemptions

Payment provider webhook paths are exempt from BOTH rate-limiting and CSRF
enforcement. A single exact-match `Set` (`CSRF_EXEMPT`) gates both exemptions
(no second exempt list).

### Exempt paths

| Path | Provider |
|---|---|
| `/api/payments/momo/webhook` | MoMo |
| `/api/payments/zalopay/webhook` | ZaloPay |
| `/api/payments/card/webhook` | Card gateway |
| `/api/payments/vnpay/webhook` | VNPay |

### Rationale

Webhooks authenticate via HMAC body verification at the route handler level.
They cannot carry CSRF cookies or headers (they originate from external payment
servers). They must not be edge-rate-limited because payment notifications are
time-sensitive and volume is controlled by the PSP, not the client.

### Exact-match enforcement

The exemption uses `Set.has(pathname)` (exact match), not prefix matching. A
path like `/api/payments/momo/webhook-fake` is NOT exempt.

---

## 12. Edge Runtime Constraints

The proxy runs in the Edge runtime, which imposes the following constraints:

| Constraint | How addressed |
|---|---|
| No database access | All auth decisions read JWT claims (no `prisma` calls) |
| No Node.js-only modules | JWT verification uses `jose` (pure JS, Edge-safe) |
| No `pg` / `ioredis` direct import | Rate-limit uses `InMemoryRatelimit` in dev; Upstash HTTP REST in prod (Edge-compatible) |
| Limited crypto API | `crypto.randomUUID()` is available; `crypto.randomBytes` + `crypto.timingSafeEqual` used in CSRF helpers (Node crypto, imported from `lib/auth/csrf.ts`) |
| No long-running processes | All operations are fast: JWT verify, Map lookup, string compare |

### JWT secrets

| Realm | Env var | Test fallback |
|---|---|---|
| Operator | `JWT_OPERATOR_SECRET` | `'b'.repeat(32)` |
| Admin | `JWT_ADMIN_SECRET` | `'c'.repeat(32)` |

Both use HS256 symmetric signing. The secret is encoded to `Uint8Array` via
`new TextEncoder().encode(raw)` for `jose.jwtVerify()`.

---

## Appendix: Complete Request Flow

```
Request arrives
  |
  v
[Matcher] -- _next/static, _next/image, favicon.ico --> bypass (no proxy)
  |
  v
[Request-ID] -- read or mint x-request-id, set on forwarded headers
  |
  v
[Layer 0.5] -- /auth/*, /account/* pages --> 302 to /
             -- /api/auth/{register,otp,forgot,reset,refresh,account}* --> 410
  |
  v
[Layer 1] -- /op/* (not /api/op/auth/*) --> check bb_op_access JWT
           -- no token or invalid --> 302 /op/login
           -- requiresPasswordChange --> 302 /op/first-login
  |
  v
[Layer 1.5] -- /admin, /admin/* (not /admin/login) --> check bb_admin_access JWT
              -- no token, invalid, or !totpVerified --> 302 /admin/login
  |
  v
[Safe method?] -- GET/HEAD/OPTIONS --> issue bb_csrf + bb_sid if missing --> pass
  |
  v
[Webhook exempt?] -- exact-match Set --> pass (skip rate-limit + CSRF)
  |
  v
[Is /api/*?] -- no --> pass (non-API state-changing requests not gated)
  |
  v
[Rate-limit] -- 60/min/IP --> 429 + Retry-After on breach
  |
  v
[CSRF prefix exempt?] -- forgot-password, refresh prefixes --> pass (CSRF-only skip)
  |
  v
[CSRF validate] -- compare bb_csrf cookie vs X-CSRF-Token header
                 -- mismatch or missing --> 403 { error: 'csrf_invalid' }
  |
  v
[Pass through] --> NextResponse.next() with forwarded headers + x-request-id
```

---

## Appendix: Cookie Summary

| Cookie | Purpose | HttpOnly | SameSite | MaxAge | Secure (prod) |
|---|---|---|---|---|---|
| `bb_op_access` | Operator JWT access token | yes (set by auth route) | lax | 15 min (JWT exp) | yes |
| `bb_admin_access` | Admin JWT access token | yes (set by auth route) | lax | JWT exp | yes |
| `bb_csrf` | CSRF double-submit token | **no** (must be JS-readable) | lax | session | yes |
| `bb_sid` | Anonymous session / funnel tracking | yes | lax | 1 year | yes |

---

## Appendix: Header Summary

| Header | Direction | Purpose |
|---|---|---|
| `x-request-id` | Request (forwarded) + Response | Correlation ID for logs/tracing |
| `X-CSRF-Token` | Request (client-set) | CSRF double-submit proof |
| `x-forwarded-for` | Request (read) | Client IP for rate-limit keying |
| `Retry-After` | Response (429 only) | Seconds until rate-limit window resets |
| `X-RateLimit-Remaining` | Response (429 only) | Always `0` on breach |
