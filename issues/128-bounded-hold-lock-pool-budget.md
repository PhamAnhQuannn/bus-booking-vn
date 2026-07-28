---
depends-on: []
type: BUG
wave: 1
---

## Parent PRD

Plan: `C:\Users\mrimp\.claude\plans\with-all-the-issues-reactive-llama.md` — PR 4.
GitHub #362 + #363, and supersedes open PR #301.

## What to fix

**These must ship as ONE release.** Splitting them is the outage.

### (a) Blocking advisory lock (#362)

`createHold` takes the **blocking** `pg_advisory_xact_lock` twice inside one `$transaction` —
phone lock (`lib/core/db/holdRepo.ts:82`) then trip lock (`:98`) — so every waiter for a hot
trip pins a pooled connection for the full queue wait. The lock ORDER (phone before trip) is
deliberate deadlock avoidance, documented at `holdRepo.ts:18` — **preserve it**.

### (b) Pool split-brain (#363)

`lib/core/db/client.ts:14` reads raw `process.env.DATABASE_POOL_MAX || 5`, bypassing the
Zod-validated value whose default is 1. Prod silently runs at 5, not the intended 1.

### (c) Why they are one release

PR #301 changes that fallback to `|| 1` (verified in its real diff, not its title). At pool=1 a
blocked instance's **only** connection is parked in the lock wait, so the whole warm instance
serves zero requests until `connectionTimeoutMillis`. Landing #301 without the bounded lock
converts a degraded path into a total per-instance outage.

### (d) What PR #301 actually contains

Confirmed MERGEABLE, no real conflict with master. It does more than its title says:

- `lib/core/db/client.ts`: pool `5 → 1`, `connectionTimeoutMillis` `3_000 → 10_000`
- `Payout` `Int → BigInt` on 6 columns + migration `20260725120000_neon_readiness`
- adds `Trip_busId_idx`, adds `LedgerEntry(operatorId, createdAt)`, replaces `Hold(expiresAt)`
  with `Hold(status, expiresAt)`, drops `Operator_id_idx`
- **adds `DATABASE_POOL_MAX: '5'` to 3 CI job env blocks** — load-bearing: the existing
  20-parallel oversell test (`lib/core/db/__tests__/holdRepo.int.test.ts:136-159`) collapses at
  `max:1` without it
- carries **7 `docs/qa/*.md` review artifacts** that do not belong in a code PR — drop them

Read the real diff and carry every change forward; do not re-derive it.

### Fix

1. `client.ts` reads the validated config instead of raw env.
2. `holdRepo` switches to `pg_try_advisory_xact_lock` + **bounded, jittered** retry (3 attempts),
   then a typed `seat_map_busy` → HTTP 429 with `Retry-After` rather than a hang. Preserve the
   phone→trip order. **No retry/backoff/jitter utility exists in `lib/**`** — the only `backoffMs`
   (`lib/notification/dispatchNotifications.ts:65-68`) is a DB-persisted schedule with no jitter,
   not reusable. Write one. `lib/jobs/withAdvisoryLock.ts:36` is the try-lock precedent but does
   not retry at all (returns `skipped_locked`).
3. Stagger the co-scheduled crons in `vercel.json`: three at `* * * * *`
   (sweep-holds, close-sales, dispatch-notifications), three at `0 * * * *`
   (process-payouts, charter-expiry, sweep-sessions), two at `*/15 * * * *`
   (send-reminders, reconcile-payments). No stagger convention exists today.
4. Assert the Neon **pooled** endpoint at boot. `DATABASE_URL` is a bare optional string
   (`lib/config/env.ts:295`) with no `-pooler` check; the requirement lives only in
   `documentation/guides/02-setup-neon.md` and ADR-020 — documented, never enforced.

## Acceptance criteria

- [ ] A contended hold returns 429 `seat_map_busy` with `Retry-After` instead of blocking.
- [ ] Phone lock is still acquired before trip lock.
- [ ] Retry backoff is jittered (no lockstep thundering herd on a hot departure).
- [ ] `client.ts` pool size comes from the validated config and reads 1 in production.
- [ ] Concurrent integration test written **before** the change: N parallel `createHold` on one
      trip, no 504, clean 429, and oversell still impossible.
- [ ] `holdRepo.int.test.ts` 20-parallel test still passes (CI keeps `DATABASE_POOL_MAX=5`).
- [ ] `pnpm prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma`
      → `No difference detected.`
- [ ] PR #301 closed as superseded; its 7 `docs/qa/*` artifacts not carried over.

## Blocked by

- none (but nothing else in wave 1 should merge between this and the pool change)

## Files

- `lib/core/db/client.ts`, `lib/core/db/holdRepo.ts`, `lib/config/env.ts`
- `vercel.json`, `prisma/schema.prisma`, `prisma/migrations/20260725120000_neon_readiness/`

## Severity

LAUNCH — highest-regression-risk change in the backlog; it alters lock semantics on the booking
hot path. Run `/migration-safety` before deploy.
