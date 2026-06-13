---
depends-on: [096-edge-rate-limit-middleware]
type: BUG
wave: 0.5
spec: [S14]
---

## Parent PRD

`issues/prd.md` · spec `rebuild-plan.md` [S14] — rate-limit infrastructure gap identified by
grill-me self-assessment

## What to fix

`lib/ratelimit/index.ts` silently falls back to `InMemoryRatelimit` when Upstash env vars
(`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) are unset. On Vercel serverless, each
function instance has its own memory — rate limits are NOT shared across instances. An attacker
rotating across instances bypasses the 60 req/min/IP limit entirely.

This is invisible: no log, no warning, no startup error. A production deploy without Upstash
config silently runs with no effective rate limiting.

### Fix

1. Add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to `lib/config/env.ts` as
   optional with a `superRefine` that emits a **startup warning** (not error) when both are
   unset in non-test environments: `logger.warn('Rate limiting using in-memory fallback — not shared across serverless instances')`.
2. In production (`NODE_ENV === 'production'`), make both REQUIRED — fail fast at boot. The
   in-memory fallback is acceptable only for dev/test.
3. Document the requirement in `docs/ops/go-live-runbook.md` (Issue 119).

## Acceptance criteria

- [ ] Production startup fails if `UPSTASH_REDIS_REST_URL` or `UPSTASH_REDIS_REST_TOKEN` unset.
- [ ] Development/test: warning logged, in-memory fallback continues to work.
- [ ] Existing rate-limit tests pass unchanged (test env uses in-memory).

## Blocked by

- none (Issue 096 adds edge rate-limit middleware; this issue ensures the backing store is real)

## Files

- `lib/config/env.ts`
- `lib/ratelimit/index.ts`

## Severity

LAUNCH — ineffective rate limiting on serverless leaves all API endpoints unprotected against
brute-force and DoS when Upstash is misconfigured.
