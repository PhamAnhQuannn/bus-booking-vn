/**
 * pspFees (Issue 123) — read side of the VNPay PSP-fee (MDR) platform-float entries.
 *
 * `psp_fee` ledger rows are stored NEGATIVE (money the platform pays VNPay) and are
 * EXCLUDED from the operator balance (see OPERATOR_BALANCE_TYPES in balance.ts) —
 * they exist purely so the platform can measure its per-booking VNPay cost. This
 * helper sums them for the admin Finance tab ("VNPay cost this period").
 *
 * BigInt end-to-end: Postgres SUM(BIGINT) → NUMERIC, cast ::text, parse with BigInt()
 * (no float drift — Issue 016).
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/core/db/client';

/**
 * Total VNPay PSP fee (MDR) as a POSITIVE magnitude in VND minor units.
 * The stored entries are negative; we negate the SUM to report a positive cost.
 * Optional half-open `[from, to)` createdAt window; omit for all-time.
 */
export async function sumPspFees(range?: { from?: Date; to?: Date }): Promise<bigint> {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`"type" = 'psp_fee'::"LedgerEntryType"`,
  ];
  if (range?.from) conditions.push(Prisma.sql`"createdAt" >= ${range.from}`);
  if (range?.to) conditions.push(Prisma.sql`"createdAt" < ${range.to}`);

  const rows = await prisma.$queryRaw<{ sum: string }[]>`
    SELECT COALESCE(-SUM("amount"), 0)::text AS sum
    FROM "LedgerEntry"
    WHERE ${Prisma.join(conditions, ' AND ')}
  `;
  return BigInt(rows[0]?.sum ?? '0');
}
