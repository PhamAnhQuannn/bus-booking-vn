/**
 * Unit tests — BREACHED_PASSWORD at the change-password + reset-password call sites (#497).
 * Asserts the HIBP gate rejects BEFORE hashing/writing, and that reset checks it BEFORE the
 * one-shot OTP proof is consumed.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockBreached, mockVerify, mockHash, mockVerifyProof, mockFindFirst, mockTransaction } = vi.hoisted(
  () => ({
    mockBreached: vi.fn(),
    mockVerify: vi.fn(),
    mockHash: vi.fn(),
    mockVerifyProof: vi.fn(),
    mockFindFirst: vi.fn(),
    mockTransaction: vi.fn(),
  })
);

vi.mock('@/lib/auth', () => ({
  isPasswordBreached: mockBreached,
  verify: mockVerify,
  hash: mockHash,
  verifyOtpProof: mockVerifyProof,
}));
vi.mock('@/lib/core/db/client', () => ({
  prisma: { customer: { findFirst: mockFindFirst }, $transaction: mockTransaction },
}));

import { changePassword, ChangePasswordError } from '../changePassword';
import { resetPassword, ResetPasswordError } from '../resetPassword';

beforeEach(() => {
  vi.clearAllMocks();
  mockFindFirst.mockResolvedValue({ id: 'cust-1', passwordHash: 'old-hash' });
  // current password correct, new password differs from old
  mockVerify.mockImplementation(async (_h: string, plain: string) => plain === 'OldPass1');
  mockHash.mockResolvedValue('new-hash');
  mockVerifyProof.mockResolvedValue({ email: 'a@test.invalid', jti: 'j' });
  mockTransaction.mockResolvedValue(undefined);
  mockBreached.mockResolvedValue(false);
});

describe('changePassword — BREACHED_PASSWORD', () => {
  it('throws BREACHED_PASSWORD and never hashes or writes', async () => {
    mockBreached.mockResolvedValue(true);
    await expect(changePassword('cust-1', 'OldPass1', 'NewPass1')).rejects.toMatchObject({
      code: 'BREACHED_PASSWORD',
    });
    await expect(changePassword('cust-1', 'OldPass1', 'NewPass1')).rejects.toBeInstanceOf(ChangePasswordError);
    expect(mockBreached).toHaveBeenCalledWith('NewPass1');
    expect(mockHash).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('does not consult HIBP when the current password is wrong', async () => {
    await expect(changePassword('cust-1', 'WrongPass1', 'NewPass1')).rejects.toMatchObject({
      code: 'CURRENT_PASSWORD_WRONG',
    });
    expect(mockBreached).not.toHaveBeenCalled();
  });

  it('succeeds when not breached (fail-open path returns false)', async () => {
    await expect(changePassword('cust-1', 'OldPass1', 'NewPass1')).resolves.toBeUndefined();
    expect(mockHash).toHaveBeenCalledWith('NewPass1');
  });
});

describe('resetPassword — BREACHED_PASSWORD', () => {
  it('throws BREACHED_PASSWORD BEFORE consuming the one-shot proof', async () => {
    mockBreached.mockResolvedValue(true);
    await expect(resetPassword('proof', 'NewPass1')).rejects.toMatchObject({ code: 'BREACHED_PASSWORD' });
    await expect(resetPassword('proof', 'NewPass1')).rejects.toBeInstanceOf(ResetPasswordError);
    expect(mockVerifyProof).not.toHaveBeenCalled();
    expect(mockHash).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('succeeds when not breached', async () => {
    await expect(resetPassword('proof', 'NewPass1')).resolves.toBeUndefined();
    expect(mockVerifyProof).toHaveBeenCalledWith('proof', 'reset_password');
  });
});
