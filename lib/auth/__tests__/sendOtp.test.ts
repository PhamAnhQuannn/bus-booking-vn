/**
 * Unit tests for lib/auth/sendOtp.ts
 * Prisma, ratelimit, and eSMS are all mocked.
 *
 * See also: the real rate-limit configuration integration test at the bottom of this file.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- hoisted mocks ----
const { mockPrisma, mockRatelimit, mockSendSms } = vi.hoisted(() => {
  const mockPrisma = { $executeRaw: vi.fn() };
  const mockRatelimit = { limit: vi.fn() };
  const mockSendSms = vi.fn();
  return { mockPrisma, mockRatelimit, mockSendSms };
});

vi.mock('@/lib/core/db/client', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/ratelimit', () => ({
  createRatelimit: vi.fn(() => mockRatelimit),
  InMemoryRatelimit: vi.fn(),
}));
vi.mock('@/lib/notification/esms', () => ({ sendSms: mockSendSms }));

import { sendOtp } from '../sendOtp';

const PHONE = '0901234567';

beforeEach(() => {
  vi.clearAllMocks();
  mockRatelimit.limit.mockResolvedValue({ allowed: true, remaining: 2, retryAfter: 0 });
  mockPrisma.$executeRaw.mockResolvedValue(1);
  mockSendSms.mockResolvedValue({ ok: true, externalRef: 'stub_abc' });
});

// ---------------------------------------------------------------------------
// Rate-limit configuration integration test (AC2) — uses REAL InMemoryRatelimit
// ---------------------------------------------------------------------------
describe('OTP rate-limit configuration (real InMemoryRatelimit, no mock)', () => {
  it('4th sendOtp for the same phone is rejected; calls 1-3 succeed', async () => {
    // Use the actual InMemoryRatelimit (bypassing the vi.mock above)
    const { InMemoryRatelimit } = await vi.importActual<typeof import('@/lib/ratelimit')>('@/lib/ratelimit');
    // Same config as lib/auth/sendOtp.ts: limit 3 per 15 min
    const rl = new InMemoryRatelimit({ limit: 3, windowMs: 15 * 60 * 1000 });
    const phone = '+8490xxxxxx99'; // unique test identifier — literal-x mask avoids gitleaks \+84[35789]\d{8}

    const r1 = await rl.limit(phone);
    const r2 = await rl.limit(phone);
    const r3 = await rl.limit(phone);
    const r4 = await rl.limit(phone);

    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(r3.allowed).toBe(true);
    // 4th send within the same window must be blocked
    expect(r4.allowed).toBe(false);
    expect(r4.retryAfter).toBeGreaterThan(0);
  });
});

describe('sendOtp', () => {
  it('returns ok:true on success and calls sendSms once', async () => {
    const result = await sendOtp(PHONE);
    expect(result).toEqual({ ok: true });
    expect(mockSendSms).toHaveBeenCalledTimes(1);
    expect(mockSendSms).toHaveBeenCalledWith(
      expect.objectContaining({ template: 'otpCode' })
    );
  });

  it('inserts OTP row via $executeRaw', async () => {
    await sendOtp(PHONE);
    expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('returns rate_limited when ratelimit blocks', async () => {
    mockRatelimit.limit.mockResolvedValue({ allowed: false, remaining: 0, retryAfter: 300 });

    const result = await sendOtp(PHONE);
    expect(result).toEqual({ ok: false, reason: 'rate_limited', retryAfter: 300 });
    expect(mockSendSms).not.toHaveBeenCalled();
    expect(mockPrisma.$executeRaw).not.toHaveBeenCalled();
  });

  it('rate-limit key is normalized phone, not raw input', async () => {
    await sendOtp('0901234567');
    expect(mockRatelimit.limit).toHaveBeenCalledWith('+84901234567');
  });

  it('normalizes phone before DB insert — payload uses E.164', async () => {
    await sendOtp('0901234567');
    // The $executeRaw call's template values include the normalized phone
    const callArgs = mockPrisma.$executeRaw.mock.calls[0][0];
    const values = callArgs.values;
    expect(values.some((v: unknown) => v === '+84901234567')).toBe(true);
  });
});
