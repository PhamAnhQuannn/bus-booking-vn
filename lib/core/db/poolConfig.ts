/**
 * Single source of truth for the pg pool size (#363).
 *
 * The defect this closes: `client.ts` read `Number(process.env.DATABASE_POOL_MAX) || 5`
 * while the Zod schema declared `.default(1)`. Production silently ran at 5, and nothing
 * in the schema told you which value was live. Two readers of one setting, disagreeing.
 *
 * The obvious fix — have `client.ts` call `getEnv()` — was tried and reverted: it makes
 * constructing the DB client validate the ENTIRE environment at module load, so every
 * unit test that transitively imports the prisma singleton dies on unrelated missing
 * vars (`HOLD_SECRET: expected string, received undefined`). Same module-graph-widening
 * class as the `@/lib/config` barrel regression earlier in this branch.
 *
 * So the DEFAULT and the CLAMP live here, `lib/config/env.ts` imports the default for its
 * Zod schema, and `client.ts` calls the resolver. One definition, no full-env parse on
 * the DB path.
 */

/**
 * 1 is correct for Vercel + Neon: the pooler handles cross-invocation concurrency, so a
 * warm instance needs a single physical connection. Total connections = concurrent
 * instances × pool_max, which is what exhausts Neon's ceiling when this is set high.
 *
 * Multi-connection contexts must raise it — local dev, and CI integration/e2e where ONE
 * process drives genuinely concurrent transactions (Promise.all fan-out, the 20-parallel
 * oversell race, SKIP LOCKED and advisory-lock contention). At 1 those deadlock against
 * themselves and surface as "Unable to start a transaction in the given time", which
 * reads like a code bug and is not one. `vitest.integration.config.ts` sets it for that
 * reason; CI sets it explicitly in each job env.
 */
export const DEFAULT_DATABASE_POOL_MAX = 1;

const MIN_POOL_MAX = 1;
const MAX_POOL_MAX = 50;

/**
 * Resolve the pool size from the environment, applying the same bounds the Zod schema
 * declares. Clamping matters: the old raw `Number(x) || 5` passed a negative straight
 * through to `pg.Pool` (`"-3"` → `-3`), because `||` only rejects `NaN` and `0`.
 */
export function resolveDatabasePoolMax(): number {
  const raw = process.env.DATABASE_POOL_MAX;
  if (raw === undefined || raw === '') return DEFAULT_DATABASE_POOL_MAX;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    return DEFAULT_DATABASE_POOL_MAX;
  }
  return Math.min(MAX_POOL_MAX, Math.max(MIN_POOL_MAX, parsed));
}

/**
 * pg pool connection-acquire budget. 10s absorbs Neon autoscale/cold-start latency
 * before a queued acquire fails.
 */
export const CONNECTION_TIMEOUT_MS = 10_000;

/**
 * Prisma interactive-transaction `maxWait` — the time allowed to ACQUIRE + start a tx
 * (get a pooled connection, BEGIN). Prisma's default is 2000ms, which the first query
 * after a Neon autosuspend cold-start can exceed → "Unable to start a transaction in
 * the given time". Set at the client level (lib/core/db/client.ts) so it covers every
 * interactive $transaction — crons AND request paths (booking/payment/ledger).
 *
 * INVARIANT: TX_MAX_WAIT_MS > CONNECTION_TIMEOUT_MS. maxWait is the OUTER budget that
 * must fully contain the pool's connection-acquire; if they were equal, a cold-start
 * that consumes the pool's whole 10s could still trip maxWait right as the connection
 * arrives. 15s nests cleanly and stays ≪ Vercel's default 300s function budget.
 */
export const TX_MAX_WAIT_MS = 15_000;

/**
 * Prisma interactive-transaction `timeout` — the time a tx may RUN once started, before
 * the commit is rejected ("A commit cannot be executed on an expired transaction").
 * Prisma's default is 5000ms. After a Neon autosuspend cold-start the first tx's queries
 * run slow enough to inflate otherwise-millisecond work past 5s (observed in prod:
 * dispatch-notifications committed at 5023ms and failed). This is the sibling knob to
 * TX_MAX_WAIT_MS: maxWait covers the ACQUIRE, timeout covers the RUN. Set at the client
 * level so every interactive $transaction survives a cold-start-inflated run; jobs that
 * legitimately do more work override per-call (e.g. generate-ticket-pdfs passes 120_000
 * via runJob, which takes precedence over this client default). 15s ≪ Vercel's 300s
 * function budget.
 */
export const TX_TIMEOUT_MS = 15_000;
