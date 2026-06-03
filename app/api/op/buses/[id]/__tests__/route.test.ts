/**
 * Unit tests for /api/op/buses/[id] (GET + PATCH) — Issue 011.
 *
 * Coverage:
 *   GET  — happy path; AC6 cross-op → 404.
 *   PATCH — happy path; AC2 plate_in_use 422; AC3 capacity_reduction_blocked 422
 *           with violatingTrips[]; AC11 deactivated bus → 422 reactivation_not_supported;
 *           AC6 cross-op → 404.
 *
 * PATCH handler runs entirely inside prisma.$transaction — tests use mockTransaction
 * which invokes the callback with a fake tx object.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockVerifyOperatorAccess,
  mockOperatorFindUnique,
  mockBusFindFirst,
  mockBusUpdate,
  mockTripFindMany,
  mockTransaction,
  mockCookieStore,
} = vi.hoisted(() => ({
  mockVerifyOperatorAccess: vi.fn(),
  mockOperatorFindUnique: vi.fn(),
  mockBusFindFirst: vi.fn(),
  mockBusUpdate: vi.fn(),
  mockTripFindMany: vi.fn(),
  mockTransaction: vi.fn(),
  mockCookieStore: { get: vi.fn() },
}));

vi.mock('@/lib/auth/jwt', () => ({
  verifyAccess: vi.fn(),
  verifyOperatorAccess: mockVerifyOperatorAccess,
}));

vi.mock('@/lib/core/db/client', () => ({
  prisma: {
    operatorUser: { findUnique: mockOperatorFindUnique },
    bus: { findFirst: mockBusFindFirst, update: mockBusUpdate },
    trip: { findMany: mockTripFindMany },
    $transaction: mockTransaction,
  },
}));
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => mockCookieStore) }));

import { GET, PATCH } from '../route';
import { NextRequest } from 'next/server';

const OPERATOR_USER = {
  id: 'op-1',
  phone: '+8490xxxxxx1',
  displayName: 'Op Admin',
  requiresPasswordChange: false,
  disabledAt: null,
  operatorId: 'op-org-1',
};

function makeGet(id: string): { req: NextRequest; ctx: { params: Promise<{ id: string }> } } {
  return {
    req: new NextRequest(`http://localhost/api/op/buses/${id}`, {
      method: 'GET',
      headers: { Cookie: 'bb_op_access=valid-token' },
    }),
    ctx: { params: Promise.resolve({ id }) },
  };
}

function makePatch(id: string, body: unknown): { req: NextRequest; ctx: { params: Promise<{ id: string }> } } {
  return {
    req: new NextRequest(`http://localhost/api/op/buses/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: 'bb_op_access=valid-token' },
      body: JSON.stringify(body),
    }),
    ctx: { params: Promise.resolve({ id }) },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
  mockVerifyOperatorAccess.mockResolvedValue({
    sub: 'op-1',
    scope: 'operator',
    requiresPasswordChange: false,
    operatorId: 'op-org-1',
  });
  mockOperatorFindUnique.mockResolvedValue(OPERATOR_USER);
});

describe('GET /api/op/buses/[id]', () => {
  it('returns 200 { bus } with maintenance windows', async () => {
    mockBusFindFirst.mockResolvedValue({
      id: 'b1',
      operatorId: 'op-org-1',
      licensePlate: 'AAA-111',
      capacity: 30,
      busType: 'coach',
      deactivatedAt: null,
      maintenances: [],
    });
    const { req, ctx } = makeGet('b1');
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.bus.id).toBe('b1');
  });

  it('AC6: returns 404 for cross-op bus (findFirst returns null)', async () => {
    mockBusFindFirst.mockResolvedValue(null);
    const { req, ctx } = makeGet('b-other-op');
    const res = await GET(req, ctx);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe('not_found');
  });
});

// Helper: build a fake tx for $transaction tests.
// Matches the shape used by the PATCH handler inside the transaction callback.
function makeFakeTx(opts: {
  lockedRows?: { id: string }[];   // result of $queryRaw FOR UPDATE
  busRow?: { capacity: number; deactivatedAt: Date | null } | null;
  tripRows?: { id: string; holds: { ticketCount: number }[]; bookings: { ticketCount: number }[] }[];
  updateResult?: object;
  updateError?: Error;
}) {
  return {
    $queryRaw: vi.fn().mockResolvedValue(opts.lockedRows ?? [{ id: 'b1' }]),
    bus: {
      findUnique: vi.fn().mockResolvedValue(
        opts.busRow !== undefined
          ? opts.busRow
          : { capacity: 30, deactivatedAt: null }
      ),
      update: opts.updateError
        ? vi.fn().mockRejectedValue(opts.updateError)
        : vi.fn().mockResolvedValue(opts.updateResult ?? {
            id: 'b1', operatorId: 'op-org-1', licensePlate: 'AAA-111', capacity: 30, busType: 'sleeper',
          }),
    },
    trip: {
      findMany: vi.fn().mockResolvedValue(opts.tripRows ?? []),
    },
  };
}

describe('PATCH /api/op/buses/[id]', () => {
  it('returns 200 { bus } on simple busType update', async () => {
    const fakeTx = makeFakeTx({
      updateResult: { id: 'b1', operatorId: 'op-org-1', licensePlate: 'AAA-111', capacity: 30, busType: 'sleeper' },
    });
    mockTransaction.mockImplementationOnce((fn: (tx: typeof fakeTx) => Promise<unknown>) => fn(fakeTx));

    const { req, ctx } = makePatch('b1', { busType: 'sleeper' });
    const res = await PATCH(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.bus.busType).toBe('sleeper');
  });

  it('AC11: returns 422 reactivation_not_supported when bus is deactivated', async () => {
    const fakeTx = makeFakeTx({ busRow: { capacity: 30, deactivatedAt: new Date() } });
    mockTransaction.mockImplementationOnce((fn: (tx: typeof fakeTx) => Promise<unknown>) => fn(fakeTx));

    const { req, ctx } = makePatch('b1', { busType: 'sleeper' });
    const res = await PATCH(req, ctx);
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toBe('reactivation_not_supported');
  });

  it('AC6: returns 404 for cross-op bus (FOR UPDATE returns 0 rows)', async () => {
    const fakeTx = makeFakeTx({ lockedRows: [] });
    mockTransaction.mockImplementationOnce((fn: (tx: typeof fakeTx) => Promise<unknown>) => fn(fakeTx));

    const { req, ctx } = makePatch('b-other-op', { busType: 'sleeper' });
    const res = await PATCH(req, ctx);
    expect(res.status).toBe(404);
  });

  it('AC2: returns 422 plate_in_use on P2002', async () => {
    const { Prisma } = await import('@prisma/client');
    const err = new Prisma.PrismaClientKnownRequestError('unique violation', {
      code: 'P2002',
      clientVersion: 'test',
    });
    const fakeTx = makeFakeTx({ updateError: err });
    mockTransaction.mockImplementationOnce((fn: (tx: typeof fakeTx) => Promise<unknown>) => fn(fakeTx));

    const { req, ctx } = makePatch('b1', { licensePlate: 'BBB-222' });
    const res = await PATCH(req, ctx);
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toBe('plate_in_use');
  });

  it('AC3: returns 422 capacity_reduction_blocked with violatingTrips when occupancy exceeds new capacity', async () => {
    const fakeTx = makeFakeTx({
      busRow: { capacity: 30, deactivatedAt: null },
      // Trip with 15 held + 10 booked = 25 occupancy, exceeds new capacity 20
      tripRows: [
        { id: 't1', holds: [{ ticketCount: 15 }], bookings: [{ ticketCount: 10 }] },
      ],
    });
    mockTransaction.mockImplementationOnce((fn: (tx: typeof fakeTx) => Promise<unknown>) => fn(fakeTx));

    const { req, ctx } = makePatch('b1', { capacity: 20 });
    const res = await PATCH(req, ctx);
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toBe('capacity_reduction_blocked');
    expect(json.violatingTrips).toEqual([{ tripId: 't1', occupancy: 25 }]);
    expect(fakeTx.bus.update).not.toHaveBeenCalled();
  });

  it('AC3: capacity reduction proceeds when no trip exceeds new capacity', async () => {
    const fakeTx = makeFakeTx({
      busRow: { capacity: 30, deactivatedAt: null },
      tripRows: [
        { id: 't1', holds: [{ ticketCount: 5 }], bookings: [{ ticketCount: 5 }] },
      ],
      updateResult: { id: 'b1', operatorId: 'op-org-1', licensePlate: 'AAA-111', capacity: 20, busType: 'coach' },
    });
    mockTransaction.mockImplementationOnce((fn: (tx: typeof fakeTx) => Promise<unknown>) => fn(fakeTx));

    const { req, ctx } = makePatch('b1', { capacity: 20 });
    const res = await PATCH(req, ctx);
    expect(res.status).toBe(200);
  });

  it('returns 400 on invalid_input (empty patch)', async () => {
    const { req, ctx } = makePatch('b1', {});
    const res = await PATCH(req, ctx);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('invalid_input');
  });
});
