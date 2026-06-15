import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockSendReminders, mockJobRunLogCreate } = vi.hoisted(() => ({
  mockSendReminders: vi.fn(),
  mockJobRunLogCreate: vi.fn(),
}));

vi.mock('@/lib/jobs', () => ({
  sendReminders: mockSendReminders,
}));

vi.mock('@/lib/core/db/client', () => ({
  prisma: {
    jobRunLog: { create: mockJobRunLogCreate },
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));

import { GET } from '../route';
import { NextRequest } from 'next/server';

function makeRequest(headers?: Record<string, string>): NextRequest {
  return new NextRequest('http://localhost/api/cron/send-reminders', {
    method: 'GET',
    headers,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = 'test-cron-secret-0123456789';
  mockSendReminders.mockResolvedValue({ rowsAffected: 0, status: 'success' });
  mockJobRunLogCreate.mockResolvedValue({});
});

afterEach(() => {
  delete process.env.CRON_SECRET;
});

describe('GET /api/cron/send-reminders', () => {
  describe('auth', () => {
    it('returns 401 when CRON_SECRET is set and header is missing', async () => {
      process.env.CRON_SECRET = 'my-secret';
      const res = await GET(makeRequest());
      expect(res.status).toBe(401);
      expect(mockSendReminders).not.toHaveBeenCalled();
    });

    it('returns 401 when CRON_SECRET is set and header is wrong', async () => {
      process.env.CRON_SECRET = 'my-secret';
      const res = await GET(makeRequest({ authorization: 'Bearer wrong-secret' }));
      expect(res.status).toBe(401);
      expect(mockSendReminders).not.toHaveBeenCalled();
    });

    it('allows access when CRON_SECRET matches', async () => {
      const res = await GET(makeRequest({ authorization: `Bearer ${process.env.CRON_SECRET}` }));
      expect(res.status).toBe(200);
      expect(mockSendReminders).toHaveBeenCalledOnce();
    });

    it('returns 401 when CRON_SECRET is not set', async () => {
      delete process.env.CRON_SECRET;
      const res = await GET(makeRequest());
      expect(res.status).toBe(401);
      expect(mockSendReminders).not.toHaveBeenCalled();
    });
  });
});
