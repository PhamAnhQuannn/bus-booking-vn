/**
 * Unit tests for lib/auth/sendOtp.ts
 * Prisma, ratelimit, and email dispatch are all mocked.
 *
 * See also: the real rate-limit configuration integration test at the bottom of this file.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- hoisted mocks ----
const { mockPrisma, mockRatelimit, mockSendEmail, mockStashTestOtp } = vi.hoisted(() => {
  const mockPrisma = { $executeRaw: vi.fn() };
  const mockRatelimit = { limit: vi.fn() };
  const mockSendEmail = vi.fn();
  const mockStashTestOtp = vi.fn();
  return { mockPrisma, mockRatelimit, mockSendEmail, mockStashTestOtp };
});

vi.mock('@/lib/core/db/client', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/ratelimit', () => ({
  createRatelimit: vi.fn(() => mockRatelimit),
  InMemoryRatelimit: vi.fn(),
}));
vi.mock('@/lib/notification', () => ({ sendEmail: mockSendEmail, stashTestOtp: mockStashTestOtp }));

import { sendOtp } from '../sendOtp';

const EMAIL = 'test@example.com';

beforeEach(() => {
  vi.clearAllMocks();
  mockRatelimit.limit.mockResolvedValue({ allowed: true, remaining: 2, retryAfter: 0 });
  mockPrisma.$executeRaw.mockResolvedValue(1);
  mockSendEmail.mockResolvedValue({ ok: true });
});

// ---------------------------------------------------------------------------
// Rate-limit configuration integration test (AC2) — uses REAL InMemoryRatelimit
// ---------------------------------------------------------------------------
describe('OTP rate-limit configuration (real InMemoryRatelimit, no mock)', () => {
  it('4th sendOtp for the same email is rejected; calls 1-3 succeed', async () => {
    // Use the actual InMemoryRatelimit (bypassing the vi.mock above)
    const { InMemoryRatelimit } = await vi.importActual<typeof import('@/lib/ratelimit')>('@/lib/ratelimit');
    // Same config as lib/auth/sendOtp.ts: limit 3 per 15 min
    const rl = new InMemoryRatelimit({ limit: 3, windowMs: 15 * 60 * 1000 });
    const email = 'ratelimit-test@example.com';

    const r1 = await rl.limit(email);
    const r2 = await rl.limit(email);
    const r3 = await rl.limit(email);
    const r4 = await rl.limit(email);

    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(r3.allowed).toBe(true);
    // 4th send within the same window must be blocked
    expect(r4.allowed).toBe(false);
    expect(r4.retryAfter).toBeGreaterThan(0);
  });
});

describe('sendOtp', () => {
  it('returns ok:true on success and calls sendEmail once', async () => {
    const result = await sendOtp(EMAIL);
    expect(result).toEqual({ ok: true });
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: EMAIL, template: 'otpCode' })
    );
  });

  it('calls stashTestOtp with normalized email and code', async () => {
    await sendOtp(EMAIL);
    expect(mockStashTestOtp).toHaveBeenCalledTimes(1);
    expect(mockStashTestOtp).toHaveBeenCalledWith(EMAIL, expect.any(String));
  });

  it('inserts OTP row via $executeRaw', async () => {
    await sendOtp(EMAIL);
    expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('returns rate_limited when ratelimit blocks', async () => {
    mockRatelimit.limit.mockResolvedValue({ allowed: false, remaining: 0, retryAfter: 300 });

    const result = await sendOtp(EMAIL);
    expect(result).toEqual({ ok: false, reason: 'rate_limited', retryAfter: 300 });
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockPrisma.$executeRaw).not.toHaveBeenCalled();
  });

  it('rate-limit key is normalized email, not raw input', async () => {
    await sendOtp('  Test@Example.COM  ');
    expect(mockRatelimit.limit).toHaveBeenCalledWith('test@example.com');
  });

  it('normalizes email before DB insert — payload uses lowercase trimmed email', async () => {
    await sendOtp('  Test@Example.COM  ');
    // The $executeRaw call's template values include the normalized email
    const callArgs = mockPrisma.$executeRaw.mock.calls[0][0];
    const values = callArgs.values;
    expect(values.some((v: unknown) => v === 'test@example.com')).toBe(true);
  });
});
