---
depends-on: []
type: BUG
wave: 0.5
spec: []
---

## Parent PRD

`issues/prd.md` — cross-cutting infrastructure gap identified by grill-me self-assessment.
Subsumes the CRON_SECRET portion of launch-checklist B-02.

## What to fix

`lib/config/env.ts` validates `HOLD_SECRET`, MoMo keys, notification vars, storage vars, and
`TICKET_SECRET` via Zod — but three security-critical env vars are missing from the schema:

1. **`JWT_SECRET`** — used by `lib/auth/jwt.ts` for all 3 auth realms. Has a test-only fallback
   (`'s'.repeat(32)`) but no production validation. An unset `JWT_SECRET` in production means
   ALL JWTs are signed with the test fallback — every token is forgeable.
2. **`DATABASE_URL`** — has a manual `throw` in `lib/core/db/client.ts` but is not in the Zod
   schema. Failure happens at first DB call, not at startup.
3. **`CRON_SECRET`** — not validated at all. All 11 cron handlers use
   `if (cronSecret && authHeader !== ...)` — when unset, auth is skipped entirely (B-02).

### Fix

Add to the Zod schema in `lib/config/env.ts`:

```ts
JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
DATABASE_URL: z.string().startsWith('postgres', 'DATABASE_URL must be a PostgreSQL connection string'),
CRON_SECRET: z.string().min(16, 'CRON_SECRET must be at least 16 characters'),
```

For `JWT_SECRET` and `CRON_SECRET`: add `.optional()` only in test environments if needed,
or use the existing test-fallback pattern.

Then fix all 11 cron handlers: change `if (cronSecret && ...)` → `if (!cronSecret || authHeader !== ...)`.
With CRON_SECRET now Zod-validated, the `!cronSecret` branch can never fire in production,
but the guard makes the code correct regardless.

## Acceptance criteria

- [ ] `JWT_SECRET`, `DATABASE_URL`, `CRON_SECRET` in Zod schema with appropriate min-length.
- [ ] App fails fast at startup (`getEnv()`) if any are missing in production.
- [ ] All 11 cron handlers use fail-closed pattern (`if (!cronSecret || ...)`).
- [ ] Unit test in `process-payouts/__tests__/route.test.ts` updated (currently asserts fail-open).
- [ ] Existing tests still pass (test env provides or mocks these vars).

## Blocked by

- none

## Files

- `lib/config/env.ts`
- All 11 `app/api/cron/*/route.ts`
- `lib/auth/jwt.ts` (verify test fallback still works)
- `process-payouts/__tests__/route.test.ts`

## Severity

BLOCKER — unset JWT_SECRET = forgeable tokens; unset CRON_SECRET = unauthenticated cron access.
