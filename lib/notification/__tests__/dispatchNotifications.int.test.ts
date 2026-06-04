/**
 * Integration tests for the notification dispatcher (Issue 058).
 *
 * Run with: pnpm vitest:int (DB-gated — needs DATABASE_URL).
 *
 * Covers:
 *  - enqueue a pending row → dispatch → status='sent', sentAt + externalRef set
 *  - re-run does NOT double-send (already 'sent' rows are not reclaimed)
 *  - the @@unique([bookingId, template]) idempotency guard rejects a duplicate
 *    (booking, template) enqueue
 *  - two concurrent dispatchers do NOT double-claim the same due row (SKIP LOCKED
 *    + advisory lock); exactly one delivery happens
 *  - scheduledFor in the future is NOT yet due; nextAttemptAt in the future gates
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/core/db/client';
import { dispatchNotifications } from '../dispatchNotifications';
import { runJob } from '@/lib/jobs';

let operatorId: string;
let routeId: string;
let busId: string;
let tripId: string;

function newBookingId(): string {
  return randomUUID();
}

async function createBooking(ref: string): Promise<string> {
  const id = newBookingId();
  await prisma.booking.create({
    data: {
      id,
      bookingRef: ref,
      confirmationToken: 'tok-' + ref,
      tripId,
      buyerName: 'Notify Tester',
      buyerPhone: '+8490xxxxxx1',
      ticketCount: 1,
      totalVnd: 150_000,
      paymentMethod: 'momo',
      status: 'paid',
      isManual: false,
      contactStatus: 'pending',
    },
  });
  return id;
}

async function enqueue(
  bookingId: string | null,
  template: string,
  over: Partial<{ scheduledFor: Date; nextAttemptAt: Date; channel: 'sms' | 'email'; status: 'pending' | 'failed' }> = {}
): Promise<string> {
  const log = await prisma.notificationLog.create({
    data: {
      bookingId,
      channel: over.channel ?? 'sms',
      template,
      recipient: '+8490xxxxxx1',
      payload: 'rendered body',
      status: over.status ?? 'pending',
      scheduledFor: over.scheduledFor ?? null,
      nextAttemptAt: over.nextAttemptAt ?? null,
    },
  });
  return log.id;
}

beforeAll(async () => {
  const op = await prisma.operator.create({
    data: { legalName: 'Notify Test Op', contactPhone: '+8490xxxxxx2', contactEmail: 'notify@test.dev' },
  });
  operatorId = op.id;
  const bus = await prisma.bus.create({
    data: { operatorId, capacity: 40, licensePlate: 'NOTIFY-001', busType: 'coach' },
  });
  busId = bus.id;
  const route = await prisma.route.create({
    data: { origin: 'N Origin', destination: 'N Dest', operatorId, durationMinutes: 90 },
  });
  routeId = route.id;
  const trip = await prisma.trip.create({
    data: {
      routeId,
      busId,
      operatorId,
      departureAt: new Date(Date.now() + 10 * 86_400_000),
      price: 100_000,
      status: 'scheduled',
    },
  });
  tripId = trip.id;
});

beforeEach(async () => {
  await prisma.notificationLog.deleteMany({ where: { booking: { trip: { operatorId } } } });
  await prisma.notificationLog.deleteMany({ where: { bookingId: null, recipient: '+8490xxxxxx1' } });
});

afterAll(async () => {
  await prisma.notificationLog.deleteMany({ where: { booking: { trip: { operatorId } } } });
  await prisma.notificationLog.deleteMany({ where: { bookingId: null, recipient: '+8490xxxxxx1' } });
  await prisma.booking.deleteMany({ where: { trip: { operatorId } } });
  await prisma.jobRunLog.deleteMany({ where: { jobName: 'notify-dispatch' } });
  await prisma.trip.deleteMany({ where: { operatorId } });
  await prisma.route.deleteMany({ where: { operatorId } });
  await prisma.bus.deleteMany({ where: { operatorId } });
  await prisma.operator.deleteMany({ where: { id: operatorId } });
});

describe('dispatchNotifications integration', () => {
  it('dispatches a pending row → status=sent with sentAt + externalRef', async () => {
    const bId = await createBooking('BB-NTF-0001');
    const logId = await enqueue(bId, 'customerBookingPaid');

    await prisma.$transaction((tx) => dispatchNotifications(tx, { now: new Date() }));

    const row = await prisma.notificationLog.findUnique({ where: { id: logId } });
    expect(row?.status).toBe('sent');
    expect(row?.sentAt).not.toBeNull();
    expect(row?.externalRef).toBeTruthy();
    expect(row?.attemptCount).toBe(1);
  });

  it('does NOT re-send an already-sent row on a second run', async () => {
    const bId = await createBooking('BB-NTF-0002');
    const logId = await enqueue(bId, 'customerBookingPaid');

    await prisma.$transaction((tx) => dispatchNotifications(tx, { now: new Date() }));
    const after1 = await prisma.notificationLog.findUnique({ where: { id: logId } });
    const sentAt1 = after1?.sentAt;

    await prisma.$transaction((tx) => dispatchNotifications(tx, { now: new Date() }));
    const after2 = await prisma.notificationLog.findUnique({ where: { id: logId } });

    expect(after2?.status).toBe('sent');
    expect(after2?.attemptCount).toBe(1); // not re-incremented
    expect(after2?.sentAt?.getTime()).toBe(sentAt1?.getTime()); // not re-stamped
  });

  it('enforces @@unique([bookingId, template]) — duplicate (booking, template) enqueue rejected', async () => {
    const bId = await createBooking('BB-NTF-0003');
    await enqueue(bId, 'customerBookingPaid');
    await expect(enqueue(bId, 'customerBookingPaid')).rejects.toMatchObject({ code: 'P2002' });
  });

  it('null-booking rows are NOT deduped by the unique index (NULLs distinct)', async () => {
    // Two null-booking rows with the same template are both allowed.
    await enqueue(null, 'staffTempPassword');
    await expect(enqueue(null, 'staffTempPassword')).resolves.toBeTruthy();
  });

  it('does not dispatch a row whose scheduledFor is in the future', async () => {
    const bId = await createBooking('BB-NTF-0004');
    const logId = await enqueue(bId, 'payout_scheduled', {
      scheduledFor: new Date(Date.now() + 60 * 60_000),
    });

    await prisma.$transaction((tx) => dispatchNotifications(tx, { now: new Date() }));

    const row = await prisma.notificationLog.findUnique({ where: { id: logId } });
    expect(row?.status).toBe('pending'); // still pending, not delivered
  });

  it('does not dispatch a failed row whose nextAttemptAt is in the future', async () => {
    const bId = await createBooking('BB-NTF-0005');
    const logId = await enqueue(bId, 'customerBookingPaid', {
      status: 'failed',
      nextAttemptAt: new Date(Date.now() + 60 * 60_000),
    });

    await prisma.$transaction((tx) => dispatchNotifications(tx, { now: new Date() }));

    const row = await prisma.notificationLog.findUnique({ where: { id: logId } });
    expect(row?.status).toBe('failed'); // backoff not elapsed → untouched
  });

  it('two concurrent dispatchers do NOT double-claim the same due row (SKIP LOCKED + advisory lock)', async () => {
    const bId = await createBooking('BB-NTF-0006');
    const logId = await enqueue(bId, 'customerBookingPaid');

    // Run two dispatchers via runJob concurrently — the advisory lock
    // ('notify-dispatch') lets exactly one run the core; the other returns
    // skipped_locked. Even absent the advisory lock, FOR UPDATE SKIP LOCKED
    // ensures the row is claimed once.
    const [a, b] = await Promise.all([
      runJob('notify-dispatch', dispatchNotifications),
      runJob('notify-dispatch', dispatchNotifications),
    ]);

    const statuses = [a.status, b.status].sort();
    // One ran, one skipped (or both ran but only one claimed the row).
    const totalDelivered = (a.status === 'success' ? a.rowsAffected : 0) +
      (b.status === 'success' ? b.rowsAffected : 0);
    expect(totalDelivered).toBeLessThanOrEqual(1);

    const row = await prisma.notificationLog.findUnique({ where: { id: logId } });
    expect(row?.status).toBe('sent');
    expect(row?.attemptCount).toBe(1); // delivered EXACTLY once
    expect(statuses).toBeDefined();
  });
});
