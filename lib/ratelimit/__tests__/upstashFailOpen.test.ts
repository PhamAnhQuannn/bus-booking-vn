/**
 * #360 regression — an Upstash outage must not take the site down.
 *
 * `proxy.ts` awaits `ratelimit.limit(ip)` for EVERY non-safe-method /api/* request
 * before routing. `UpstashRatelimit.limit()` had no try/catch (unlike the ioredis
 * backend, which deliberately fails open), so a single REST timeout threw out of Edge
 * middleware and 500'd holds, bookings, login — and the SePay webhook, which is not
 * rate-limit exempt. SePay would then mark the delivery failed and retry on Fibonacci
 * backoff over ~5h while real customer money sat unconfirmed.
 *
 * Production runs REDIS_PROVIDER=upstash, so this is the live backend, and until now
 * NO test in the repo constructed it or mocked a failure.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const limitMock = vi.fn();

vi.mock('@upstash/ratelimit', () => {
  class FakeRatelimit {
    static slidingWindow = vi.fn(() => ({}));
    limit = limitMock;
  }
  return { Ratelimit: FakeRatelimit };
});

vi.mock('@upstash/redis', () => ({
  Redis: class {},
}));

let savedEnv: NodeJS.ProcessEnv;

beforeEach(() => {
  savedEnv = { ...process.env };
  process.env.UPSTASH_REDIS_REST_URL = 'https://fake.upstash.io';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'fake-token';
  limitMock.mockReset();
});

afterEach(() => {
  process.env = savedEnv;
  vi.clearAllMocks();
});

describe('UpstashRatelimit.limit — fails open', () => {
  it('allows the request when Upstash rejects (REST error / timeout)', async () => {
    const { UpstashRatelimit } = await import('../index');
    limitMock.mockRejectedValue(new Error('upstash: fetch failed'));

    const rl = new UpstashRatelimit({ limit: 60, windowMs: 60_000 });
    const result = await rl.limit('203.0.113.7');

    expect(result.allowed).toBe(true);
    expect(result.retryAfter).toBe(0);
  });

  it('allows the request when the Upstash env vars are missing (getClient throws)', async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    const { UpstashRatelimit } = await import('../index');

    const rl = new UpstashRatelimit({ limit: 60, windowMs: 60_000 });
    const result = await rl.limit('203.0.113.7');

    expect(result.allowed).toBe(true);
  });

  it('rebuilds the client on the next call rather than caching a broken one', async () => {
    const { UpstashRatelimit } = await import('../index');
    const rl = new UpstashRatelimit({ limit: 60, windowMs: 60_000 });

    limitMock.mockRejectedValueOnce(new Error('transient'));
    await rl.limit('203.0.113.7');

    // Upstash recovers — the limiter must resume enforcing, not stay failed open.
    limitMock.mockResolvedValueOnce({
      success: false,
      remaining: 0,
      reset: Date.now() + 30_000,
    });
    const after = await rl.limit('203.0.113.7');

    expect(after.allowed).toBe(false);
    expect(after.retryAfter).toBeGreaterThan(0);
  });

  it('still denies normally when Upstash is healthy and the window is exhausted', async () => {
    const { UpstashRatelimit } = await import('../index');
    limitMock.mockResolvedValue({ success: false, remaining: 0, reset: Date.now() + 10_000 });

    const rl = new UpstashRatelimit({ limit: 60, windowMs: 60_000 });
    const result = await rl.limit('203.0.113.9');

    expect(result.allowed).toBe(false);
  });
});
