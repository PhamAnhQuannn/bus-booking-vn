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
/** Counts real client constructions so the cache-invalidation test can't pass vacuously. */
const constructed = vi.fn();

vi.mock('@upstash/ratelimit', () => {
  class FakeRatelimit {
    static slidingWindow = vi.fn(() => ({}));
    limit = limitMock;
    constructor() {
      constructed();
    }
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
  constructed.mockReset();
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

    // The assertions above prove the limiter RESUMES enforcing, but they would pass
    // with `this.rl = null` deleted too — the mock's limit() is the same closure
    // whether or not a fresh client was built. Counting constructions is what
    // actually pins the cache invalidation: 2 = the failed one was discarded.
    expect(constructed).toHaveBeenCalledTimes(2);
  });

  it('still denies normally when Upstash is healthy and the window is exhausted', async () => {
    const { UpstashRatelimit } = await import('../index');
    limitMock.mockResolvedValue({ success: false, remaining: 0, reset: Date.now() + 10_000 });

    const rl = new UpstashRatelimit({ limit: 60, windowMs: 60_000 });
    const result = await rl.limit('203.0.113.9');

    expect(result.allowed).toBe(false);
  });
});

/**
 * The other half of #360, and the reason fail-open is a per-LIMITER property rather
 * than a per-backend one.
 *
 * adminLoginLockout / opLoginLockout / adminTotpLockout are built by the same
 * createRatelimit factory as the 60/min edge throttle, so a blanket fail-open would
 * silently disable the account-level brute-force brakes for the duration of an
 * Upstash outage — against operator usernames that are publicly enumerable
 * (BRAND_ACRONYM-last4phone). "A rate limiter is a throttle, not an authorisation
 * gate" is true of the edge limiter and false of these three.
 *
 * These tests fail against a limiter that ignores failClosed.
 */
describe('UpstashRatelimit.limit — fails CLOSED when opted in', () => {
  it('DENIES the attempt when Upstash rejects', async () => {
    const { UpstashRatelimit } = await import('../index');
    limitMock.mockRejectedValue(new Error('upstash: fetch failed'));

    const rl = new UpstashRatelimit({ limit: 5, windowMs: 15 * 60_000, failClosed: true });
    const result = await rl.limit('op-login-fail:PB-0001');

    expect(result.allowed).toBe(false);
    // Back off for the whole lockout window rather than hot-looping the outage.
    expect(result.retryAfter).toBe(900);
  });

  it('DENIES the attempt when the Upstash env vars are missing', async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    const { UpstashRatelimit } = await import('../index');

    const rl = new UpstashRatelimit({ limit: 5, windowMs: 15 * 60_000, failClosed: true });
    const result = await rl.limit('admin-login-fail:a@b.co');

    expect(result.allowed).toBe(false);
  });

  it('still ALLOWS normally when Upstash is healthy and the window is not exhausted', async () => {
    // Failing closed must not mean "always deny" — a legitimate operator who has not
    // burned their 5 attempts still gets through on a healthy backend.
    const { UpstashRatelimit } = await import('../index');
    limitMock.mockResolvedValue({ success: true, remaining: 4, reset: Date.now() + 900_000 });

    const rl = new UpstashRatelimit({ limit: 5, windowMs: 15 * 60_000, failClosed: true });
    const result = await rl.limit('op-login-fail:PB-0001');

    expect(result.allowed).toBe(true);
  });
});

describe('the three account lockouts are wired fail-closed', () => {
  it('adminLoginLockout / opLoginLockout / adminTotpLockout deny on store failure', async () => {
    // Guards the WIRING, not just the class: the failClosed option is useless if a
    // lockout is declared without it, and that is a one-word omission away.
    process.env.REDIS_PROVIDER = 'upstash';
    vi.resetModules();
    const mod = await import('../index');
    limitMock.mockRejectedValue(new Error('upstash down'));

    for (const [name, rl] of [
      ['adminLoginLockout', mod.adminLoginLockout],
      ['opLoginLockout', mod.opLoginLockout],
      ['adminTotpLockout', mod.adminTotpLockout],
    ] as const) {
      const result = await rl.limit(`${name}:victim`);
      expect(result.allowed, `${name} must fail closed`).toBe(false);
    }

    // Contrast: the generic edge throttle on the same backend still fails OPEN.
    const generic = await mod.ratelimit.limit('203.0.113.7');
    expect(generic.allowed).toBe(true);
  });
});
