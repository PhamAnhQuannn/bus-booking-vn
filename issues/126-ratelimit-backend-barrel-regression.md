---
depends-on: []
type: BUG
wave: 0
---

## Parent PRD

Plan: `C:\Users\mrimp\.claude\plans\with-all-the-issues-reactive-llama.md` — PR 2.1.

## What to fix

**DONE** — fixed in commit `70ae5e8` on branch `fix/ratelimit-fail-open-sepay-key-controls`
(PR #379). Recorded here because the failure mode is a recurring class, not a one-off.

Exporting `resolveRatelimitBackend` from the `@/lib/config` barrel widened `lib/ratelimit`'s
module graph through it. Any test doing a **partial** mock —
`vi.mock('@/lib/config', () => ({ getEnv: mockGetEnv }))` — then resolved the symbol to
`undefined` at module load, and `createRatelimit` threw during collection.
`app/api/op/charter/[id]/decline/__tests__/route.test.ts` failed to load entirely (0 tests
collected; the other 1720 still passed).

Same class as the 2026-06-03 mistake-log entry: barrel import + partial mock.

Fixed at the root rather than by patching the mock — the predicate moved to
`lib/core/http/ratelimitBackend.ts` (reads `process.env`, imports nothing), deep-imported by
both `lib/config/env.ts` and `lib/ratelimit/index.ts`. `lib/core` is deep-importable by every
domain, so no barrel sits between them. `lib/core/config/index.ts` would NOT have worked — it
is `export * from '@/lib/config'`, the same barrel.

## Acceptance criteria

- [x] `resolveRatelimitBackend` lives in `lib/core/http/ratelimitBackend.ts`.
- [x] `lib/config/index.ts` exports `getEnv` only.
- [x] `pnpm test` — 239/239 files, 1726/1726 tests.
- [ ] Process rule adopted: full `pnpm test` runs after the **last** edit of a change. A late
      fix (here, for a lint error) invalidates every earlier green run; a subset re-run is what
      let this ship.

## Blocked by

- none

## Files

- `lib/core/http/ratelimitBackend.ts` (new)
- `lib/config/env.ts`, `lib/config/index.ts`, `lib/ratelimit/index.ts`

## Severity

LAUNCH-adjacent — no production impact (test-collection only), but it shipped inside a P1 fix
and would have masked any later regression in that suite.
