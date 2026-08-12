/**
 * One-off: HIDE the "TEST PAYMENT VERIFY" operator seeded by scripts/prod/seed-test-trip.ts
 * from the public site, WITHOUT deleting anything (the trip may have a PAID booking whose
 * append-only LedgerEntry blocks purge-demo-catalog.ts).
 *
 * getPublicOperators() shows any operator that has ≥1 route with deactivatedAt=null, and
 * getActiveRoutes() additionally requires operator.disabledAt=null. So soft-disabling both:
 *   - Route.deactivatedAt = now()  → removes it from the homepage OperatorShowcase + /routes
 *   - Operator.disabledAt = now()  → belt-and-suspenders (also drops it from the search graph)
 * is enough to make it vanish from every public surface. Fully reversible (set the columns
 * back to NULL) and never touches the ledger.
 *
 * Idempotent: only flips rows still NULL, so a re-run is a no-op.
 *
 * Run (against the target DB — use the DIRECT_URL for prod, not the pooled URL):
 *   DATABASE_URL=<direct-url> CONFIRM_HIDE=yes pnpm tsx scripts/prod/hide-test-operator.ts
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
// Generous tx budget: a Neon autosuspend cold-start exceeds Prisma's default 2s maxWait
// ("Unable to start a transaction in the given time") on the first connection.
const prisma = new PrismaClient({
  adapter,
  transactionOptions: { maxWait: 20_000, timeout: 20_000 },
});

const TARGET_LEGAL_NAME = 'TEST PAYMENT VERIFY';

async function main() {
  if (process.env.CONFIRM_HIDE !== 'yes') {
    throw new Error('Refusing to hide: set CONFIRM_HIDE=yes to proceed.');
  }

  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const operators = await tx.operator.findMany({
      where: { legalName: TARGET_LEGAL_NAME },
      select: { id: true, disabledAt: true },
    });
    if (operators.length === 0) {
      return { operators: 0, operatorsDisabled: 0, routesDeactivated: 0 };
    }
    const operatorIds = operators.map((o) => o.id);

    const routes = await tx.route.updateMany({
      where: { operatorId: { in: operatorIds }, deactivatedAt: null },
      data: { deactivatedAt: now },
    });
    const ops = await tx.operator.updateMany({
      where: { id: { in: operatorIds }, disabledAt: null },
      data: { disabledAt: now },
    });

    return {
      operators: operators.length,
      operatorsDisabled: ops.count,
      routesDeactivated: routes.count,
    };
  });

  console.log(`Hid test operator "${TARGET_LEGAL_NAME}":`, result);
  console.log('Reverse with: UPDATE "Route" SET "deactivatedAt"=NULL / UPDATE "Operator" SET "disabledAt"=NULL for these ids.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => pool.end());
