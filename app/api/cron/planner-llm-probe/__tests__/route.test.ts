// Route test cho drift probe cron (PR-10). Mock probePlannerProviders (barrel) → không fetch thật.
// Auth theo pattern sibling (sweep-holds): assertCronAuth THẬT, điều khiển qua process.env.CRON_SECRET.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/trip-planner/lib/planner', () => ({
  probePlannerProviders: vi.fn(),
}));

vi.mock('@/lib/observability', () => ({
  captureException: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { GET } from '../route';
import { probePlannerProviders } from '@/trip-planner/lib/planner';
import { captureException } from '@/lib/observability';
import { logger } from '@/lib/logger';
import { NextRequest } from 'next/server';

type ProbeResult = Awaited<ReturnType<typeof probePlannerProviders>>[number];

function makeRequest(headers?: Record<string, string>): NextRequest {
  return new NextRequest('http://localhost/api/cron/planner-llm-probe', {
    method: 'GET',
    headers,
  });
}

const authed = () => makeRequest({ authorization: `Bearer ${process.env.CRON_SECRET}` });
const groq = (status: ProbeResult['status']): ProbeResult => ({ provider: 'groq', model: 'openai/gpt-oss-20b', status });
const gemini = (status: ProbeResult['status']): ProbeResult => ({ provider: 'gemini', model: 'gemini-3.5-flash', status });

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = 'test-cron-secret-0123456789';
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-18T06:00:00Z')); // mặc định slot KHÔNG phải đầu ngày
  vi.mocked(probePlannerProviders).mockResolvedValue([groq('ok')]);
});

afterEach(() => {
  vi.useRealTimers();
  delete process.env.CRON_SECRET;
});

describe('GET /api/cron/planner-llm-probe', () => {
  describe('auth', () => {
    it('returns 401 when header is missing', async () => {
      const res = await GET(makeRequest());
      expect(res.status).toBe(401);
      expect(probePlannerProviders).not.toHaveBeenCalled();
    });

    it('returns 401 when header is wrong', async () => {
      const res = await GET(makeRequest({ authorization: 'Bearer wrong-secret' }));
      expect(res.status).toBe(401);
      expect(probePlannerProviders).not.toHaveBeenCalled();
    });

    it('returns 401 when CRON_SECRET is not set', async () => {
      delete process.env.CRON_SECRET;
      const res = await GET(makeRequest());
      expect(res.status).toBe(401);
    });

    it('allows access when CRON_SECRET matches', async () => {
      const res = await GET(authed());
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ results: [groq('ok')] });
    });
  });

  describe('rate-cap gate (Gemini 1/ngày)', () => {
    it('UTC hour 0 → probes both groq + gemini', async () => {
      vi.setSystemTime(new Date('2026-09-18T00:00:00Z'));
      await GET(authed());
      expect(probePlannerProviders).toHaveBeenCalledWith(['groq', 'gemini']);
    });

    it.each([6, 12, 18])('UTC hour %i → probes groq only', async (hour) => {
      vi.setSystemTime(new Date(Date.UTC(2026, 8, 18, hour)));
      await GET(authed());
      expect(probePlannerProviders).toHaveBeenCalledWith(['groq']);
    });
  });

  describe('paging (captureException)', () => {
    it('pages on model_404', async () => {
      vi.mocked(probePlannerProviders).mockResolvedValue([groq('model_404')]);
      const res = await GET(authed());
      expect(res.status).toBe(200);
      expect(captureException).toHaveBeenCalledTimes(1);
      expect(vi.mocked(captureException).mock.calls[0][0]).toBeInstanceOf(Error);
      expect(String(vi.mocked(captureException).mock.calls[0][0])).toContain('groq/openai/gpt-oss-20b/model_404');
    });

    it('pages on auth (S8: dead prod key = sole provider dark)', async () => {
      vi.mocked(probePlannerProviders).mockResolvedValue([gemini('auth')]);
      await GET(authed());
      expect(captureException).toHaveBeenCalledTimes(1);
      expect(String(vi.mocked(captureException).mock.calls[0][0])).toContain('gemini/gemini-3.5-flash/auth');
    });

    it('does NOT page on down (transient) — warn only', async () => {
      vi.mocked(probePlannerProviders).mockResolvedValue([groq('down')]);
      await GET(authed());
      expect(captureException).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(groq('down'), 'planner.llm.probe.unhealthy');
    });

    it('does NOT page or warn on ok / skipped_no_key', async () => {
      vi.mocked(probePlannerProviders).mockResolvedValue([groq('skipped_no_key'), gemini('ok')]);
      await GET(authed());
      expect(captureException).not.toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });

  it('returns 500 when probe throws', async () => {
    vi.mocked(probePlannerProviders).mockRejectedValue(new Error('boom'));
    const res = await GET(authed());
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'internal_error' });
    expect(logger.error).toHaveBeenCalled();
  });
});
