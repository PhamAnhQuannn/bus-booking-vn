/**
 * getAdminMetrics — platform-wide business KPIs for the admin Overview
 * (issue 064 UI consumes this; this slice is the query/aggregate layer only).
 *
 * Composed of:
 *   - customers       total non-deleted Customer rows (deletedAt IS NULL, Issue 008 soft-delete)
 *   - operators       total Operator rows + APPROVED count (OperatorStatus)
 *   - bookings        count of PAID bookings created in the window
 *   - gmvVnd          GMV = SUM(Booking.totalVnd) for PAID bookings in the window
 *   - revenueVnd      platform revenue = ABS(SUM(LedgerEntry.amount WHERE type='platform_fee'))
 *                     in the window. platform_fee is stored NEGATIVE (Issue 049);
 *                     we sum + abs in the BigInt/SQL domain, Number() only at the end.
 *   - funnel          delegated wholesale to getFunnel(input)
 *
 * MONEY-CRITICAL (Issue 016): GMV and revenue SUMs are computed in SQL.
 *   - GMV sums Booking.totalVnd (Int VND) — COALESCE(...,0)::bigint cast → text → BigInt.
 *   - revenue sums LedgerEntry.amount (BigInt) — the negative platform_fee total —
 *     cast ::text → BigInt → abs → Number. No JS float multiplication anywhere.
 *
 * DATE WINDOW (Issue 014): VN-tz, identical `${date}T00:00:00+07:00` ..
 * `T23:59:59+07:00` convention as getFunnel. Applied to:
 *   - bookings: Booking.createdAt (the sale instant — a paid booking is "in" the
 *     window if it was CREATED in it; consistent, single-timestamp choice).
 *   - ledger: LedgerEntry.createdAt (the platform_fee entry instant).
 */

import { prisma as defaultPrisma } from '@/lib/db/client';
import { Prisma } from '@prisma/client';
import { getFunnel, type FunnelStepResult } from './getFunnel';

/**
 * Paid booking status. Currently the single "paid" enum value
 * (`paid_operator_notified`) until the Wave-7 `paid` rename/split. Sourced from
 * the BookingStatus enum, not a re-typed literal scattered elsewhere.
 */
const PAID_BOOKING_STATUS = 'paid_operator_notified' as const;

/** Approved-operator status (OperatorStatus enum). */
const APPROVED_OPERATOR_STATUS = 'APPROVED' as const;

export interface AdminMetrics {
  customers: number;
  operators: { total: number; approved: number };
  bookings: number;
  gmvVnd: number;
  revenueVnd: number;
  funnel: FunnelStepResult[];
}

export interface GetAdminMetricsInput {
  dateFrom: string; // YYYY-MM-DD
  dateTo: string; // YYYY-MM-DD
}

/** Minimal prisma surface this module needs — lets tests inject a stub. */
type PrismaLike = Pick<typeof defaultPrisma, '$queryRaw' | 'customer' | 'operator'>;

export async function getAdminMetrics(
  input: GetAdminMetricsInput,
  prisma: PrismaLike = defaultPrisma
): Promise<AdminMetrics> {
  const windowStart = new Date(`${input.dateFrom}T00:00:00+07:00`);
  const windowEnd = new Date(`${input.dateTo}T23:59:59+07:00`);

  const [
    customers,
    operatorsTotal,
    operatorsApproved,
    bookingsAgg,
    revenueAgg,
    funnel,
  ] = await Promise.all([
    // Non-deleted customers only (Issue 008 soft-delete: deletedAt IS NULL).
    prisma.customer.count({ where: { deletedAt: null } }),
    prisma.operator.count(),
    prisma.operator.count({ where: { status: APPROVED_OPERATOR_STATUS } }),
    // Paid bookings created in the window: count + GMV sum (SUM in SQL, Issue 016).
    prisma.$queryRaw<{ cnt: string; gmv: string }[]>(Prisma.sql`
      SELECT COUNT(*)::text AS cnt,
             COALESCE(SUM("totalVnd"), 0)::bigint::text AS gmv
      FROM "Booking"
      WHERE status = ${PAID_BOOKING_STATUS}::"BookingStatus"
        AND "createdAt" >= ${windowStart}
        AND "createdAt" <= ${windowEnd}
    `),
    // Platform revenue: SUM of NEGATIVE platform_fee entries in the window.
    // Summed as BigInt in SQL; ::text out → BigInt → abs → Number at the end.
    prisma.$queryRaw<{ fee_sum: string }[]>(Prisma.sql`
      SELECT COALESCE(SUM("amount"), 0)::text AS fee_sum
      FROM "LedgerEntry"
      WHERE type = ${'platform_fee'}::"LedgerEntryType"
        AND "createdAt" >= ${windowStart}
        AND "createdAt" <= ${windowEnd}
    `),
    getFunnel(input),
  ]);

  const bookings = Number(bookingsAgg[0]?.cnt ?? '0');
  const gmvVnd = Number(BigInt(bookingsAgg[0]?.gmv ?? '0'));

  // platform_fee is stored negative; revenue is the magnitude. Abs in BigInt
  // domain, then Number() the final integer (VND total fits in a JS number).
  const feeSum = BigInt(revenueAgg[0]?.fee_sum ?? '0');
  const revenueVnd = Number(feeSum < BigInt(0) ? -feeSum : feeSum);

  return {
    customers,
    operators: { total: operatorsTotal, approved: operatorsApproved },
    bookings,
    gmvVnd,
    revenueVnd,
    funnel,
  };
}
