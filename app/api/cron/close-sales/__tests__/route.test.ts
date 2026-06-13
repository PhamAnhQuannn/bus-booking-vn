import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/jobs/runJob', () => ({
  runJob: vi.fn(),
}));

import { GET } from '../route';
import { runJob } from '@/lib/jobs';
import { NextRequest } from 'next/server';

function makeRequest(headers?: Record<string, string>): NextRequest {
  return new NextRequest('http://localhost/api/cron/close-sales', {
    method: 'GET',
    headers,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = 'test-cron-secret-0123456789';
  vi.mocked(runJob).mockResolvedValue({ rowsAffected: 0, status: 'success' });
});

afterEach(() => {
  delete process.env.CRON_SECRET;
});

describe('GET /api/cron/close-sales', () => {
  describe('auth', () => {
    it('returns 401 when CRON_SECRET is set and header is missing', async () => {
      process.env.CRON_SECRET = 'my-secret';
      const res = await GET(makeRequest());
      expect(res.status).toBe(401);
      expect(runJob).not.toHaveBeenCalled();
    });

    it('returns 401 when CRON_SECRET is set and header is wrong', async () => {
      process.env.CRON_SECRET = 'my-secret';
      const res = await GET(makeRequest({ authorization: 'Bearer wrong-secret' }));
      expect(res.status).toBe(401);
      expect(runJob).not.toHaveBeenCalled();
    });

    it('allows access when CRON_SECRET matches', async () => {
      const res = await GET(makeRequest({ authorization: `Bearer ${process.env.CRON_SECRET}` }));
      expect(res.status).toBe(200);
      expect(runJob).toHaveBeenCalledWith('sales-close', expect.any(Function));
    });

    it('returns 401 when CRON_SECRET is not set', async () => {
      delete process.env.CRON_SECRET;
      const res = await GET(makeRequest());
      expect(res.status).toBe(401);
      expect(runJob).not.toHaveBeenCalled();
    });
  });
});
