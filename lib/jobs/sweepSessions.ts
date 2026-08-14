import { Prisma } from '@prisma/client';
import type { JobCore } from './types';

const BATCH_LIMIT = 500;

// #475: OtpAttempt rows are ephemeral (5-min OTP, 15-min lockout sentinel) but nothing ever
// deleted them. Keep a short retention window well past any live OTP/lockout, then prune by age.
const OTP_RETENTION_DAYS = 7;

/**
 * Prune auth-table growth (#474, #475):
 *   - customer `Session`, `OperatorSession`, `AdminSession`: delete rows past `expiresAt`.
 *     Revoked-but-not-yet-expired rows are intentionally KEPT so reuse-detection still fires
 *     on a replayed token until it expires (mirrors the original customer-only sweep).
 *   - `OtpAttempt`: delete rows older than the retention window (by `createdAt`).
 *
 * Each delete is batched with `FOR UPDATE SKIP LOCKED` so overlapping ticks never contend.
 */
export const sweepSessions: JobCore = async (tx) => {
  const deleteExpiredSessions = (table: string) =>
    tx.$queryRaw<{ id: string }[]>(
      Prisma.sql`
        WITH expired AS (
          SELECT id FROM ${Prisma.raw(`"${table}"`)}
          WHERE "expiresAt" < NOW()
          LIMIT ${BATCH_LIMIT}
          FOR UPDATE SKIP LOCKED
        )
        DELETE FROM ${Prisma.raw(`"${table}"`)}
        WHERE id IN (SELECT id FROM expired)
        RETURNING id
      `
    );

  const [customer, operator, admin] = await Promise.all([
    deleteExpiredSessions('Session'),
    deleteExpiredSessions('OperatorSession'),
    deleteExpiredSessions('AdminSession'),
  ]);

  const otp = await tx.$queryRaw<{ id: string }[]>(
    Prisma.sql`
      WITH stale AS (
        SELECT id FROM "OtpAttempt"
        WHERE "createdAt" < NOW() - ${`${OTP_RETENTION_DAYS} days`}::interval
        LIMIT ${BATCH_LIMIT}
        FOR UPDATE SKIP LOCKED
      )
      DELETE FROM "OtpAttempt"
      WHERE id IN (SELECT id FROM stale)
      RETURNING id
    `
  );

  const rowsAffected = customer.length + operator.length + admin.length + otp.length;
  return { rowsAffected, status: 'success' };
};
