/**
 * Unit tests for POST /api/planner/chat — the AI-cost guard block.
 *
 * Covers the hardening added for #547/#548/#549/#550:
 *   - #549 runtime kill-switch: PLANNER_CHAT_ENABLED=false → 503 before any work.
 *   - #547 per-IP daily sub-cap: a drained IP gets 429 even with a fresh bb_sid.
 *   - #550 alerting: a distinct log line when the GLOBAL budget (vs a throttle) denies.
 *
 * Mocks the planner engine + ratelimit so no Gemini/Redis/Prisma is touched.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  sessionLimitMock,
  anonLimitMock,
  perIpLimitMock,
  budgetLimitMock,
  sessionIdMock,
  chatEnabledMock,
  warnMock,
} = vi.hoisted(() => ({
  sessionLimitMock: vi.fn(async () => ({ allowed: true, remaining: 9, retryAfter: 0 })),
  anonLimitMock: vi.fn(async () => ({ allowed: true, remaining: 2, retryAfter: 0 })),
  perIpLimitMock: vi.fn(async () => ({ allowed: true, remaining: 49, retryAfter: 0 })),
  budgetLimitMock: vi.fn(async () => ({ allowed: true, remaining: 999, retryAfter: 0 })),
  sessionIdMock: vi.fn<() => string | null>(() => 'sess-1'),
  chatEnabledMock: vi.fn<() => boolean>(() => true),
  warnMock: vi.fn(),
}));

vi.mock('@/lib/ratelimit', () => ({
  plannerChatRatelimit: { limit: sessionLimitMock },
  plannerChatAnonRatelimit: { limit: anonLimitMock },
  plannerChatDailyPerIp: { limit: perIpLimitMock },
  plannerDailyBudget: { limit: budgetLimitMock },
}));

vi.mock('@/lib/analytics', () => ({
  sessionIdFromRequest: () => sessionIdMock(),
}));

vi.mock('@/lib/config', () => ({
  getEnv: () => ({ PLANNER_CHAT_ENABLED: chatEnabledMock() }),
}));

vi.mock('@/lib/logger', () => ({
  logger: { warn: warnMock },
}));

vi.mock('@/lib/observability', () => ({
  captureException: vi.fn(),
}));

// Planner engine: sanitizeHistory passes through; streamChat yields a done-only stream so
// the happy path returns a 200 SSE without any real Gemini call.
vi.mock('@/trip-planner/lib/planner', () => ({
  sanitizeHistory: (h: unknown) => h,
  streamChat: async function* () {
    /* no events → route sends 'done' and closes */
  },
  getStore: vi.fn(),
  pickByVibe: vi.fn(),
  ParseIntentError: class extends Error {},
  CityDataUnavailableError: class extends Error {},
}));

import { POST } from '../route';
import { NextRequest } from 'next/server';

function makeRequest(headers?: Record<string, string>): NextRequest {
  return new NextRequest('http://localhost/api/planner/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ history: [{ role: 'user', text: 'gợi ý Đà Lạt' }] }),
  });
}

beforeEach(() => {
  sessionLimitMock.mockResolvedValue({ allowed: true, remaining: 9, retryAfter: 0 });
  anonLimitMock.mockResolvedValue({ allowed: true, remaining: 2, retryAfter: 0 });
  perIpLimitMock.mockResolvedValue({ allowed: true, remaining: 49, retryAfter: 0 });
  budgetLimitMock.mockResolvedValue({ allowed: true, remaining: 999, retryAfter: 0 });
  sessionIdMock.mockReturnValue('sess-1');
  chatEnabledMock.mockReturnValue(true);
  warnMock.mockReset();
});

describe('POST /api/planner/chat — kill-switch (#549)', () => {
  it('returns 503 when PLANNER_CHAT_ENABLED is false, before touching the limiters', async () => {
    chatEnabledMock.mockReturnValue(false);
    const res = await POST(makeRequest());
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'PLANNER_CHAT_DISABLED' });
    // No budget consumed while disabled.
    expect(budgetLimitMock).not.toHaveBeenCalled();
    expect(sessionLimitMock).not.toHaveBeenCalled();
  });
});

describe('POST /api/planner/chat — per-IP sub-cap (#547)', () => {
  it('denies with 429 when the per-IP daily bucket is exhausted (fresh bb_sid does not help)', async () => {
    perIpLimitMock.mockResolvedValue({ allowed: false, remaining: 0, retryAfter: 1234 });
    const res = await POST(makeRequest());
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('1234');
    // The global budget must NOT be consumed once the per-IP cap already denied.
    expect(budgetLimitMock).not.toHaveBeenCalled();
    expect(warnMock).toHaveBeenCalledWith(
      expect.objectContaining({ denier: 'per-ip-daily' }),
      'planner.chat.denied.rate_limited',
    );
  });
});

describe('POST /api/planner/chat — alerting (#550)', () => {
  it('logs a distinct line when the GLOBAL budget denies', async () => {
    budgetLimitMock.mockResolvedValue({ allowed: false, remaining: 0, retryAfter: 60 });
    const res = await POST(makeRequest());
    expect(res.status).toBe(429);
    expect(warnMock).toHaveBeenCalledWith(
      expect.objectContaining({ denier: 'global-budget' }),
      'planner.chat.denied.budget_exhausted',
    );
  });

  it('allows a healthy request through to the SSE stream (200) with no denial log', async () => {
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/event-stream');
    expect(warnMock).not.toHaveBeenCalled();
  });
});
