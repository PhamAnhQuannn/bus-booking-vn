/**
 * dispatchNotifications (job wrapper) — JobCore around the notification
 * dispatcher core (Issue 058), mirroring lib/jobs/generateTrips.
 *
 * Lazy import: lib/notifications/dispatchNotifications statically imports the
 * Prisma client (lib/db/client throws at module-eval when DATABASE_URL is
 * unset). The cron route's unit tests mock runJob and never invoke this core,
 * so keeping the dispatcher import dynamic keeps the route's static import graph
 * free of the DB client — exactly how generateTrips avoids the
 * DATABASE_URL-at-import test break.
 *
 * The wrapper threads the lock `tx` + opts through to the core. The core
 * deliberately ignores the lock tx for its claim/dispatch work (its own short
 * transactions commit independently on the pooled prisma client) — the lock tx
 * exists only to hold the 'notify-dispatch' advisory key.
 */

import type { JobCore } from './types';

export const dispatchNotifications: JobCore = async (tx, opts) => {
  const { dispatchNotifications: core } = await import(
    '@/lib/notifications/dispatchNotifications'
  );
  return core(tx, opts);
};
