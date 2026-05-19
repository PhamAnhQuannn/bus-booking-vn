/**
 * markCompleted — operator marks trip as completed (Issue 014 AC5).
 *
 * Sets Trip.completedAt. Discriminated result { ok, alreadyCompleted, trip }.
 * Inside same transaction: INSERTs a NotificationLog row per paid booking on the trip
 * with template='payout_scheduled', scheduledFor=completedAt+3days (S19 hook).
 * NotificationLog.bookingId anchors the payout record to the booking (existing schema).
 *
 * $transaction + SELECT FOR UPDATE on Trip (TOCTOU guard).
 */

import { prisma } from '@/lib/db/client';
import { Prisma } from '@prisma/client';
import { TripServiceError } from './errors';
import { toTripDto } from './toTripDto';
import type { TripDto } from './tripDto';
import { randomUUID } from 'crypto';

export interface MarkCompletedResult {
  ok: true;
  alreadyCompleted: boolean;
  trip: TripDto;
  payoutJobsEnqueued: number;
}

const PAYOUT_ELIGIBLE_STATUSES = [
  'paid_operator_notified',
  'completed',
] as const;

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

export async function markCompleted(
  operatorId: string,
  tripId: string
): Promise<MarkCompletedResult> {
  return prisma.$transaction(async (tx) => {
    // SELECT FOR UPDATE to serialise concurrent complete calls
    const locked = await tx.$queryRaw<{
      id: string;
      status: string;
      completedAt: Date | null;
      departedAt: Date | null;
    }[]>(
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

    // Idempotency: already completed
    if (row.completedAt !== null) {
      const existing = await tx.trip.findUnique({
        where: { id: tripId },
        include: {
          bus: { select: { capacity: true } },
          _count: {
            select: {
              holds: { where: { status: 'active' } },
              bookings: {
                where: {
                  status: { in: ['pending_cash_payment', 'paid_operator_notified', 'completed'] },
                },
              },
            },
          },
        },
      });
      return {
        ok: true,
        alreadyCompleted: true,
        trip: toTripDto(existing!),
        payoutJobsEnqueued: 0,
      };
    }

    const now = new Date();
    const scheduledFor = new Date(now.getTime() + THREE_DAYS_MS);

    const updated = await tx.trip.update({
      where: { id: tripId },
      data: { completedAt: now, status: 'completed' },
      include: {
        bus: { select: { capacity: true } },
        _count: {
          select: {
            holds: { where: { status: 'active' } },
            bookings: {
              where: {
                status: { in: ['pending_cash_payment', 'paid_operator_notified', 'completed'] },
              },
            },
          },
        },
      },
    });

    // Fetch paid bookings for payout notification log entries (S19 hook)
    const paidBookings = await tx.booking.findMany({
      where: {
        tripId,
        status: { in: [...PAYOUT_ELIGIBLE_STATUSES] },
      },
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
          // scheduledFor stored as queryable column (S19 cron: WHERE scheduledFor <= NOW())
          // payload keeps only canonical context — no scheduledFor duplication to avoid drift
          payload: JSON.stringify({ tripId, operatorId }),
          scheduledFor,
          status: 'pending' as const,
        })),
      });
    }

    return {
      ok: true,
      alreadyCompleted: false,
      trip: toTripDto(updated),
      payoutJobsEnqueued: paidBookings.length,
    };
  });
}
