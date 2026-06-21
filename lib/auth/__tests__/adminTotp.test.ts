/**
 * Unit tests for lib/auth/adminTotp.ts (Issue 055).
 * Mocks prisma.adminUser + the totp primitive so the service logic (enrollment
 * state machine + verify gating) is tested in isolation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFindUnique, mockUpdate, mockVerifyTotp, mockConsumeJti } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockUpdate: vi.fn(),
  mockVerifyTotp: vi.fn(),
  mockConsumeJti: vi.fn(),
}));

vi.mock('@/lib/core/db/client', () => ({
  prisma: { adminUser: { findUnique: mockFindUnique, update: mockUpdate } },
}));

vi.mock('../totp', () => ({
  generateTotpSecret: () => 'GENERATEDSECRET234567',
  totpAuthUri: (secret: string, email: string) => `otpauth://totp/BusBookingVN:${email}?secret=${secret}`,
  verifyTotp: mockVerifyTotp,
}));

vi.mock('../otpProof', () => ({
  consumeJti: mockConsumeJti,
}));

import { beginEnrollment, confirmEnrollment, verifyLoginTotp } from '../adminTotp';

beforeEach(() => {
  vi.clearAllMocks();
  mockUpdate.mockResolvedValue({});
});

describe('beginEnrollment', () => {
  it('stores the generated secret WITHOUT setting totpEnabledAt, returns secret + otpauthUri', async () => {
    mockFindUnique.mockResolvedValue({ email: 'admin@example.com', totpEnabledAt: null });

    const result = await beginEnrollment('admin-1');

    expect(result.secret).toBe('GENERATEDSECRET234567');
    expect(result.otpauthUri).toContain('secret=GENERATEDSECRET234567');
    expect(result.otpauthUri).toContain('admin@example.com');

    // Persisted encrypted totpSecret, did NOT touch totpEnabledAt.
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'admin-1' },
      data: { totpSecret: expect.stringMatching(/^enc:v1:/) },
    });
    const dataArg = mockUpdate.mock.calls[0][0].data;
    expect(dataArg).not.toHaveProperty('totpEnabledAt');
  });

  it('throws already_enrolled when totpEnabledAt is set (no silent rotation)', async () => {
    mockFindUnique.mockResolvedValue({ email: 'admin@example.com', totpEnabledAt: new Date() });
    await expect(beginEnrollment('admin-1')).rejects.toThrow('already_enrolled');
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe('confirmEnrollment', () => {
  it('returns not_started when no secret has been stored', async () => {
    mockFindUnique.mockResolvedValue({ totpSecret: null });
    const result = await confirmEnrollment('admin-1', '123456');
    expect(result).toEqual({ ok: false, reason: 'not_started' });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('sets totpEnabledAt and returns ok on a valid code', async () => {
    mockFindUnique.mockResolvedValue({ totpSecret: 'STOREDSECRET234567' });
    mockVerifyTotp.mockReturnValue(true);

    const result = await confirmEnrollment('admin-1', '123456');

    expect(result).toEqual({ ok: true });
    expect(mockVerifyTotp).toHaveBeenCalledWith('STOREDSECRET234567', '123456');
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate.mock.calls[0][0].data.totpEnabledAt).toBeInstanceOf(Date);
  });

  it('returns bad_code and does NOT enable on a wrong code', async () => {
    mockFindUnique.mockResolvedValue({ totpSecret: 'STOREDSECRET234567' });
    mockVerifyTotp.mockReturnValue(false);

    const result = await confirmEnrollment('admin-1', '000000');

    expect(result).toEqual({ ok: false, reason: 'bad_code' });
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe('verifyLoginTotp', () => {
  it('returns enrollment_required when totpEnabledAt is null', async () => {
    mockFindUnique.mockResolvedValue({ totpSecret: 'STOREDSECRET234567', totpEnabledAt: null });
    const result = await verifyLoginTotp('admin-1', '123456');
    expect(result).toEqual({ ok: false, reason: 'enrollment_required' });
    expect(mockVerifyTotp).not.toHaveBeenCalled();
  });

  it('returns ok on a valid code when enabled (first use)', async () => {
    mockFindUnique.mockResolvedValue({ totpSecret: 'STOREDSECRET234567', totpEnabledAt: new Date() });
    mockVerifyTotp.mockReturnValue(true);
    mockConsumeJti.mockResolvedValue(true);
    const result = await verifyLoginTotp('admin-1', '123456');
    expect(result).toEqual({ ok: true });
    expect(mockConsumeJti).toHaveBeenCalledWith('totp-replay:admin-1:123456', 90);
  });

  it('returns code_already_used when same valid code replayed', async () => {
    mockFindUnique.mockResolvedValue({ totpSecret: 'STOREDSECRET234567', totpEnabledAt: new Date() });
    mockVerifyTotp.mockReturnValue(true);
    mockConsumeJti.mockResolvedValue(false);
    const result = await verifyLoginTotp('admin-1', '123456');
    expect(result).toEqual({ ok: false, reason: 'code_already_used' });
  });

  it('returns bad_code on a wrong code when enabled', async () => {
    mockFindUnique.mockResolvedValue({ totpSecret: 'STOREDSECRET234567', totpEnabledAt: new Date() });
    mockVerifyTotp.mockReturnValue(false);
    const result = await verifyLoginTotp('admin-1', '000000');
    expect(result).toEqual({ ok: false, reason: 'bad_code' });
  });
});
