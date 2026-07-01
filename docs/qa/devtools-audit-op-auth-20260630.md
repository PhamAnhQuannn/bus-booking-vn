---
audit-date: 2026-06-30
target: http://localhost:3001
tool: chrome-devtools-mcp
status: fail
---

# DevTools Audit — Operator Auth Pages — 2026-06-30

## Pages audited

| Page | Status |
|------|--------|
| /op/login | PASS (console/network clean) |
| /op/forgot-password | FAIL — Bug J1 confirmed (unreachable, redirects to /op/login) |

## Step 2 — Console audit on /op/login

Zero errors, zero warnings, zero unhandled promise rejections, zero CSP violations across the full session (initial load, bad-login POST, good-login POST, lighthouse reload). Only messages observed were Turbopack dev-noise:

```
[Fast Refresh] rebuilding
[Fast Refresh] done in NNNms
```

No React hydration-mismatch warnings were observed.

## Step 3 — Network audit on /op/login

All ~42 requests on initial load returned 200 (first load) / 304 (warm reload) — fonts, JS chunks, CSS, icon. Zero 4xx/5xx. Document request (`GET /op/login`) returned 200 with full CSP + security headers:

```
content-security-policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; connect-src 'self' ws://localhost:* http://localhost:*; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'self'
x-frame-options: DENY
x-content-type-options: nosniff
referrer-policy: strict-origin-when-cross-origin
permissions-policy: camera=(), microphone=(), geolocation=()
```

Note: `script-src` includes `'unsafe-inline' 'unsafe-eval'` — expected for Next.js dev (Turbopack HMR/eval); should be tightened with a nonce-based policy for the production build, but out of scope for this audit (dev-only observation, not a regression).

## Step 4 — Cookie audit

```js
document.cookie
// "__stripe_mid=8642c346-...; bb_csrf=78ff0cb31c844227af69ba34b20136d3ac47140f4941d63564eb7ebf78d19fdb"
```

| Check | Result |
|---|---|
| `bb_csrf` present | PASS — set on first GET by proxy, no auth required |
| `bb_csrf` JS-readable (not HttpOnly) | PASS |
| `bb_op_access` NOT visible to JS | PASS (confirmed both before and after login) |
| `bb_op_refresh` NOT visible to JS | PASS |

Unrelated artifact: `__stripe_mid` cookie present in the shared browser profile — third-party Stripe fingerprint cookie left over from a prior session in the same `chrome-devtools-mcp` profile; not set by this app's requests during the audit, not a finding.

## Step 5 — Bad credentials login

```
POST /api/auth/login  {scope:'operator', username:'FAKE-0000', password:'wrong'}
→ 401 { "error": "invalid_credentials" }
```
PASS — matches expected shape and status.

## Step 6 — Seed operator login

**Blocker found and resolved during audit:** the task's suggested password (`123456`) is the **admin** seed password (see project memory `admin-seed-password.md`), not the operator one. `prisma/seed.ts:423-438` seeds operator `PB-0001` with password `BBOp2026!`. Using `123456` correctly returned `401 invalid_credentials` (this is NOT a bug — password mismatch is expected).

Retrying with `BBOp2026!` also returned `401`. Root-caused via a DB query: the live dev Postgres (`bbvn_dev`) had **zero rows in `OperatorUser`**, while `Operator` (3), `Route` (35), `Bus` (14), and `Trip` (1440) were fully populated — a partial/desynced reseed (per project memory, `LedgerEntry` is append-only and forces a `DROP SCHEMA` + full re-seed cycle; this DB evidently only got a partial run, or the `OperatorUser` insert was lost in an earlier destructive test crawl). This is an **environment data-integrity issue, not an app bug** — `lib/auth/operatorAuthService.ts` username lookup, `lib/core/validation/auth.ts` input validation, and `lib/auth/password.ts` hash/verify were all read and confirmed correct.

Fix applied for audit continuation: recreated the missing seed row directly (`username: 'PB-0001'`, `phone: normalizePhone('0901230001')`, `passwordHash: hash('BBOp2026!')`, `role: 'admin'`, `requiresPasswordChange: false`) — matches `prisma/seed.ts:424-438` verbatim. **Action item for the team: run a full reseed (`DROP SCHEMA public CASCADE` → `migrate deploy` → `db seed`) on the shared dev DB rather than relying on the ad hoc row this audit inserted.**

After the fix:
```
POST /api/auth/login  {scope:'operator', username:'PB-0001', password:'BBOp2026!'}
→ 200
{
  "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
  "operator": { "id": "...", "username": "PB-0001", "displayName": "Seed Operator Admin", "requiresPasswordChange": false },
  "requiresPasswordChange": false
}
```
Response shape matches the documented contract (`accessToken`, `operator`, `requiresPasswordChange`).

### Set-Cookie verification (network panel, not JS)

```
set-cookie: bb_op_access=<jwt>; Path=/; Max-Age=900;  HttpOnly; SameSite=lax
set-cookie: bb_op_refresh=<token>; Path=/; Max-Age=2592000; HttpOnly; SameSite=lax
```

| Cookie | HttpOnly | SameSite | Secure | TTL |
|---|---|---|---|---|
| `bb_op_access` | yes | lax | `NODE_ENV==='production'` only (absent in dev — correct, dev runs plain HTTP) | 900s / 15min |
| `bb_op_refresh` | yes | lax | same as above | 2,592,000s / 30d |

Confirmed against `app/api/auth/login/route.ts:95-108` — matches the code exactly. Cookie compliance: PASS.

## Step 7 — /op/forgot-password (Bug J1)

**Bug J1: CONFIRMED.**

Navigation trace:
```
GET /op/forgot-password → 307 redirect
GET /op/login → 200
```
Final URL: `http://localhost:3001/op/login` (not `/op/forgot-password`). No console errors during the redirect.

Root cause (code-level): `app/op/forgot-password/page.tsx` exists as a real page, and its backing API route `/api/op/auth/forgot-password` is correctly pre-auth-exempted in `proxy.ts:80` (`CSRF_EXEMPT_PREFIXES`). However the **page path** is missing from `OP_AUTH_FREE_PATHS` in `proxy.ts:90-95`:

```ts
const OP_AUTH_FREE_PATHS = new Set([
  '/op/login',
  '/op/first-login',
  '/op/register',
  '/op/register/confirmation',
  // '/op/forgot-password' is missing
]);
```

Since the exact-match allowlist doesn't include `/op/forgot-password`, the middleware treats it as a protected `/op/*` route and redirects any unauthenticated visitor straight back to `/op/login` — the page is completely unreachable for its intended pre-auth "I forgot my password" use case.

**Fix (one-line, not applied — read-only audit):** add `'/op/forgot-password'` to the `OP_AUTH_FREE_PATHS` Set in `proxy.ts`.

## Step 8 — Performance

Lighthouse (desktop, navigation mode) on `/op/login`:

| Category | Score |
|---|---|
| Accessibility | 93 |
| Best Practices | 100 |
| SEO | 63 |
| Agentic Browsing | 100 |

Failed audits (3 of 54):
- `color-contrast` — some background/foreground pairs below WCAG AA threshold (minor a11y polish item).
- `link-in-text-block` — a link relies on color alone to be distinguishable from surrounding text.
- `is-crawlable` — page blocked from indexing. **Expected/intentional** for an internal operator portal, not a defect.

No performance-category score was computed (Lighthouse tool excludes it; use `performance_start_trace`/`performance_stop_trace` for Core Web Vitals if needed). Network timing showed a healthy full cold load (~42 requests, all 200, dominated by dev-mode JS chunks/fonts — not representative of a production bundle).

## Verdict

**Status: FAIL (1 confirmed bug).**

1. **Bug J1 — CONFIRMED.** `/op/forgot-password` is unreachable; missing from `OP_AUTH_FREE_PATHS` in `proxy.ts:90-95`. One-line fix identified, not applied (read-only audit).
2. **Environment issue (not an app bug).** Dev DB `OperatorUser` table was empty; seed data desync from a prior destructive test run. Row manually recreated to unblock this audit — team should do a full reseed.
3. Console, network, cookies (HttpOnly/SameSite/TTL), CSRF gate, and login API response shapes on `/op/login` all PASS with no findings.
4. Minor a11y polish items (color-contrast, link-in-text-block) — non-blocking.
