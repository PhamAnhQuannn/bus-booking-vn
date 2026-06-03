/**
 * Issue 083: unit tests for the operator-side charter queries.
 *
 * Asserts:
 *  - getAssignedCharters EXCLUDES customer contact (reveal-on-accept), filters on
 *    status=ASSIGNED_DIRECT + assigneeOperatorId, orders newest-first.
 *  - getAcceptedCharters INCLUDES customer contact, filters on status=ACCEPTED +
 *    assigneeOperatorId.
 *  - Both are scoped to the passed operatorId (no cross-operator leak).
 *
 * Prisma is mocked (passed by parameter — no app singleton).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const findMany = vi.fn();

const mockPrisma = {
  charterRequest: { findMany },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

import {
  getAssignedCharters,
  getAcceptedCharters,
  getPublicPoolCharters,
} from '../getOperatorCharters';

const OPERATOR_ID = 'op-org-A';

const BASE_ROW = {
  id: 'ch_1',
  ref: 'CH-2026-ABC123',
  destinations: ['Đà Lạt', 'Nha Trang'],
  startDate: new Date('2026-07-01T00:00:00Z'),
  endDate: new Date('2026-07-03T00:00:00Z'),
  durationDays: 3,
  passengers: 30,
  vehicleType: 'coach',
  budgetVnd: 15_000_000,
  notes: 'Cần xe đời mới',
  acceptByAt: new Date('2026-06-10T00:00:00Z'),
  createdAt: new Date('2026-06-01T00:00:00Z'),
  originPlace: { canonicalName: 'TP. Hồ Chí Minh' },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getAssignedCharters', () => {
  it('filters on ASSIGNED_DIRECT + assigneeOperatorId, newest-first', async () => {
    findMany.mockResolvedValue([BASE_ROW]);
    await getAssignedCharters(mockPrisma, OPERATOR_ID);

    expect(findMany).toHaveBeenCalledTimes(1);
    const args = findMany.mock.calls[0][0];
    expect(args.where).toEqual({ status: 'ASSIGNED_DIRECT', assigneeOperatorId: OPERATOR_ID });
    expect(args.orderBy).toEqual({ createdAt: 'desc' });
  });

  it('does NOT select customer contact fields (reveal-on-accept)', async () => {
    findMany.mockResolvedValue([BASE_ROW]);
    await getAssignedCharters(mockPrisma, OPERATOR_ID);

    const select = findMany.mock.calls[0][0].select;
    expect(select.contactName).toBeUndefined();
    expect(select.contactPhone).toBeUndefined();
    expect(select.contactEmail).toBeUndefined();
  });

  it('maps the row to the assigned DTO without any contact field', async () => {
    findMany.mockResolvedValue([BASE_ROW]);
    const result = await getAssignedCharters(mockPrisma, OPERATOR_ID);

    expect(result).toHaveLength(1);
    const item = result[0] as unknown as Record<string, unknown>;
    expect(item.originName).toBe('TP. Hồ Chí Minh');
    expect(item.destinations).toEqual(['Đà Lạt', 'Nha Trang']);
    expect(item.acceptByAt).toEqual(BASE_ROW.acceptByAt);
    // No contact leaks into the DTO.
    expect('contactName' in item).toBe(false);
    expect('contactPhone' in item).toBe(false);
    expect('contactEmail' in item).toBe(false);
  });

  it('coerces object-shaped destinations to their names', async () => {
    findMany.mockResolvedValue([
      { ...BASE_ROW, destinations: [{ name: 'Vũng Tàu' }, { placeId: 'x', name: 'Phan Thiết' }, 42] },
    ]);
    const result = await getAssignedCharters(mockPrisma, OPERATOR_ID);
    expect(result[0].destinations).toEqual(['Vũng Tàu', 'Phan Thiết']);
  });
});

describe('getAcceptedCharters', () => {
  const ACCEPTED_ROW = {
    ...BASE_ROW,
    contactName: 'Nguyễn Văn A',
    contactPhone: '+8490xxxxxx1',
    contactEmail: 'a@example.com',
  };

  it('filters on ACCEPTED + assigneeOperatorId', async () => {
    findMany.mockResolvedValue([ACCEPTED_ROW]);
    await getAcceptedCharters(mockPrisma, OPERATOR_ID);

    const args = findMany.mock.calls[0][0];
    expect(args.where).toEqual({ status: 'ACCEPTED', assigneeOperatorId: OPERATOR_ID });
  });

  it('INCLUDES customer contact in the select + the mapped DTO', async () => {
    findMany.mockResolvedValue([ACCEPTED_ROW]);
    const result = await getAcceptedCharters(mockPrisma, OPERATOR_ID);

    const select = findMany.mock.calls[0][0].select;
    expect(select.contactName).toBe(true);
    expect(select.contactPhone).toBe(true);
    expect(select.contactEmail).toBe(true);

    expect(result[0].contactName).toBe('Nguyễn Văn A');
    expect(result[0].contactPhone).toBe('+8490xxxxxx1');
    expect(result[0].contactEmail).toBe('a@example.com');
  });

  it('scopes to the passed operatorId (no cross-operator leak)', async () => {
    findMany.mockResolvedValue([]);
    await getAcceptedCharters(mockPrisma, 'op-org-B');
    expect(findMany.mock.calls[0][0].where.assigneeOperatorId).toBe('op-org-B');
  });
});

describe('getPublicPoolCharters', () => {
  const POOL_ROW = {
    ...BASE_ROW,
    claimByAt: new Date('2026-06-15T00:00:00Z'),
  };

  it('filters PUBLISHED + unclaimed + not-expired, newest-first', async () => {
    findMany.mockResolvedValue([POOL_ROW]);
    await getPublicPoolCharters(mockPrisma, {});

    const args = findMany.mock.calls[0][0];
    expect(args.where.status).toBe('PUBLISHED');
    expect(args.where.assigneeOperatorId).toBeNull();
    // claimByAt: null OR claimByAt > now (expired pool items excluded).
    expect(args.where.OR).toHaveLength(2);
    expect(args.where.OR[0]).toEqual({ claimByAt: null });
    expect(args.where.OR[1].claimByAt.gt).toBeInstanceOf(Date);
    expect(args.orderBy).toEqual({ createdAt: 'desc' });
  });

  it('does NOT select or expose any customer contact (pre-claim privacy)', async () => {
    findMany.mockResolvedValue([POOL_ROW]);
    const result = await getPublicPoolCharters(mockPrisma, {});

    const select = findMany.mock.calls[0][0].select;
    expect(select.contactName).toBeUndefined();
    expect(select.contactPhone).toBeUndefined();
    expect(select.contactEmail).toBeUndefined();

    const item = result[0] as unknown as Record<string, unknown>;
    expect('contactName' in item).toBe(false);
    expect('contactPhone' in item).toBe(false);
    expect('contactEmail' in item).toBe(false);
    // The summary + claimByAt deadline ARE exposed.
    expect(item.originName).toBe('TP. Hồ Chí Minh');
    expect(item.claimByAt).toEqual(POOL_ROW.claimByAt);
  });

  it('honors limit + cursor pagination', async () => {
    findMany.mockResolvedValue([]);
    await getPublicPoolCharters(mockPrisma, { limit: 10, cursor: 'ch_last' });

    const args = findMany.mock.calls[0][0];
    expect(args.take).toBe(10);
    expect(args.cursor).toEqual({ id: 'ch_last' });
    expect(args.skip).toBe(1);
  });

  it('defaults to limit 50 and no cursor', async () => {
    findMany.mockResolvedValue([]);
    await getPublicPoolCharters(mockPrisma, {});
    const args = findMany.mock.calls[0][0];
    expect(args.take).toBe(50);
    expect(args.cursor).toBeUndefined();
    expect(args.skip).toBeUndefined();
  });
});
