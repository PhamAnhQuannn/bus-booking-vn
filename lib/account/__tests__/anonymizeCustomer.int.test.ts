/**
 * Integration tests for lib/account/anonymizeCustomer.ts (Issue 008 AC5).
 *
 * Uses real DB — requires DATABASE_URL in env.
 * PII-safe phone: +8490xxxxxx4
 */

import crypto from 'crypto';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/db/client';
import { hash as hashPassword } from '@/lib/auth/password';
import { deleteAccount } from '../anonymizeCustomer';

const TEST_PHONE = '+8490xxxxxx4';

let customerId: string;

beforeAll(async () => {
  const ph = await hashPassword('TestPass1!');
  const customer = await prisma.customer.create({
    data: {
      phone: TEST_PHONE,
      passwordHash: ph,
      displayName: 'Test User Del',
    },
  });
  customerId = customer.id;
});

afterAll(async () => {
  // Clean up — note phone is NULL after delete, so find by id
  await prisma.session.deleteMany({ where: { customerId } });
  await prisma.customer.delete({ where: { id: customerId } }).catch(() => {});
});

describe('deleteAccount', () => {
  it('AC5: sets deletedAt, anonymizedAt, nullifies phone', async () => {
    const result = await deleteAccount(customerId);
    expect(result.alreadyDeleted).toBe(false);
    expect(result.customer.deletedAt).toBeInstanceOf(Date);
    expect(result.customer.anonymizedAt).toBeInstanceOf(Date);
    expect(result.customer.phone).toBeNull();
  });

  it('AC5: idempotent — second call returns alreadyDeleted=true with 200', async () => {
    const result = await deleteAccount(customerId);
    expect(result.alreadyDeleted).toBe(true);
  });

  it('Issue 090 AC4: scrubs the guest snapshot on the customer bookings (money retained)', async () => {
    // Fresh customer + a route/trip/booking owned by them.
    const ph = await hashPassword('TestPass3!');
    const c = await prisma.customer.create({
      data: { phone: '+8490xxxxxx6', passwordHash: ph, displayName: 'Booker' },
    });

    const operator = await prisma.operator.create({
      data: { legalName: 'Retention Op', contactPhone: '+8490xxxxxx7', contactEmail: 'r@op.dev' },
    });
    const route = await prisma.route.create({
      data: { origin: 'A', destination: 'B', operatorId: operator.id, durationMinutes: 120 },
    });
    const bus = await prisma.bus.create({
      data: { operatorId: operator.id, capacity: 40, licensePlate: 'RET-001', busType: 'coach' },
    });
    const trip = await prisma.trip.create({
      data: {
        routeId: route.id,
        busId: bus.id,
        operatorId: operator.id,
        departureAt: new Date(Date.now() + 86400000),
        price: 100000,
      },
    });
    const booking = await prisma.booking.create({
      data: {
        id: crypto.randomUUID(),
        bookingRef: 'BB-2026-rete-ntn0',
        confirmationToken: 'tok-retention-' + c.id,
        tripId: trip.id,
        customerId: c.id,
        buyerName: 'Real Name',
        buyerPhone: '+8490xxxxxx6',
        buyerEmail: 'booker@real.dev',
        ticketCount: 2,
        totalVnd: 200000,
        paymentMethod: 'cash',
      },
    });

    await deleteAccount(c.id);

    const scrubbed = await prisma.booking.findUnique({ where: { id: booking.id } });
    // PII scrubbed
    expect(scrubbed?.buyerName).toBe('[deleted]');
    expect(scrubbed?.buyerPhone).toBe('+8490xxxxxx0');
    expect(scrubbed?.buyerEmail).toBeNull();
    expect(scrubbed?.snapshotAnonymizedAt).toBeInstanceOf(Date);
    // Money/audit retained (S04)
    expect(scrubbed?.totalVnd).toBe(200000);
    expect(scrubbed?.ticketCount).toBe(2);
    expect(scrubbed?.status).toBe('awaiting_payment');

    // Cleanup
    await prisma.booking.delete({ where: { id: booking.id } });
    await prisma.trip.delete({ where: { id: trip.id } });
    await prisma.bus.delete({ where: { id: bus.id } });
    await prisma.route.delete({ where: { id: route.id } });
    await prisma.operator.delete({ where: { id: operator.id } });
    await prisma.session.deleteMany({ where: { customerId: c.id } });
    await prisma.customer.delete({ where: { id: c.id } }).catch(() => {});
  });

  it('AC5: revokes all sessions on delete', async () => {
    // Create new customer to test session revocation
    const ph2 = await hashPassword('TestPass2!');
    const c2 = await prisma.customer.create({
      data: {
        phone: '+8490xxxxxx5',
        passwordHash: ph2,
        displayName: 'Test User Del2',
      },
    });

    await prisma.session.create({
      data: {
        customerId: c2.id,
        refreshTokenHash: 'anon-test-hash-' + c2.id,
        tokenFamily: 'anon-test-family',
        rotationCount: 0,
        expiresAt: new Date(Date.now() + 86400000),
      },
    });

    await deleteAccount(c2.id);

    const sessions = await prisma.session.findMany({
      where: { customerId: c2.id, revokedAt: null },
    });
    expect(sessions.length).toBe(0);

    // Cleanup
    await prisma.session.deleteMany({ where: { customerId: c2.id } });
    await prisma.customer.delete({ where: { id: c2.id } }).catch(() => {});
  });
});
