/**
 * getOperatorDetail — admin Operators tab detail read for a single operator
 * (Issue 067, Part C).
 *
 * In-process Prisma read (NEVER self-fetch — AGENTS.md Issue 002/003). Aggregates,
 * for the operator detail page:
 *   - profile: legalName, contactEmail, contactPhone, status, createdAt,
 *     rejectionReason
 *   - fleet:   bus.count
 *   - trips:   trip.count (+ upcoming count: scheduled trips departing in the future)
 *   - volume:  GMV — SUM(totalVnd) of this operator's PAID bookings (raw SQL join
 *              Booking → Trip WHERE trip.operatorId = $ AND status = paid)
 *   - balance: getOperatorBalance (Issue 050) → pending/available/paidOut (bigint)
 *   - currentFeePpm: getEffectiveFeeRate(operatorId, now) (Issue 048)
 *   - payoutHistory: last N Payout rows desc
 *
 * Returns null when the operator does not exist.
 *
 * Money values (gmvVnd + balance buckets) are bigint to avoid float drift
 * (AGENTS.md Issue 016); the page formats them for display.
 */

import type { OperatorStatus, PayoutStatus } from '@prisma/client';
import { prisma as defaultPrisma } from '@/lib/core/db/client';
import { withOperatorScope } from '@/lib/core/db';
import { getOperatorBalance, type OperatorBalance } from '@/lib/ledger';
import { getEffectiveFeeRate } from '@/lib/ledger';

export interface OperatorPayoutHistoryItem {
  id: string;
  net: number;
  status: PayoutStatus;
  scheduledAt: Date;
  settledAt: Date | null;
}

export interface OperatorDetail {
  id: string;
  legalName: string;
  /** 2026-06-06 application fields (null on pre-rework rows). */
  brandName: string | null;
  contactName: string | null;
  address: string | null;
  routesSummary: string | null;
  contactEmail: string;
  contactPhone: string;
  status: OperatorStatus;
  createdAt: Date;
  rejectionReason: string | null;
  /** True once a login account (OperatorUser) has been provisioned for this operator. */
  hasLoginAccount: boolean;
  /** Username of the provisioned login account, or null if none. */
  loginUsername: string | null;
  /** Temp password shown to admin after provisioning. Null once operator changes password. */
  loginTempPassword: string | null;
  fleetCount: number;
  tripCount: number;
  upcomingTripCount: number;
  /** GMV: SUM(totalVnd) of paid bookings on this operator's trips (bigint VND). */
  gmvVnd: bigint;
  balance: OperatorBalance;
  /** Current effective platform fee in ppm (60000 = 6%). */
  currentFeePpm: number;
  payoutHistory: OperatorPayoutHistoryItem[];
}

/** Default number of payout rows to surface. */
const PAYOUT_HISTORY_LIMIT = 10;

/** Minimal prisma surface — lets unit tests inject stubs. */
type PrismaLike = Pick<
  typeof defaultPrisma,
  'operator' | 'operatorUser' | 'bus' | 'trip' | 'payout'
> & {
  $queryRaw: typeof defaultPrisma.$queryRaw;
};

interface GmvRow {
  gmv: string;
}

export async function getOperatorDetail(
  operatorId: string,
  prisma: PrismaLike = defaultPrisma,
  now: Date = new Date()
): Promise<OperatorDetail | null> {
  const operator = await prisma.operator.findUnique({
    where: { id: operatorId },
    select: {
      id: true,
      legalName: true,
      brandName: true,
      contactName: true,
      address: true,
      routesSummary: true,
      contactEmail: true,
      contactPhone: true,
      status: true,
      createdAt: true,
      rejectionReason: true,
    },
  });
  if (!operator) return null;

  const [fleetCount, tripCount, upcomingTripCount, gmvRows, balance, currentFeePpm, payouts, loginAccount] =
    await Promise.all([
      prisma.bus.count({ where: withOperatorScope(operatorId).where }),
      prisma.trip.count({ where: withOperatorScope(operatorId).where }),
      prisma.trip.count({
        where: { ...withOperatorScope(operatorId).where, status: 'scheduled', departureAt: { gt: now } },
      }),
      // GMV: SUM(totalVnd) of paid bookings on this operator's trips. COALESCE to 0,
      // cast ::text and parse with BigInt so the value never round-trips through a JS
      // number (Issue 016 — no float drift in money math). operatorId is bound.
      prisma.$queryRaw<GmvRow[]>`
        SELECT COALESCE(SUM(b."totalVnd"), 0)::text AS gmv
        FROM "Booking" b
        JOIN "Trip" t ON t.id = b."tripId"
        WHERE t."operatorId" = ${operatorId}
          AND b.status = 'paid'::"BookingStatus"
      `,
      getOperatorBalance(operatorId),
      getEffectiveFeeRate(operatorId, now),
      prisma.payout.findMany({
        where: withOperatorScope(operatorId).where,
        select: { id: true, net: true, status: true, scheduledAt: true, settledAt: true },
        orderBy: [{ scheduledAt: 'desc' }, { id: 'desc' }],
        take: PAYOUT_HISTORY_LIMIT,
      }),
      prisma.operatorUser.findFirst({ where: { operatorId }, select: { username: true } }),
    ]);

  const gmvVnd = BigInt(gmvRows[0]?.gmv ?? '0');

  return {
    id: operator.id,
    legalName: operator.legalName,
    brandName: operator.brandName,
    contactName: operator.contactName,
    address: operator.address,
    routesSummary: operator.routesSummary,
    contactEmail: operator.contactEmail,
    contactPhone: operator.contactPhone,
    status: operator.status,
    createdAt: operator.createdAt,
    rejectionReason: operator.rejectionReason,
    hasLoginAccount: loginAccount !== null,
    loginUsername: loginAccount?.username ?? null,
    loginTempPassword: null,
    fleetCount,
    tripCount,
    upcomingTripCount,
    gmvVnd,
    balance,
    currentFeePpm,
    payoutHistory: payouts.map((p) => ({
      id: p.id,
      net: p.net,
      status: p.status,
      scheduledAt: p.scheduledAt,
      settledAt: p.settledAt,
    })),
  };
}
