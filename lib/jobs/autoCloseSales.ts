/**
 * autoCloseSales — close ticket sales on trips whose departure has arrived
 * (Issue 019 AC2). Sets salesClosed=true on scheduled trips at/after departure.
 *
 * SPEC NOTE (Issue 019): the issue text references Trip.salesOpen — the real
 * field is the inverse boolean Trip.salesClosed (default false). "Close sales"
 * = set salesClosed=true. Only 'scheduled' trips are touched; departed/
 * completed/cancelled trips already have sales closed by their lifecycle.
 */

import { Prisma } from '@prisma/client';
import type { JobCore } from './types';

const BATCH_LIMIT = 500;

export const autoCloseSales: JobCore = async (tx) => {
  const closed = await tx.$queryRaw<{ id: string }[]>(
    Prisma.sql`
      WITH batch AS (
        SELECT id FROM "Trip"
        WHERE "departureAt" <= NOW()
          AND "salesClosed" = false
          AND status = 'scheduled'::"TripStatus"
        LIMIT ${BATCH_LIMIT}
      )
      UPDATE "Trip" t
      SET "salesClosed" = true
      FROM batch
      WHERE t.id = batch.id
      RETURNING t.id
    `
  );

  return { rowsAffected: closed.length, status: 'success' };
};
