/**
 * consumeJti fails CLOSED — the deliberate opposite of the rate limiter's fail-open.
 *
 * A replay guard must not treat "Redis is unreachable" as "this proof is unused":
 * returning true on error lets an attacker replay an OTP proof or an admin TOTP code
 * during exactly the network blip that makes them retry.
 *
 * Before the catch, an Upstash error propagated. verifyOtpProof's outer catch happened
 * to absorb it, but verifyLoginTotp (lib/auth/adminTotp.ts:118) has no catch of its own
 * — so the same blip surfaced as an unhandled 500 on admin TOTP verify. Fail-closed by
 * crash, with a stack trace instead of a clean denial. These tests pin the deny.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const setMock = vi.fn();

vi.mock('@upstash/redis', () => ({
  Redis: class {
    set = setMock;
  },
}));

let savedEnv: NodeJS.ProcessEnv;

beforeEach(() => {
  savedEnv = { ...process.env };
  process.env.REDIS_PROVIDER = 'upstash';
  process.env.UPSTASH_REDIS_REST_URL = 'https://fake.upstash.io';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'fake-token';
  setMock.mockReset();
});

afterEach(() => {
  process.env = savedEnv;
  vi.clearAllMocks();
});

describe('consumeJti — fail-closed on Redis error', () => {
  it('returns false (denies) instead of throwing when Upstash rejects', async () => {
    const { consumeJti } = await import('../otpProof');
    setMock.mockRejectedValue(new Error('upstash: fetch failed'));

    await expect(consumeJti('jti-abc', 300)).resolves.toBe(false);
  });

  it('claims the jti normally when Upstash is healthy', async () => {
    const { consumeJti } = await import('../otpProof');
    setMock.mockResolvedValue('OK');

    await expect(consumeJti('jti-abc', 300)).resolves.toBe(true);
  });

  it('denies a replay (NX returns null) without erroring', async () => {
    const { consumeJti } = await import('../otpProof');
    setMock.mockResolvedValue(null);

    await expect(consumeJti('jti-abc', 300)).resolves.toBe(false);
  });
});
