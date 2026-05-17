import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryRatelimit } from '../index';

describe('InMemoryRatelimit', () => {
  let ratelimit: InMemoryRatelimit;

  beforeEach(() => {
    // Fresh instance per test with 60 requests/min limit
    ratelimit = new InMemoryRatelimit({ limit: 60, windowMs: 60_000 });
  });

  it('allows the first 60 requests from the same IP', async () => {
    const ip = '127.0.0.1';
    let lastResult = { allowed: false, remaining: 0, retryAfter: 0 };
    for (let i = 0; i < 60; i++) {
      lastResult = await ratelimit.limit(ip);
      expect(lastResult.allowed).toBe(true);
    }
    expect(lastResult.remaining).toBe(0);
  });

  it('blocks the 61st request from the same IP', async () => {
    const ip = '10.0.0.1';
    for (let i = 0; i < 60; i++) {
      await ratelimit.limit(ip);
    }
    const result = await ratelimit.limit(ip);
    expect(result.allowed).toBe(false);
  });

  it('returns a positive Retry-After header value when blocked', async () => {
    const ip = '192.168.1.1';
    for (let i = 0; i < 60; i++) {
      await ratelimit.limit(ip);
    }
    const result = await ratelimit.limit(ip);
    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it('different IPs have independent counters', async () => {
    const ip1 = '1.1.1.1';
    const ip2 = '2.2.2.2';
    // Exhaust ip1
    for (let i = 0; i < 60; i++) {
      await ratelimit.limit(ip1);
    }
    // ip2 should still be allowed
    const result = await ratelimit.limit(ip2);
    expect(result.allowed).toBe(true);
  });

  it('allows requests again after window expires (simulated by resetting)', async () => {
    // Use a very short window for this test
    const shortLimit = new InMemoryRatelimit({ limit: 2, windowMs: 50 });
    const ip = '3.3.3.3';
    await shortLimit.limit(ip);
    await shortLimit.limit(ip);
    const blocked = await shortLimit.limit(ip);
    expect(blocked.allowed).toBe(false);

    // Wait for window to expire
    await new Promise((resolve) => setTimeout(resolve, 100));
    const allowed = await shortLimit.limit(ip);
    expect(allowed.allowed).toBe(true);
  });
});
