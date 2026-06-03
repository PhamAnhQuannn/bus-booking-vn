/**
 * Unit tests for GET /api/health (Issue 061, AC1).
 *
 * Mocks prisma.$queryRaw: resolves → 200 ok/up; throws → 503 degraded/down.
 * Asserts Cache-Control: no-store on both branches.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const queryRawMock = vi.fn();
vi.mock('@/lib/core/db/client', () => ({
  prisma: { $queryRaw: (...a: unknown[]) => queryRawMock(...a) },
}));

import { GET } from '../route';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/health', () => {
  it('returns 200 { status:ok, db:up } when the DB ping resolves', async () => {
    queryRawMock.mockResolvedValueOnce([{ '?column?': 1 }]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.db).toBe('up');
    expect(typeof body.ts).toBe('string');
    expect(queryRawMock).toHaveBeenCalledTimes(1);
  });

  it('returns 503 { status:degraded, db:down } when the DB ping throws', async () => {
    queryRawMock.mockRejectedValueOnce(new Error('connection refused'));
    const res = await GET();
    expect(res.status).toBe(503);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = await res.json();
    expect(body.status).toBe('degraded');
    expect(body.db).toBe('down');
    expect(typeof body.ts).toBe('string');
  });
});
