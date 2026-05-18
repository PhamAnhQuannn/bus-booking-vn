import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/db/client', () => ({
  prisma: {
    hold: {
      count: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}));

import { GET } from '../route';
import { prisma } from '@/lib/db/client';
import { NextRequest } from 'next/server';

function makeRequest(headers?: Record<string, string>): NextRequest {
  return new NextRequest('http://localhost/api/cron/sweep-holds', {
    method: 'GET',
    headers,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.CRON_SECRET;
  delete process.env.HOLD_SWEEPER_MODE;
});

afterEach(() => {
  delete process.env.CRON_SECRET;
  delete process.env.HOLD_SWEEPER_MODE;
});

describe('GET /api/cron/sweep-holds', () => {
  describe('count mode (default)', () => {
    it('returns expiredCount without mutating DB', async () => {
      vi.mocked(prisma.hold.count).mockResolvedValueOnce(5);

      const req = makeRequest();
      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.mode).toBe('count');
      expect(json.expiredCount).toBe(5);
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('uses count mode when HOLD_SWEEPER_MODE is not set', async () => {
      vi.mocked(prisma.hold.count).mockResolvedValueOnce(0);
      const req = makeRequest();
      const res = await GET(req);
      const json = await res.json();
      expect(json.mode).toBe('count');
    });
  });

  describe('update mode', () => {
    it('calls $queryRaw for update and returns expiredCount', async () => {
      process.env.HOLD_SWEEPER_MODE = 'update';
      vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([
        { id: 'id-1' },
        { id: 'id-2' },
        { id: 'id-3' },
      ] as never);

      const req = makeRequest();
      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.mode).toBe('update');
      expect(json.expiredCount).toBe(3);
      expect(prisma.hold.count).not.toHaveBeenCalled();
    });
  });

  describe('auth', () => {
    it('returns 401 when CRON_SECRET is set and header is missing', async () => {
      process.env.CRON_SECRET = 'my-secret';
      const req = makeRequest();
      const res = await GET(req);
      expect(res.status).toBe(401);
    });

    it('returns 401 when CRON_SECRET is set and header is wrong', async () => {
      process.env.CRON_SECRET = 'my-secret';
      const req = makeRequest({ authorization: 'Bearer wrong-secret' });
      const res = await GET(req);
      expect(res.status).toBe(401);
    });

    it('allows access when CRON_SECRET matches', async () => {
      process.env.CRON_SECRET = 'my-secret';
      process.env.HOLD_SWEEPER_MODE = 'count';
      vi.mocked(prisma.hold.count).mockResolvedValueOnce(0);

      const req = makeRequest({ authorization: 'Bearer my-secret' });
      const res = await GET(req);
      expect(res.status).toBe(200);
    });

    it('allows access when CRON_SECRET is not set (no auth required)', async () => {
      vi.mocked(prisma.hold.count).mockResolvedValueOnce(0);
      const req = makeRequest();
      const res = await GET(req);
      expect(res.status).toBe(200);
    });
  });
});
