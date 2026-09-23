import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/jobs', () => ({
  runJob: vi.fn(),
  anonymizeCustomers: vi.fn(),
}));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { GET } from '../route';
import { runJob, anonymizeCustomers } from '@/lib/jobs';
import { NextRequest } from 'next/server';

function makeRequest(headers?: Record<string, string>): NextRequest {
  return new NextRequest('http://localhost/api/cron/anonymize-customers', { method: 'GET', headers });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = 'test-cron-secret-0123456789';
});
afterEach(() => {
  delete process.env.CRON_SECRET;
});

describe('GET /api/cron/anonymize-customers', () => {
  it('401s when the Authorization header is missing', async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    expect(runJob).not.toHaveBeenCalled();
  });

  it('401s (fail-closed) when CRON_SECRET is unset', async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(makeRequest({ authorization: 'Bearer anything' }));
    expect(res.status).toBe(401);
  });

  it('runs the anonymizer under the exact lock key and returns its result verbatim', async () => {
    vi.mocked(runJob).mockResolvedValueOnce({ rowsAffected: 4, status: 'success' });
    const res = await GET(makeRequest({ authorization: `Bearer ${process.env.CRON_SECRET}` }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toEqual({ rowsAffected: 4, status: 'success' });
    expect(runJob).toHaveBeenCalledWith('customer-pii-anonymize', anonymizeCustomers);
  });

  it('passes through skipped_locked as 200', async () => {
    vi.mocked(runJob).mockResolvedValueOnce({ rowsAffected: 0, status: 'skipped_locked' });
    const res = await GET(makeRequest({ authorization: `Bearer ${process.env.CRON_SECRET}` }));
    expect((await res.json()).status).toBe('skipped_locked');
    expect(res.status).toBe(200);
  });

  it('maps a thrown error to an opaque 500', async () => {
    vi.mocked(runJob).mockRejectedValueOnce(new Error('boom'));
    const res = await GET(makeRequest({ authorization: `Bearer ${process.env.CRON_SECRET}` }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'internal_error' });
  });
});
