import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/core/db/client', () => ({
  prisma: {
    hold: {
      count: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}));

vi.mock('@/lib/jobs/runJob', () => ({
  runJob: vi.fn(),
}));

vi.mock('@/lib/config', () => ({
  getEnv: vi.fn(() => ({ HOLD_SWEEPER_MODE: 'count' })),
}));

import { GET } from '../route';
import { prisma } from '@/lib/core/db/client';
import { runJob } from '@/lib/jobs';
import { getEnv } from '@/lib/config';
import { NextRequest } from 'next/server';

function makeRequest(headers?: Record<string, string>): NextRequest {
  return new NextRequest('http://localhost/api/cron/sweep-holds', {
    method: 'GET',
    headers,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = 'test-cron-secret-0123456789';
  vi.mocked(getEnv).mockReturnValue({ HOLD_SWEEPER_MODE: 'count' } as ReturnType<typeof getEnv>);
});

afterEach(() => {
  delete process.env.CRON_SECRET;
});

describe('GET /api/cron/sweep-holds', () => {
  describe('count mode (default)', () => {
    it('returns expiredCount without mutating DB', async () => {
      vi.mocked(prisma.hold.count).mockResolvedValueOnce(5);

      const req = makeRequest({ authorization: `Bearer ${process.env.CRON_SECRET}` });
      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.mode).toBe('count');
      expect(json.expiredCount).toBe(5);
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('uses count mode when HOLD_SWEEPER_MODE is not set', async () => {
      vi.mocked(prisma.hold.count).mockResolvedValueOnce(0);
      const req = makeRequest({ authorization: `Bearer ${process.env.CRON_SECRET}` });
      const res = await GET(req);
      const json = await res.json();
      expect(json.mode).toBe('count');
    });
  });

  describe('update mode', () => {
    it('delegates to runJob and returns expiredCount from rowsAffected', async () => {
      vi.mocked(getEnv).mockReturnValue({ HOLD_SWEEPER_MODE: 'update' } as ReturnType<typeof getEnv>);
      vi.mocked(runJob).mockResolvedValueOnce({ rowsAffected: 3, status: 'success' });

      const req = makeRequest({ authorization: `Bearer ${process.env.CRON_SECRET}` });
      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.mode).toBe('update');
      expect(json.expiredCount).toBe(3);
      expect(json.status).toBe('success');
      expect(runJob).toHaveBeenCalledWith('hold-expiry', expect.any(Function));
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
      vi.mocked(prisma.hold.count).mockResolvedValueOnce(0);

      const req = makeRequest({ authorization: `Bearer ${process.env.CRON_SECRET}` });
      const res = await GET(req);
      expect(res.status).toBe(200);
    });

    it('returns 401 when CRON_SECRET is not set', async () => {
      delete process.env.CRON_SECRET;
      const req = makeRequest();
      const res = await GET(req);
      expect(res.status).toBe(401);
    });
  });
});
