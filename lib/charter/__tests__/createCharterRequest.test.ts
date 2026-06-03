/**
 * Issue 082: unit tests for the customer charter-request create service.
 * resolveOrCreatePlace + createNotificationLog are mocked; the prisma client is a
 * minimal stub passed by parameter (no app singleton).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';

const { mockResolvePlace, mockCreateNotificationLog } = vi.hoisted(() => ({
  mockResolvePlace: vi.fn(),
  mockCreateNotificationLog: vi.fn(),
}));

vi.mock('@/lib/places/placeRepo', () => ({
  resolveOrCreatePlace: mockResolvePlace,
}));
vi.mock('@/lib/db/notificationLogRepo', () => ({
  createNotificationLog: mockCreateNotificationLog,
}));

import { createCharterRequest } from '../createCharterRequest';
import { CHARTER_REF_REGEX } from '../charterRef';

const baseInput = {
  contactName: 'Nguyễn Văn A',
  contactPhone: '0901234567',
  contactEmail: 'a@example.com',
  originName: 'Thanh Hoá',
  destinationNames: ['Sầm Sơn', 'Pù Luông'],
  startDate: new Date('2026-07-01T00:00:00Z'),
  passengers: 16,
  vehicleType: 'coach',
};

function makePrisma(createImpl: (args: unknown) => unknown) {
  return {
    charterRequest: { create: vi.fn(createImpl) },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockResolvePlace.mockResolvedValue({ id: 'place_origin_1', canonicalName: 'Thanh Hoá' });
  mockCreateNotificationLog.mockResolvedValue(undefined);
});

describe('createCharterRequest', () => {
  it('resolves the origin Place and stores its id', async () => {
    const prisma = makePrisma((args) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = (args as any).data;
      return { id: 'ch_1', ref: data.ref };
    });

    await createCharterRequest(prisma, baseInput);

    expect(mockResolvePlace).toHaveBeenCalledWith('Thanh Hoá');
    const data = prisma.charterRequest.create.mock.calls[0][0].data;
    expect(data.originPlaceId).toBe('place_origin_1');
  });

  it('stores destinations as a JSON string array (trimmed, blanks dropped)', async () => {
    const prisma = makePrisma((args) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = (args as any).data;
      return { id: 'ch_1', ref: data.ref };
    });

    await createCharterRequest(prisma, {
      ...baseInput,
      destinationNames: ['  Sầm Sơn  ', '', '  ', 'Pù Luông'],
    });

    const data = prisma.charterRequest.create.mock.calls[0][0].data;
    expect(data.destinations).toEqual(['Sầm Sơn', 'Pù Luông']);
  });

  it('creates the row in ADMIN_REVIEW (the submit IS SUBMITTED→ADMIN_REVIEW)', async () => {
    const prisma = makePrisma((args) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = (args as any).data;
      return { id: 'ch_1', ref: data.ref };
    });

    await createCharterRequest(prisma, baseInput);

    const data = prisma.charterRequest.create.mock.calls[0][0].data;
    expect(data.status).toBe('ADMIN_REVIEW');
  });

  it('generates a ref matching CHARTER_REF_REGEX and returns it', async () => {
    const prisma = makePrisma((args) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = (args as any).data;
      return { id: 'ch_1', ref: data.ref };
    });

    const result = await createCharterRequest(prisma, baseInput);

    expect(result.ref).toMatch(CHARTER_REF_REGEX);
    expect(result.charterId).toBe('ch_1');
  });

  it('retries on a ref unique-collision (P2002 on ref)', async () => {
    let calls = 0;
    const prisma = makePrisma((args) => {
      calls++;
      if (calls === 1) {
        const err = new Prisma.PrismaClientKnownRequestError('unique', {
          code: 'P2002',
          clientVersion: 'x',
          meta: { target: ['ref'] },
        });
        throw err;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = (args as any).data;
      return { id: 'ch_2', ref: data.ref };
    });

    const result = await createCharterRequest(prisma, baseInput);
    expect(calls).toBe(2);
    expect(result.charterId).toBe('ch_2');
  });

  it('enqueues the charterSubmitted confirmation on sms + email after create', async () => {
    const prisma = makePrisma((args) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = (args as any).data;
      return { id: 'ch_1', ref: data.ref };
    });

    const result = await createCharterRequest(prisma, baseInput);

    expect(mockCreateNotificationLog).toHaveBeenCalledTimes(2);
    const channels = mockCreateNotificationLog.mock.calls.map((c) => c[0].channel).sort();
    expect(channels).toEqual(['email', 'sms']);
    for (const call of mockCreateNotificationLog.mock.calls) {
      expect(call[0].template).toBe('charterSubmitted');
      expect(call[0].status).toBe('pending');
      expect(JSON.parse(call[0].payload)).toEqual({ ref: result.ref, contactName: 'Nguyễn Văn A' });
    }
    const recipients = mockCreateNotificationLog.mock.calls.map((c) => c[0].recipient).sort();
    expect(recipients).toEqual(['0901234567', 'a@example.com'].sort());
  });

  it('stores null customerId for a guest and the id for an attached customer', async () => {
    const prisma = makePrisma((args) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = (args as any).data;
      return { id: 'ch_1', ref: data.ref };
    });

    await createCharterRequest(prisma, baseInput); // guest (no customerId)
    expect(prisma.charterRequest.create.mock.calls[0][0].data.customerId).toBeNull();

    await createCharterRequest(prisma, { ...baseInput, customerId: 'cust_42' });
    expect(prisma.charterRequest.create.mock.calls[1][0].data.customerId).toBe('cust_42');
  });
});
