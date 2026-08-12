/**
 * Unit tests for generateTripsFromTemplates (Issue 013 AC5).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';

vi.mock('@/lib/core/db/client', () => {
  const txMock = {
    trip: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    recurringGenerationLog: {
      create: vi.fn(),
    },
  };

  return {
    prisma: {
      recurringTripTemplate: {
        findMany: vi.fn(),
      },
      recurringGenerationLog: {
        create: vi.fn(),
      },
      $transaction: vi.fn((fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock)),
      _txMock: txMock,
    },
  };
});

import { generateTripsFromTemplates } from '../generateFromTemplate';
import { prisma } from '@/lib/core/db/client';

const p = prisma as unknown as {
  recurringTripTemplate: { findMany: Mock };
  recurringGenerationLog: { create: Mock };
  $transaction: Mock;
  _txMock: {
    trip: { findFirst: Mock; create: Mock };
    recurringGenerationLog: { create: Mock };
  };
};

// Mon=1, Wed=4, Fri=16 → 1+4+16=21
const MONDAY_TEMPLATE = {
  id: 'tmpl-1',
  operatorId: 'op-1',
  routeId: 'route-1',
  busId: 'bus-1',
  price: 100000,
  departureLocalTime: '08:00',
  daysOfMask: 21, // Mon+Wed+Fri
  validFrom: new Date('2026-01-01'),
  validUntil: new Date('2026-12-31'),
  deactivatedAt: null,
  bus: {
    id: 'bus-1',
    deactivatedAt: null,
    maintenances: [],
  },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('generateTripsFromTemplates', () => {
  it('generates trips for matching days in horizon', async () => {
    p.recurringTripTemplate.findMany.mockResolvedValue([MONDAY_TEMPLATE]);
    p._txMock.trip.findFirst.mockResolvedValue(null); // no existing
    p._txMock.trip.create.mockResolvedValue({ id: 'new-trip-id' });
    p._txMock.recurringGenerationLog.create.mockResolvedValue({});

    // Use a known Monday as reference date: 2026-06-01 is a Monday
    const referenceDate = new Date('2026-06-01T00:00:00Z');
    const result = await generateTripsFromTemplates(referenceDate);

    // In 30 days from 2026-06-01 (Mon), Mon/Wed/Fri: Mon 1,8,15,22,29 (5) +
    // Wed 3,10,17,24 (4) + Fri 5,12,19,26 (4) = 13 trips.
    expect(result.generated).toBe(13);
    expect(result.skipped).toBe(0);
    expect(result.failed).toBe(0);
  });

  it('skips already-existing trips (idempotency)', async () => {
    p.recurringTripTemplate.findMany.mockResolvedValue([MONDAY_TEMPLATE]);
    // All trips already exist
    p._txMock.trip.findFirst.mockResolvedValue({ id: 'existing-trip' });
    p._txMock.recurringGenerationLog.create.mockResolvedValue({});

    const referenceDate = new Date('2026-06-01T00:00:00Z');
    const result = await generateTripsFromTemplates(referenceDate);

    expect(result.generated).toBe(0);
    expect(result.skipped).toBe(13); // all skipped as already_exists (30-day horizon)
  });

  it('skips trips when bus is in maintenance', async () => {
    const templateWithMaintBus = {
      ...MONDAY_TEMPLATE,
      bus: {
        id: 'bus-1',
        deactivatedAt: null,
        maintenances: [
          { startAt: new Date('2026-01-01T00:00:00Z'), endAt: new Date('2026-12-31T23:59:59Z') },
        ],
      },
    };
    p.recurringTripTemplate.findMany.mockResolvedValue([templateWithMaintBus]);
    p.recurringGenerationLog.create.mockResolvedValue({});

    const referenceDate = new Date('2026-06-01T00:00:00Z');
    const result = await generateTripsFromTemplates(referenceDate);

    expect(result.skipped).toBe(13);
    expect(result.generated).toBe(0);
  });

  it('returns zeros when no templates match', async () => {
    p.recurringTripTemplate.findMany.mockResolvedValue([]);

    const result = await generateTripsFromTemplates(new Date('2026-06-01T00:00:00Z'));

    expect(result.generated).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.failed).toBe(0);
  });
});
