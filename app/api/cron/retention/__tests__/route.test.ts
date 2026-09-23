import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/jobs', () => ({
  runJob: vi.fn(),
  retentionSweeper: vi.fn(),
}));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { GET } from '../route';
import { runJob, retentionSweeper } from '@/lib/jobs';
import { NextRequest } from 'next/server';

function makeRequest(headers?: Record<string, string>): NextRequest {
  return new NextRequest('http://localhost/api/cron/retention', { method: 'GET', headers });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = 'test-cron-secret-0123456789';
});
afterEach(() => {
  delete process.env.CRON_SECRET;
});

describe('GET /api/cron/retention', () => {
  it('401s when the Authorization header is missing', async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    expect(runJob).not.toHaveBeenCalled();
  });

  it('401s when the Authorization header is wrong', async () => {
    const res = await GET(makeRequest({ authorization: 'Bearer wrong' }));
    expect(res.status).toBe(401);
    expect(runJob).not.toHaveBeenCalled();
  });

  it('401s (fail-closed) when CRON_SECRET is unset', async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(makeRequest({ authorization: 'Bearer anything' }));
    expect(res.status).toBe(401);
  });

  it('runs the sweeper under the exact lock key and returns its result verbatim', async () => {
    vi.mocked(runJob).mockResolvedValueOnce({ rowsAffected: 7, status: 'success' });
    const res = await GET(makeRequest({ authorization: `Bearer ${process.env.CRON_SECRET}` }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toEqual({ rowsAffected: 7, status: 'success' });
    // Lock-key typo would silently collide with another sweeper — pin it.
    expect(runJob).toHaveBeenCalledWith('retention-sweep', retentionSweeper);
  });

  it('passes through skipped_locked as 200 (concurrent tick)', async () => {
    vi.mocked(runJob).mockResolvedValueOnce({ rowsAffected: 0, status: 'skipped_locked' });
    const res = await GET(makeRequest({ authorization: `Bearer ${process.env.CRON_SECRET}` }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.status).toBe('skipped_locked');
  });

  it('maps a thrown error to an opaque 500 (never leaks internals)', async () => {
    vi.mocked(runJob).mockRejectedValueOnce(new Error('db exploded: secret in message'));
    const res = await GET(makeRequest({ authorization: `Bearer ${process.env.CRON_SECRET}` }));
    const json = await res.json();
    expect(res.status).toBe(500);
    expect(json).toEqual({ error: 'internal_error' });
  });
});
