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
 * 2 is the floor for correctness, not just headroom. Total connections = concurrent
 * instances × pool_max vs Neon's ceiling, so this stays low — but it can NOT be 1:
 *
 * The outbox-pattern crons run a core that opens its OWN `prisma.$transaction` while
 * `withAdvisoryLock` still holds one pooled connection for the lock tx (notify-dispatch
 * → dispatchNotifications.claimDueRows; ticket-pdf → generateTicketPdfs batch claim).
 * At pool_max=1 the inner tx can never get a 2nd connection → it waits the full
 * `connectionTimeoutMillis` and fails ("timeout exceeded when trying to connect" /
 * "Unable to start a transaction"), so those jobs deadlock 100% (observed in prod:
 * notify-dispatch 45/45 failed, ticket-pdf never generated → putObject/R2 never ran).
 * Co-scheduled every-minute crons also starved the single connection intermittently.
 *
 * 2 gives the outbox jobs their lock-tx + one work-tx, and also relieves the
 * `Promise.all` query fan-out that serializes at 1 (the PR #301 perf review recommended
 * 2..3 for exactly this). Prod runs the Neon PgBouncer pooler, so extra pg.Pool
 * connections are cheap client connections, not scarce Postgres backends. The cleaner
 * long-term fix is claim-then-dispatch OUTSIDE the lock tx (see dispatchNotifications
 * docblock); until then the pattern requires ≥2. CI/integration already run higher.
 */
export const DEFAULT_DATABASE_POOL_MAX = 2;

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
