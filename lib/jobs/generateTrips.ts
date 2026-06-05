/**
 * generateTrips — JobCore wrapper around generateTripsFromTemplates (Issue 043).
 *
 * Issue 043 hardens /api/cron/generate-trips to run under the same advisory-lock
 * + JobRunLog machinery (lib/jobs/runJob + withAdvisoryLock) as the other five
 * crons, so two overlapping ticks can no longer race.
 *
 * The generation logic itself is UNCHANGED: generateTripsFromTemplates owns its
 * own per-row `prisma.$transaction` with a partial-unique idempotency guard
 * (recurringTemplateId, departureAt). That per-row idempotency is retained as
 * defense-in-depth — the advisory lock serializes whole ticks, the per-row
 * guard protects against any residual overlap (e.g. a manual trigger racing a
 * scheduled tick on the same instant).
 *
 * The wrapper deliberately does NOT thread the lock `tx` into the generator:
 * the generator's many short per-row transactions must commit independently and
 * must not be subsumed into the long-lived lock transaction. The lock tx exists
 * only to hold the advisory key; the core's actual writes happen on the pooled
 * `prisma` client inside the generator. rowsAffected is the count of trips
 * generated this run.
 */

import type { JobCore } from './types';

export const generateTrips: JobCore = async () => {
  // Lazy import: generateFromTemplate transitively constructs the Prisma client
  // at module-eval time (lib/db/client throws when DATABASE_URL is unset). The
  // route's unit tests mock runJob and never invoke this core, so keeping the
  // generator import dynamic keeps the route's static import graph free of the
  // DB client — mirroring how the other job cores (autoCloseSales, …) avoid
  // pulling lib/db/client into the route's import boundary.
  const { generateTripsFromTemplates } = await import('@/lib/trips');
  const result = await generateTripsFromTemplates();
  return { rowsAffected: result.generated, status: 'success' };
};
