/**
 * Unit tests for lib/auth/otp.ts
 * Prisma is mocked — no real DB needed.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- Mock @/lib/db/client before importing otp ----
vi.mock('@/lib/db/client', () => {
  const mockPrisma = {
    $executeRaw: vi.fn(),
    $queryRaw: vi.fn(),
  };
  return { prisma: mockPrisma };
});

import { generateCode, hashCode, generateSalt, consume } from '../otp';
import { prisma } from '@/lib/db/client';

const TEST_PHONE = '+8490xxxxxx12';

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// generateCode
// ---------------------------------------------------------------------------
describe('generateCode', () => {
  it('returns a 6-digit string', () => {
    const code = generateCode();
    expect(code).toMatch(/^[0-9]{6}$/);
  });

  it('returns strings of length 6', () => {
    for (let i = 0; i < 20; i++) {
      expect(generateCode()).toHaveLength(6);
    }
  });

  it('generates distinct values across 1000 calls (collision-free heuristic)', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      codes.add(generateCode());
    }
    // 1000 codes from a pool of 1_000_000 — probability of all unique is very high
    // We allow at most 5 collisions (generous upper bound)
    expect(codes.size).toBeGreaterThanOrEqual(995);
  });
});

// ---------------------------------------------------------------------------
// generateSalt
// ---------------------------------------------------------------------------
describe('generateSalt', () => {
  it('returns a 32-char hex string (16 bytes)', () => {
    const salt = generateSalt();
    expect(salt).toMatch(/^[0-9a-f]{32}$/);
  });

  it('returns distinct values on each call', () => {
    const s1 = generateSalt();
    const s2 = generateSalt();
    expect(s1).not.toBe(s2);
  });
});

// ---------------------------------------------------------------------------
// hashCode
// ---------------------------------------------------------------------------
describe('hashCode', () => {
  it('returns a 64-char hex string (SHA-256)', () => {
    const salt = generateSalt();
    const hash = hashCode('123456', salt);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic for the same (code, salt) pair', () => {
    const salt = generateSalt();
    expect(hashCode('123456', salt)).toBe(hashCode('123456', salt));
  });

  it('produces different hash for different salt', () => {
    const s1 = generateSalt();
    const s2 = generateSalt();
    expect(hashCode('123456', s1)).not.toBe(hashCode('123456', s2));
  });

  it('produces different hash for different code with same salt', () => {
    const salt = generateSalt();
    expect(hashCode('111111', salt)).not.toBe(hashCode('999999', salt));
  });
});

// ---------------------------------------------------------------------------
// consume
// ---------------------------------------------------------------------------
describe('consume', () => {
  it('returns status=ok when CAS update succeeds (happy path)', async () => {
    const salt = generateSalt();
    const { hashCode: hc } = await import('../otp');
    const code = '123456';
    const storedHash = hc(code, salt);

    // First $queryRaw: return active row with matching salt + codeHash
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([
      { id: 'otp-id-abc', codeHash: storedHash, salt, attemptCount: 0 },
    ]);
    // $executeRaw: CAS update returns 1 row affected
    vi.mocked(prisma.$executeRaw).mockResolvedValueOnce(1);

    const result = await consume(TEST_PHONE, code);
    expect(result.status).toBe('ok');
    expect(result.otpId).toBe('otp-id-abc');
  });

  it('returns status=mismatch when code does not match stored hash', async () => {
    const salt = generateSalt();
    const { hashCode: hc } = await import('../otp');
    const correctHash = hc('123456', salt);

    // $queryRaw: returns active row
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([
      { id: 'otp-id-abc', codeHash: correctHash, salt, attemptCount: 0 },
    ]);
    // $executeRaw: increment attemptCount
    vi.mocked(prisma.$executeRaw).mockResolvedValueOnce(1);

    // Pass wrong code
    const result = await consume(TEST_PHONE, '999999');
    expect(result.status).toBe('mismatch');
  });

  it('returns status=gone when no active row exists', async () => {
    // $queryRaw: returns empty (no active row)
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([]);

    const result = await consume(TEST_PHONE, '000000');
    expect(result.status).toBe('gone');
  });

  it('returns attempt_cap when attemptCount >= MAX_OTP_ATTEMPTS without incrementing', async () => {
    const salt = generateSalt();
    const { hashCode: hc, MAX_OTP_ATTEMPTS } = await import('../otp');
    const storedHash = hc('123456', salt);

    // Row already has attemptCount at the cap
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([
      { id: 'otp-id-cap', codeHash: storedHash, salt, attemptCount: MAX_OTP_ATTEMPTS },
    ]);

    const result = await consume(TEST_PHONE, '999999');
    expect(result.status).toBe('attempt_cap');
    // Must NOT call $executeRaw (no increment, no consume)
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });

  it('returns mismatch (not attempt_cap) on the MAX_OTP_ATTEMPTS-th wrong attempt', async () => {
    const salt = generateSalt();
    const { hashCode: hc, MAX_OTP_ATTEMPTS } = await import('../otp');
    const correctHash = hc('123456', salt);

    // Row is one below the cap: this attempt will be the MAX_OTP_ATTEMPTS-th wrong code
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([
      { id: 'otp-id-near-cap', codeHash: correctHash, salt, attemptCount: MAX_OTP_ATTEMPTS - 1 },
    ]);
    vi.mocked(prisma.$executeRaw).mockResolvedValueOnce(1);

    const result = await consume(TEST_PHONE, '999999'); // wrong code
    expect(result.status).toBe('mismatch');
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
  });
});
