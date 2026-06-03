/**
 * completeTripCore — the in-transaction core of trip completion (Issue 014 +
 * Issue 019). Shared by markCompleted (operator-initiated, one trip) and the
 * autoCompleteTrips cron job (sweeps departed trips past their duration).
 *
 * Holds: SELECT FOR UPDATE on the Trip row (TOCTOU guard), idempotency via
 * completedAt, the status='completed' + completedAt write, the per-paid-booking
 * 'payout_scheduled' NotificationLog audit rows (Issue 014 — kept as audit
 * trail), and the aggregate Payout row creation (Issue 019).
 *
 * Payout row: one per trip, gross = sum(totalVnd) of paid bookings, amounts via
 * calcPayout (authoritative at creation), status='requested', scheduledAt =
 * completedAt + 1d (T+1, S15#5). Idempotent — skipped if a Payout already exists for the trip.
 *
 * SPEC NOTE (Issue 019): the issue text says the payout *processor* runs
 * calcPayout; we compute amounts here at row-creation instead so the Payout row
 * carries gross/platformFee/net from birth (AC3). The processor only transitions
 * status (pending → processing → settled/failed).
 */

import { Prisma } from '@prisma/client';
import { calcPayout } from '@/lib/payouts/calcPayout';
import { TripServiceError } from './errors';
import { randomUUID } from 'crypto';

const PAYOUT_ELIGIBLE_STATUSES = ['paid', 'completed'] as const;

// Settlement delay = T+1 (S15#5, ratified 2026-06-01). The 1-day buffer is the
// dispute/chargeback window. TODO(ledger, issues 048-050): promote to a FeeConfig-style
// platform setting when the ledger lands.
const ONE_DAY_MS = 1 * 24 * 60 * 60 * 1000;

const tripInclude = {
  bus: { select: { capacity: true } },
  _count: {
    select: {
      holds: { where: { status: 'active' } },
      bookings: {
        where: {
          status: { in: ['paid', 'completed'] },
        },
      },
    },
  },
} satisfies Prisma.TripInclude;

export type CompletedTripRow = Prisma.TripGetPayload<{ include: typeof tripInclude }>;

export interface CompleteTripCoreResult {
  alreadyCompleted: boolean;
  trip: CompletedTripRow;
  paidBookingCount: number;
  payoutCreated: boolean;
}

export async function completeTripCore(
  tx: Prisma.TransactionClient,
  input: { tripId: string; operatorId: string; now?: Date }
): Promise<CompleteTripCoreResult> {
  const { tripId, operatorId } = input;
  const now = input.now ?? new Date();

  // SELECT FOR UPDATE serialises concurrent complete calls on the same trip.
  const locked = await tx.$queryRaw<
    { id: string; status: string; completedAt: Date | null; departedAt: Date | null }[]
  >(
    Prisma.sql`
      SELECT id, status, "completedAt", "departedAt"
      FROM "Trip"
      WHERE id = ${tripId}
        AND "operatorId" = ${operatorId}
      FOR UPDATE
    `
  );

  if (locked.length === 0) {
    throw new TripServiceError('not_found');
  }

  const row = locked[0];

  if (row.status === 'cancelled') {
    throw new TripServiceError('trip_cancelled');
  }

  // Idempotency: already completed — return current state, do no work.
  if (row.completedAt !== null) {
    const existing = await tx.trip.findUnique({ where: { id: tripId }, include: tripInclude });
    return { alreadyCompleted: true, trip: existing!, paidBookingCount: 0, payoutCreated: false };
  }

  const scheduledFor = new Date(now.getTime() + ONE_DAY_MS);

  const updated = await tx.trip.update({
    where: { id: tripId },
    data: { completedAt: now, status: 'completed' },
    include: tripInclude,
  });

  // Paid bookings drive both the audit NotificationLog rows and the payout gross.
  const paidBookings = await tx.booking.findMany({
    where: { tripId, status: { in: [...PAYOUT_ELIGIBLE_STATUSES] } },
    select: { id: true, buyerPhone: true, totalVnd: true },
  });

  if (paidBookings.length > 0) {
    await tx.notificationLog.createMany({
      data: paidBookings.map((b) => ({
        id: randomUUID().replace(/-/g, '').slice(0, 25),
        bookingId: b.id,
        channel: 'sms' as const,
        template: 'payout_scheduled',
        recipient: b.buyerPhone,
        // scheduledFor is the queryable column; payload keeps only canonical
        // context (no scheduledFor duplication — avoids dual-source drift).
        payload: JSON.stringify({ tripId, operatorId }),
        scheduledFor,
        status: 'pending' as const,
      })),
    });
  }

  // Aggregate Payout row — one per trip. Idempotent: skip if one already exists
  // (Payout has no unique constraint on tripId, so guard with findFirst).
  let payoutCreated = false;
  const existingPayout = await tx.payout.findFirst({ where: { tripId } });
  if (!existingPayout) {
    const grossPaidBookings = paidBookings.reduce((sum, b) => sum + b.totalVnd, 0);
    const { gross, platformFee, net } = calcPayout({ grossPaidBookings });
    await tx.payout.create({
      data: {
        tripId,
        operatorId,
        gross,
        platformFee,
        net,
        status: 'requested',
        scheduledAt: scheduledFor,
      },
    });
    payoutCreated = true;
  }

  return {
    alreadyCompleted: false,
    trip: updated,
    paidBookingCount: paidBookings.length,
    payoutCreated,
  };
}
