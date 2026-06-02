import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/jobs/runJob', () => ({
  runJob: vi.fn(),
}));

import { GET } from '../route';
import { runJob } from '@/lib/jobs/runJob';
import { NextRequest } from 'next/server';

function makeRequest(headers?: Record<string, string>): NextRequest {
  return new NextRequest('http://localhost/api/cron/generate-trips', {
    method: 'GET',
    headers,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.CRON_SECRET;
  vi.mocked(runJob).mockResolvedValue({ rowsAffected: 0, status: 'success' });
});

afterEach(() => {
  delete process.env.CRON_SECRET;
});

describe('GET /api/cron/generate-trips', () => {
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
      process.env.CRON_SECRET = 'my-secret';
      const res = await GET(makeRequest({ authorization: 'Bearer my-secret' }));
      expect(res.status).toBe(200);
      expect(runJob).toHaveBeenCalledWith('trip-generate', expect.any(Function));
    });

    it('allows access when CRON_SECRET is not set (no auth required)', async () => {
      const res = await GET(makeRequest());
      expect(res.status).toBe(200);
    });
  });

  describe('advisory-lock + JobRunLog wrapper (Issue 043)', () => {
    it('runs generation through runJob with the trip-generate lock key', async () => {
      vi.mocked(runJob).mockResolvedValue({ rowsAffected: 3, status: 'success' });
      const res = await GET(makeRequest());
      expect(res.status).toBe(200);
      // Exactly one runJob call → exactly one JobRunLog row per run (runJob owns
      // the JobRunLog write; it is asserted to be invoked once here).
      expect(runJob).toHaveBeenCalledTimes(1);
      expect(runJob).toHaveBeenCalledWith('trip-generate', expect.any(Function));
      const body = await res.json();
      expect(body).toEqual({ rowsAffected: 3, status: 'success' });
    });

    it('surfaces skipped_locked from a concurrent tick that finds the lock held', async () => {
      // runJob → withAdvisoryLock returns skipped_locked when another tick holds
      // the advisory key; the route passes that result straight through.
      vi.mocked(runJob).mockResolvedValue({ rowsAffected: 0, status: 'skipped_locked' });
      const res = await GET(makeRequest());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ rowsAffected: 0, status: 'skipped_locked' });
    });

    it('returns 500 when runJob throws (JobRunLog failed row written by runJob)', async () => {
      vi.mocked(runJob).mockRejectedValue(new Error('boom'));
      const res = await GET(makeRequest());
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body).toEqual({ error: 'internal_error' });
    });
  });
});
