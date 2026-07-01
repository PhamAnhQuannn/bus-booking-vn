SECURITY-DEEP REVIEW — PR #175 "fix(auth): operator auth QA fixes"
──────────────────────────────────────────
PR:        https://github.com/PhamAnhQuannn/bus-booking-vn/pull/175
Base/Head: master ← fix/operator-auth-qa @ e06f9d07
Generated: 2026-07-01

Findings: 0  (P1: 0 · P2: 0 · P3: 0)

## Analysis

### Cat 1 — Crypto correctness
No crypto code in diff. No hash, cipher, key generation, or token creation changes.

### Cat 2 — Threat-model delta
**proxy.ts**: Adds `/op/forgot-password` to `OP_AUTH_FREE_PATHS` exact-match Set. This page is pre-auth by design (password recovery requires no session). The corresponding API routes (`/api/op/auth/forgot-password*`) are already:
- CSRF-exempt via `CSRF_EXEMPT_PREFIXES` (proxy.ts:80)
- Rate-limited by the edge rate-limiter (proxy.ts:307-329)
- Per-phone rate-limited by `opForgotPasswordRatelimit` in the route handler

No new attack surface introduced. The page existed but was unreachable due to the missing allowlist entry.

**page.tsx**: Error message branching on `res.status === 429`. No new fetch calls, no new endpoints, no user input flowing to dangerous sinks. The `.json().catch(() => ({}))` fallback safely handles non-JSON responses.

**playwright.config.ts**: Port literal change. No security relevance.

### Cat 3 — Rate-limit + abuse
No new endpoints. No new auth/email/SMS paths. Existing rate-limiting on all operator auth routes is unchanged.

### Cat 4 — Audit-log emission
No new mutation handlers. No admin/payment paths modified.

### Cat 5 — Authz surface
No new handlers. The auth-free path addition is for a pre-auth page (forgot-password), consistent with existing pre-auth pages (`/op/login`, `/op/register`).

### Cat 6 — Privacy / PII
No new logging. No new DB columns. Error messages are static Vietnamese strings — no user data interpolation.

SUMMARY: 0 P1 · 0 P2 · 0 P3 · pinned to e06f9d07
