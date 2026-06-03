/**
 * Issue 090 (AC5): integration test for the retention sweeper — real DB + stub storage.
 * Requires DATABASE_URL (run via `pnpm vitest:int`).
 *
 * Seeds:
 *   - an OLD guest booking (customerId NULL, trip departed > 365d ago) → must be scrubbed
 *   - a RECENT guest booking (trip in the future)                      → must be untouched
 *   - an expired KYB doc (operator REJECTED, uploadedAt > 90d ago)     → must be purged
 *
 * Runs the sweeper via runJob (the real 'retention-sweep' advisory lock + JobRunLog
 * path) and asserts the outcomes. The sweeper uses NOW(); the old booking's trip is
 * back-dated well past the window so it's eligible without clock injection.
 */

import crypto from 'crypto';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/db/client';
import { _resetEnvCache } from '@/lib/config/env';
import { putObject, type StorageClient } from '@/lib/storage';
import { getStubBlob } from '@/lib/storage/stubStore';
import { runJob } from '../runJob';
import { retentionSweeper } from '../retentionSweeper';

const db = prisma as unknown as StorageClient;

const DAY = 86_400_000;
const ids = {
  operator: '',
  rejectedOperator: '',
  route: '',
  bus: '',
  oldTrip: '',
  recentTrip: '',
  oldBooking: crypto.randomUUID(),
  recentBooking: crypto.randomUUID(),
  kybExpired: '',
};
const kybKey = `kyb_doc/${crypto.randomUUID()}/license.pdf`;

beforeAll(async () => {
  process.env.STORAGE_STUB = 'true';
  process.env.STORAGE_STUB_SECRET = 'int-test-storage-secret-0123456789';
  _resetEnvCache();

  const operator = await prisma.operator.create({
    data: { legalName: 'Retn Active Op', contactPhone: '+8490xxxxxx7', contactEmail: 'a@retn.dev' },
  });
  ids.operator = operator.id;

  const rejected = await prisma.operator.create({
    data: {
      legalName: 'Retn Rejected Op',
      contactPhone: '+8490xxxxxx8',
      contactEmail: 'r@retn.dev',
      status: 'REJECTED',
    },
  });
  ids.rejectedOperator = rejected.id;

  const route = await prisma.route.create({
    data: { origin: 'RA', destination: 'RB', operatorId: operator.id, durationMinutes: 120 },
  });
  ids.route = route.id;
  const bus = await prisma.bus.create({
    data: { operatorId: operator.id, capacity: 40, licensePlate: 'RETN-01', busType: 'coach' },
  });
  ids.bus = bus.id;

  const oldTrip = await prisma.trip.create({
    data: {
      routeId: route.id,
      busId: bus.id,
      operatorId: operator.id,
      departureAt: new Date(Date.now() - 400 * DAY), // > 365d ago
      price: 100000,
    },
  });
  ids.oldTrip = oldTrip.id;
  const recentTrip = await prisma.trip.create({
    data: {
      routeId: route.id,
      busId: bus.id,
      operatorId: operator.id,
      departureAt: new Date(Date.now() + 7 * DAY), // future
      price: 100000,
    },
  });
  ids.recentTrip = recentTrip.id;

  await prisma.booking.create({
    data: {
      id: ids.oldBooking,
      bookingRef: 'BB-2026-rold-0001',
      confirmationToken: 'tok-retn-old-' + ids.oldBooking,
      tripId: oldTrip.id,
      customerId: null, // GUEST
      buyerName: 'Old Guest',
      buyerPhone: '+8490xxxxxx6',
      buyerEmail: 'oldguest@real.dev',
      ticketCount: 2,
      totalVnd: 200000,
      paymentMethod: 'momo',
    },
  });
  await prisma.booking.create({
    data: {
      id: ids.recentBooking,
      bookingRef: 'BB-2026-rnew-0001',
      confirmationToken: 'tok-retn-new-' + ids.recentBooking,
      tripId: recentTrip.id,
      customerId: null, // GUEST
      buyerName: 'Recent Guest',
      buyerPhone: '+8490xxxxxx5',
      buyerEmail: 'recentguest@real.dev',
      ticketCount: 1,
      totalVnd: 100000,
      paymentMethod: 'momo',
    },
  });

  // Expired KYB doc: store bytes + pointer row + KybDocument row, then back-date uploadedAt.
  await putObject(db, kybKey, 'application/pdf', Buffer.from('%PDF-1.4 expired kyb'));
  const kyb = await prisma.kybDocument.create({
    data: { operatorId: rejected.id, type: 'business_license', storageKey: kybKey, status: 'rejected' },
  });
  ids.kybExpired = kyb.id;
  await prisma.$executeRaw`UPDATE "KybDocument" SET "uploadedAt" = NOW() - INTERVAL '120 days' WHERE "id" = ${kyb.id}`;
});

afterAll(async () => {
  await prisma.kybDocument.deleteMany({ where: { id: ids.kybExpired } });
  await prisma.storedObject.deleteMany({ where: { key: kybKey } });
  await prisma.booking.deleteMany({
    where: { id: { in: [ids.oldBooking, ids.recentBooking] } },
  });
  await prisma.trip.deleteMany({ where: { id: { in: [ids.oldTrip, ids.recentTrip] } } });
  await prisma.bus.deleteMany({ where: { id: ids.bus } });
  await prisma.route.deleteMany({ where: { id: ids.route } });
  await prisma.operator.deleteMany({
    where: { id: { in: [ids.operator, ids.rejectedOperator] } },
  });
});

describe('retentionSweeper integration (AC5)', () => {
  it('scrubs the old guest booking, leaves the recent one, purges the expired KYB doc', async () => {
    expect(getStubBlob(kybKey)).toBeDefined();

    const result = await runJob('retention-sweep', retentionSweeper);
    expect(result.status).toBe('success');
    expect(result.rowsAffected).toBeGreaterThanOrEqual(2); // old booking + kyb doc

    // OLD guest booking scrubbed; money retained.
    const oldB = await prisma.booking.findUnique({ where: { id: ids.oldBooking } });
    expect(oldB?.buyerName).toBe('[expired]');
    expect(oldB?.buyerPhone).toBe('+8490xxxxxx0');
    expect(oldB?.buyerEmail).toBeNull();
    expect(oldB?.snapshotAnonymizedAt).toBeInstanceOf(Date);
    expect(oldB?.totalVnd).toBe(200000);
    expect(oldB?.ticketCount).toBe(2);

    // RECENT guest booking untouched.
    const recentB = await prisma.booking.findUnique({ where: { id: ids.recentBooking } });
    expect(recentB?.buyerName).toBe('Recent Guest');
    expect(recentB?.buyerPhone).toBe('+8490xxxxxx5');
    expect(recentB?.snapshotAnonymizedAt).toBeNull();

    // Expired KYB doc purged: storage object gone + pointer row gone + purgedAt set.
    const kyb = await prisma.kybDocument.findUnique({ where: { id: ids.kybExpired } });
    expect(kyb?.purgedAt).toBeInstanceOf(Date);
    expect(getStubBlob(kybKey)).toBeUndefined();
    const pointer = await prisma.storedObject.findUnique({ where: { key: kybKey } });
    expect(pointer).toBeNull();
  });
});
