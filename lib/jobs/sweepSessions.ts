import { Prisma } from '@prisma/client';
import type { JobCore } from './types';

const BATCH_LIMIT = 500;

export const sweepSessions: JobCore = async (tx) => {
  const deleted = await tx.$queryRaw<{ id: string }[]>(
    Prisma.sql`
      WITH expired AS (
        SELECT id FROM "Session"
        WHERE "expiresAt" < NOW()
        LIMIT ${BATCH_LIMIT}
        FOR UPDATE SKIP LOCKED
      )
      DELETE FROM "Session"
      WHERE id IN (SELECT id FROM expired)
      RETURNING id
    `
  );

  return { rowsAffected: deleted.length, status: 'success' };
};
