/**
 * Unit tests for lib/auth/operatorOtp.ts
 *
 * Focus: 15-min lockout sentinel behaviour (AC4 — Gap 2).
 *
 * (a) verifyOperatorOtp returns 'locked_out' when sentinel row is active
 * (b) 3rd mismatch writes lockout sentinel (consumed=true, expiresAt extended)
 * (c) sendOperatorPasswordResetOtp returns locked_out when sentinel is active
 * (d) after lockout expiry, sendOperatorPasswordResetOtp succeeds (no sentinel)
 * (e) basic happy-path: verifyOperatorOtp returns 'ok' on correct code
 * (f) basic: returns 'gone' when no active row
 * (g) first + second mismatches return 'mismatch' (not locked_out)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const mockQueryRaw = vi.hoisted(() => vi.fn());
const mockExecuteRaw = vi.hoisted(() => vi.fn());
const mockRatelimit = vi.hoisted(() => ({ limit: vi.fn() }));
const mockSendSms = vi.hoisted(() => vi.fn());
const mockGenerateCode = vi.hoisted(() => vi.fn(() => '123456'));
const mockGenerateSalt = vi.hoisted(() => vi.fn(() => 'testsalt'));
const mockHashCode = vi.hoisted(() => vi.fn());
const mockNormalizePhone = vi.hoisted(() => vi.fn((p: string) => p));

vi.mock('@/lib/core/db/client', () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
    $executeRaw: mockExecuteRaw,
  },
}));

vi.mock('@/lib/ratelimit', () => ({
  createRatelimit: vi.fn(() => mockRatelimit),
}));

vi.mock('@/lib/notification/esms', () => ({
  sendSms: mockSendSms,
}));

vi.mock('../otp', () => ({
  generateCode: mockGenerateCode,
  generateSalt: mockGenerateSalt,
  hashCode: mockHashCode,
}));

vi.mock('@/lib/core/validation/phone', () => ({
  normalizePhone: mockNormalizePhone,
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { sendOperatorPasswordResetOtp, verifyOperatorOtp } from '../operatorOtp';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_PHONE = '+8490xxxxxx1';

function makeLockoutSentinel(expiresInMs = 10 * 60 * 1000) {
  return [{ expiresAt: new Date(Date.now() + expiresInMs) }];
}

// Use valid 64-char hex strings (SHA256 output length) so Buffer.from(..., 'hex') produces
// equal-length buffers and timingSafeEqual doesn't short-circuit with empty buffers.
const CORRECT_HASH = 'a'.repeat(64);
const WRONG_HASH = 'b'.repeat(64);

function makeActiveRow(overrides: Partial<{ id: string; codeHash: string; salt: string; attemptCount: number }> = {}) {
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
  mockNormalizePhone.mockImplementation((p: string) => p);
  mockSendSms.mockResolvedValue(undefined);
  mockRatelimit.limit.mockResolvedValue({ allowed: true, remaining: 2, retryAfter: 0 });
  mockExecuteRaw.mockResolvedValue(1);
  mockHashCode.mockReturnValue(CORRECT_HASH);
});

// ---------------------------------------------------------------------------
// verifyOperatorOtp tests
// ---------------------------------------------------------------------------

describe('verifyOperatorOtp', () => {
  describe('(a) lockout sentinel already active', () => {
    it('returns locked_out immediately without looking up active OTP', async () => {
      // First queryRaw call is findLockoutSentinel → returns sentinel
      mockQueryRaw.mockResolvedValueOnce(makeLockoutSentinel());

      const result = await verifyOperatorOtp(TEST_PHONE, '000000');

      expect(result.status).toBe('locked_out');
      // Only one DB query (sentinel check) — no active-row lookup
      expect(mockQueryRaw).toHaveBeenCalledTimes(1);
    });
  });

  describe('(f) no active OTP row', () => {
    it('returns gone when no active row exists', async () => {
      // sentinel = empty, active-row = empty
      mockQueryRaw.mockResolvedValueOnce([]); // sentinel
      mockQueryRaw.mockResolvedValueOnce([]); // active row lookup

      const result = await verifyOperatorOtp(TEST_PHONE, '000000');

      expect(result.status).toBe('gone');
    });
  });

  describe('(g) first and second mismatches', () => {
    it('returns mismatch on first wrong attempt (attemptCount 0→1)', async () => {
      mockQueryRaw.mockResolvedValueOnce([]); // sentinel — none
      mockQueryRaw.mockResolvedValueOnce(makeActiveRow({ attemptCount: 0 }));
      mockHashCode.mockReturnValue(WRONG_HASH); // mismatch

      const result = await verifyOperatorOtp(TEST_PHONE, 'wrong');

      expect(result.status).toBe('mismatch');
      // Should NOT write lockout sentinel (only increments attemptCount)
      expect(mockExecuteRaw).toHaveBeenCalledTimes(1);
      const sqlCall = mockExecuteRaw.mock.calls[0][0];
      // The update should NOT contain 'consumed = true'
      expect(sqlCall.strings.join('')).toContain('"attemptCount" = "attemptCount" + 1');
    });

    it('returns mismatch on second wrong attempt (attemptCount 1→2)', async () => {
      mockQueryRaw.mockResolvedValueOnce([]); // sentinel — none
      mockQueryRaw.mockResolvedValueOnce(makeActiveRow({ attemptCount: 1 }));
      mockHashCode.mockReturnValue(WRONG_HASH);

      const result = await verifyOperatorOtp(TEST_PHONE, 'wrong');

      expect(result.status).toBe('mismatch');
      expect(mockExecuteRaw).toHaveBeenCalledTimes(1);
      const sqlCall = mockExecuteRaw.mock.calls[0][0];
      expect(sqlCall.strings.join('')).toContain('"attemptCount" = "attemptCount" + 1');
    });
  });

  describe('(b) 3rd mismatch writes lockout sentinel', () => {
    it('returns mismatch on 3rd failure AND writes consumed=true sentinel', async () => {
      mockQueryRaw.mockResolvedValueOnce([]); // sentinel — none
      mockQueryRaw.mockResolvedValueOnce(makeActiveRow({ attemptCount: 2 }));
      mockHashCode.mockReturnValue(WRONG_HASH); // mismatch

      const result = await verifyOperatorOtp(TEST_PHONE, 'wrong');

      expect(result.status).toBe('mismatch');
      // Should write lockout sentinel (consumed=true + extended expiresAt)
      expect(mockExecuteRaw).toHaveBeenCalledTimes(1);
      const sqlCall = mockExecuteRaw.mock.calls[0][0];
      const sqlText = sqlCall.strings.join('');
      expect(sqlText).toContain('consumed = true');
      expect(sqlText).toContain('"consumedAt"');
      expect(sqlText).toContain('"expiresAt"');
    });
  });

  describe('(e) correct code — happy path', () => {
    it('returns ok and otpId when code is correct', async () => {
      mockQueryRaw.mockResolvedValueOnce([]); // sentinel — none
      mockQueryRaw.mockResolvedValueOnce(makeActiveRow({ id: 'otp-42', codeHash: 'correcthash' }));
      mockHashCode.mockReturnValue('correcthash'); // match
      mockExecuteRaw.mockResolvedValue(1); // CAS update succeeds

      const result = await verifyOperatorOtp(TEST_PHONE, '123456');

      expect(result.status).toBe('ok');
      expect(result.otpId).toBe('otp-42');
    });
  });
});

// ---------------------------------------------------------------------------
// sendOperatorPasswordResetOtp tests
// ---------------------------------------------------------------------------

describe('sendOperatorPasswordResetOtp', () => {
  describe('(c) sentinel active — send blocked', () => {
    it('returns locked_out without hitting rate-limiter or DB write', async () => {
      mockQueryRaw.mockResolvedValueOnce(makeLockoutSentinel(600 * 1000)); // 10 min remaining

      const result = await sendOperatorPasswordResetOtp(TEST_PHONE);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('locked_out');
        expect(result.retryAfter).toBeGreaterThan(0);
        expect(result.retryAfter).toBeLessThanOrEqual(600);
      }
      // Rate-limiter must NOT be called
      expect(mockRatelimit.limit).not.toHaveBeenCalled();
      // No INSERT/UPDATE
      expect(mockExecuteRaw).not.toHaveBeenCalled();
    });
  });

  describe('(d) after lockout expiry — send succeeds', () => {
    it('returns ok when no sentinel exists', async () => {
      mockQueryRaw.mockResolvedValueOnce([]); // sentinel — expired/none
      mockRatelimit.limit.mockResolvedValue({ allowed: true, remaining: 2, retryAfter: 0 });
      mockExecuteRaw.mockResolvedValue(1);
      mockSendSms.mockResolvedValue(undefined);

      const result = await sendOperatorPasswordResetOtp(TEST_PHONE);

      expect(result.ok).toBe(true);
      expect(mockSendSms).toHaveBeenCalledOnce();
    });
  });

  describe('rate-limited (existing behaviour)', () => {
    it('returns rate_limited when rate-limiter blocks', async () => {
      mockQueryRaw.mockResolvedValueOnce([]); // sentinel — none
      mockRatelimit.limit.mockResolvedValue({ allowed: false, remaining: 0, retryAfter: 900 });

      const result = await sendOperatorPasswordResetOtp(TEST_PHONE);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('rate_limited');
        expect(result.retryAfter).toBe(900);
      }
    });
  });
});
