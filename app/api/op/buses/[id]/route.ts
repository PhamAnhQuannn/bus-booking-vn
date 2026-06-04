/**
 * /api/op/buses/[id]  — single-bus routes (Issue 011).
 *
 * GET   — return bus + maintenance windows (cross-op → 404).
 * PATCH — partial update; AC2 plate uniqueness → 422 plate_in_use; AC3 capacity
 *         reduction guarded inside a $transaction (FOR UPDATE lock) →
 *         422 capacity_reduction_blocked with violatingTrips. AC11 deactivated
 *         buses cannot be edited (returns 422 reactivation_not_supported when
 *         the row is soft-deleted — re-activation is unsupported).
 *
 * Both gated by requireOperatorAuth; operatorId from JWT.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { requireOperatorAuth, type OperatorAuthContext } from '@/lib/auth';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { getOperatorBus } from '@/lib/catalog';
import { updateBus, type UpdateBusInput } from '@/lib/catalog';
import { BusServiceError } from '@/lib/catalog';
import { canReduceCapacity } from '@/lib/catalog';
import { UpdateBusSchema } from '@/lib/core/validation/bus';
import { prisma } from '@/lib/core/db/client';
import { BookingStatus } from '@prisma/client';

const PAID_STATUSES: BookingStatus[] = [
  BookingStatus.paid,
  BookingStatus.completed,
];

type RouteContext = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// GET — bus detail (with maintenance windows)
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest, ctx: RouteContext): Promise<Response> {
  const { id } = await ctx.params;

  const wrappedHandler = withErrorHandler(
    requireOperatorAuth({})(async (_request: NextRequest, authCtx: OperatorAuthContext) => {
      const bus = await getOperatorBus(authCtx.operatorId, id);
      if (!bus) {
        return NextResponse.json({ error: 'not_found' }, { status: 404 });
      }
      return NextResponse.json({ bus });
    })
  );

  return wrappedHandler(req);
}

// ---------------------------------------------------------------------------
// PATCH — partial update with AC2/AC3/AC11 guards
// ---------------------------------------------------------------------------

export async function PATCH(req: NextRequest, ctx: RouteContext): Promise<Response> {
  const { id } = await ctx.params;

  const wrappedHandler = withErrorHandler(
    requireOperatorAuth({})(async (request: NextRequest, authCtx: OperatorAuthContext) => {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
      }

      const parsed = UpdateBusSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'invalid_input', issues: parsed.error.issues },
          { status: 400 }
        );
      }

      const patch: UpdateBusInput = parsed.data;

      // Wrap the entire guard + update in a serialisable transaction to prevent
      // TOCTOU races on capacity reduction (AC3). The FOR UPDATE lock on the Bus
      // row serialises concurrent PATCH requests for the same bus.
      let bus: Awaited<ReturnType<typeof updateBus>>;
      try {
        bus = await prisma.$transaction(async (tx) => {
          // 1. Lock the Bus row and enforce cross-op 404.
          // IDs are cuid (text) — no ::uuid cast needed.
          const locked = await tx.$queryRaw<{ id: string }[]>`
            SELECT id FROM "Bus"
            WHERE id = ${id} AND "operatorId" = ${authCtx.operatorId}
            FOR UPDATE
          `;
          if (locked.length === 0) {
            // Signal not_found via a well-typed error caught below.
            throw Object.assign(new Error('not_found'), { _busGuard: 'not_found' });
          }

          // 2. Re-read full row for AC11 guard + capacity math (uses index scan, already locked).
          const existing = await tx.bus.findUnique({
            where: { id },
            select: { capacity: true, deactivatedAt: true },
          });
          if (!existing) {
            throw Object.assign(new Error('not_found'), { _busGuard: 'not_found' });
          }
          if (existing.deactivatedAt !== null) {
            throw Object.assign(new Error('reactivation_not_supported'), {
              _busGuard: 'reactivation_not_supported',
            });
          }

          // 3. AC3 — capacity-reduction guard inside the transaction.
          if (patch.capacity !== undefined && patch.capacity < existing.capacity) {
            const now = new Date();
            const trips = await tx.trip.findMany({
              where: { busId: id, departureAt: { gt: now } },
              select: {
                id: true,
                holds: {
                  where: { status: 'active', expiresAt: { gt: now } },
                  select: { ticketCount: true },
                },
                bookings: {
                  where: { status: { in: PAID_STATUSES } },
                  select: { ticketCount: true },
                },
              },
            });
            const occupancy = trips.map((t) => ({
              tripId: t.id,
              heldSeats: t.holds.reduce((s, h) => s + h.ticketCount, 0),
              bookedSeats: t.bookings.reduce((s, b) => s + b.ticketCount, 0),
            }));
            const guard = canReduceCapacity(patch.capacity, occupancy);
            if (!guard.ok) {
              throw Object.assign(new Error('capacity_reduction_blocked'), {
                _busGuard: 'capacity_reduction_blocked',
                violatingTrips: guard.violatingTrips,
              });
            }
          }

          // 4. Perform the update inside the transaction (skip the ownership re-check
          //    in updateBus by calling tx.bus.update directly).
          try {
            return await tx.bus.update({
              where: { id },
              data: {
                ...(patch.licensePlate !== undefined ? { licensePlate: patch.licensePlate } : {}),
                ...(patch.capacity !== undefined ? { capacity: patch.capacity } : {}),
                ...(patch.busType !== undefined ? { busType: patch.busType } : {}),
              },
              select: {
                id: true,
                operatorId: true,
                licensePlate: true,
                capacity: true,
                busType: true,
              },
            });
          } catch (e) {
            const { Prisma } = await import('@prisma/client');
            if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
              throw new BusServiceError('plate_in_use');
            }
            throw e;
          }
        });
      } catch (e) {
        if (e instanceof BusServiceError && e.code === 'plate_in_use') {
          return NextResponse.json({ error: 'plate_in_use' }, { status: 422 });
        }
        const guard = e as { _busGuard?: string; violatingTrips?: unknown };
        if (guard._busGuard === 'not_found') {
          return NextResponse.json({ error: 'not_found' }, { status: 404 });
        }
        if (guard._busGuard === 'reactivation_not_supported') {
          return NextResponse.json({ error: 'reactivation_not_supported' }, { status: 422 });
        }
        if (guard._busGuard === 'capacity_reduction_blocked') {
          return NextResponse.json(
            { error: 'capacity_reduction_blocked', violatingTrips: guard.violatingTrips },
            { status: 422 }
          );
        }
        throw e;
      }

      if (!bus) {
        return NextResponse.json({ error: 'not_found' }, { status: 404 });
      }
      return NextResponse.json({ bus });
    })
  );

  return wrappedHandler(req);
}
