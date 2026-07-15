import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockQueryRaw = vi.hoisted(() => vi.fn());
const mockExecuteRaw = vi.hoisted(() => vi.fn());
const mockRatelimit = vi.hoisted(() => ({ limit: vi.fn() }));
const mockSendEmail = vi.hoisted(() => vi.fn());
const mockStashTestOtp = vi.hoisted(() => vi.fn());
const mockGenerateCode = vi.hoisted(() => vi.fn(() => '123456'));
const mockGenerateSalt = vi.hoisted(() => vi.fn(() => 'testsalt'));
const mockHashCode = vi.hoisted(() => vi.fn());

vi.mock('@/lib/core/db/client', () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
    $executeRaw: mockExecuteRaw,
  },
}));

vi.mock('@/lib/ratelimit', () => ({
  createRatelimit: vi.fn(() => mockRatelimit),
}));

vi.mock('@/lib/notification', () => ({
  sendEmail: mockSendEmail,
  stashTestOtp: mockStashTestOtp,
}));

vi.mock('../otp', () => ({
  generateCode: mockGenerateCode,
  generateSalt: mockGenerateSalt,
  hashCode: mockHashCode,
}));

import { sendOperatorLoginOtp, verifyOperatorLoginOtp } from '../operatorLoginOtp';

const TEST_EMAIL = 'op@example.com';
const CORRECT_HASH = 'a'.repeat(64);
const WRONG_HASH = 'b'.repeat(64);

function makeLockoutSentinel(expiresInMs = 10 * 60 * 1000) {
  return [{ expiresAt: new Date(Date.now() + expiresInMs) }];
}

function makeActiveRow(
  overrides: Partial<{ id: string; codeHash: string; salt: string; attemptCount: number }> = {}
) {
  return [{
    id: 'otp-1',
    codeHash: CORRECT_HASH,
    salt: 'testsalt',
    attemptCount: 0,
    ...overrides,
  }];
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSendEmail.mockResolvedValue(undefined);
  mockRatelimit.limit.mockResolvedValue({ allowed: true, remaining: 2, retryAfter: 0 });
  mockExecuteRaw.mockResolvedValue(1);
  mockHashCode.mockReturnValue(CORRECT_HASH);
});

describe('sendOperatorLoginOtp', () => {
  it('sends email and returns ok on happy path', async () => {
    mockQueryRaw.mockResolvedValueOnce([]); // no lockout sentinel

    const result = await sendOperatorLoginOtp(TEST_EMAIL);

    expect(result.ok).toBe(true);
    expect(mockSendEmail).toHaveBeenCalledOnce();
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: TEST_EMAIL,
        template: 'otpCode',
      })
    );
    expect(mockExecuteRaw).toHaveBeenCalledOnce();
  });

  it('returns locked_out when lockout sentinel active', async () => {
    mockQueryRaw.mockResolvedValueOnce(makeLockoutSentinel(600_000));

    const result = await sendOperatorLoginOtp(TEST_EMAIL);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('locked_out');
      expect(result.retryAfter).toBeGreaterThan(0);
      expect(result.retryAfter).toBeLessThanOrEqual(600);
    }
    expect(mockRatelimit.limit).not.toHaveBeenCalled();
    expect(mockExecuteRaw).not.toHaveBeenCalled();
  });

  it('returns rate_limited when rate limiter blocks', async () => {
    mockQueryRaw.mockResolvedValueOnce([]); // no sentinel
    mockRatelimit.limit.mockResolvedValue({ allowed: false, remaining: 0, retryAfter: 900 });

    const result = await sendOperatorLoginOtp(TEST_EMAIL);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('rate_limited');
      expect(result.retryAfter).toBe(900);
    }
  });
});

describe('verifyOperatorLoginOtp', () => {
  it('returns ok on correct code', async () => {
    mockQueryRaw.mockResolvedValueOnce([]); // no sentinel
    mockQueryRaw.mockResolvedValueOnce(makeActiveRow());
    mockHashCode.mockReturnValue(CORRECT_HASH);
    mockExecuteRaw.mockResolvedValue(1);

    const result = await verifyOperatorLoginOtp(TEST_EMAIL, '123456');

    expect(result.status).toBe('ok');
  });

  it('returns mismatch on wrong code (1st attempt)', async () => {
    mockQueryRaw.mockResolvedValueOnce([]); // no sentinel
    mockQueryRaw.mockResolvedValueOnce(makeActiveRow({ attemptCount: 0 }));
    mockHashCode.mockReturnValue(WRONG_HASH);

    const result = await verifyOperatorLoginOtp(TEST_EMAIL, 'wrong1');

    expect(result.status).toBe('mismatch');
    expect(mockExecuteRaw).toHaveBeenCalledTimes(1);
    const sqlCall = mockExecuteRaw.mock.calls[0][0];
    expect(sqlCall.strings.join('')).toContain('"attemptCount" = "attemptCount" + 1');
  });

  it('writes lockout sentinel on 3rd mismatch', async () => {
    mockQueryRaw.mockResolvedValueOnce([]); // no sentinel
    mockQueryRaw.mockResolvedValueOnce(makeActiveRow({ attemptCount: 2 }));
    mockHashCode.mockReturnValue(WRONG_HASH);

    const result = await verifyOperatorLoginOtp(TEST_EMAIL, 'wrong3');

    expect(result.status).toBe('mismatch');
    expect(mockExecuteRaw).toHaveBeenCalledTimes(1);
    const sqlText = mockExecuteRaw.mock.calls[0][0].strings.join('');
    expect(sqlText).toContain('consumed = true');
    expect(sqlText).toContain('"expiresAt"');
  });

  it('returns locked_out when lockout sentinel active', async () => {
    mockQueryRaw.mockResolvedValueOnce(makeLockoutSentinel());

    const result = await verifyOperatorLoginOtp(TEST_EMAIL, '123456');

    expect(result.status).toBe('locked_out');
    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
  });

  it('returns gone when no active OTP row exists', async () => {
    mockQueryRaw.mockResolvedValueOnce([]); // no sentinel
    mockQueryRaw.mockResolvedValueOnce([]); // no active row

    const result = await verifyOperatorLoginOtp(TEST_EMAIL, '123456');

    expect(result.status).toBe('gone');
  });
});
