---
depends-on: []
type: BUG
wave: 0.5
spec: []
---

## Parent PRD

`issues/prd.md` — cross-cutting infrastructure gap identified by grill-me self-assessment

## What to fix

`lib/core/db/client.ts:24-28` only caches the PrismaClient singleton in non-production
(`process.env.NODE_ENV !== 'production'`). In production on Vercel, every serverless cold start
creates a new `PrismaClient` + `new Pool({ connectionString })` with pg's default `max=10`.
Under burst traffic (50 concurrent function instances), that's 500 PG connections against
Vercel Postgres (100 hobby / 500 pro limit). Connection exhaustion causes cascading 500s.

Additionally, no `DATABASE_POOL_MAX` env var controls the pool size — the pg default of 10 is
baked in.

### Fix

1. **Production singleton**: Store `prisma` on `globalForPrisma` in ALL environments (the
   comment "serverless-safe" is incorrect — Vercel function instances persist between invocations
   within the same isolate; the global cache prevents re-creating pools on warm invocations).
2. **Pool size config**: Add `DATABASE_POOL_MAX` to `lib/config/env.ts` (Zod,
   `z.coerce.number().int().min(1).max(50).default(5)`). Pass to `new Pool({ max })`.
3. **Document**: Add a note in `docs/ops/` recommending PgBouncer / Supavisor pooler for
   deployments expecting >50 concurrent function instances.

## Acceptance criteria

- [ ] `globalForPrisma.prisma = prisma` runs in ALL environments (remove the `NODE_ENV` guard).
- [ ] `new Pool()` receives `{ connectionString, max: env.DATABASE_POOL_MAX }`.
- [ ] `DATABASE_POOL_MAX` is in the Zod env schema with a sensible default (5).
- [ ] Existing tests pass — no behavioral change, only pool lifecycle.

## Blocked by

- none

## Files

- `lib/core/db/client.ts`
- `lib/config/env.ts`

## Severity

BLOCKER — connection exhaustion under load causes full API outage.
