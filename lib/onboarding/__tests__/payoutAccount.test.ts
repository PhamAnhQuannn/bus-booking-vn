/**
 * Issue 078: unit tests for lib/onboarding/payoutAccount.ts.
 *
 * Covers:
 *   - maskAccountNumber keeps only last 4, masks the rest (short numbers fully masked)
 *   - setPayoutAccount UPSERTs and RESETS verification on BOTH create + update branches
 *   - getPayoutAccount returns a MASKED number (never the raw value); null when absent
 *   - getPayoutAccountInternal returns the UNMASKED number (payout-rail path)
 *   - isPayoutAccountVerified true only when verifiedAt != null
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// The module imports the prisma singleton at load; stub it so the real client
// (needs DATABASE_URL) is never constructed. Each test injects its own stub.
vi.mock('@/lib/core/db/client', () => ({ prisma: { payoutAccount: {} } }));

import { encryptBankField } from '@/lib/security';

import {
  maskAccountNumber,
  setPayoutAccount,
  getPayoutAccount,
  getPayoutAccountInternal,
  isPayoutAccountVerified,
} from '../payoutAccount';

function makePrisma() {
  const upsert = vi.fn().mockResolvedValue(undefined);
  const findUnique = vi.fn();
  return { prisma: { payoutAccount: { upsert, findUnique } } as never, upsert, findUnique };
}

beforeEach(() => vi.clearAllMocks());

describe('maskAccountNumber', () => {
  it('keeps only the last 4 digits', () => {
    expect(maskAccountNumber('0123456789')).toBe('••••6789');
    expect(maskAccountNumber('0123456789')).not.toContain('012345');
  });
  it('fully masks a 4-or-fewer-digit number', () => {
    expect(maskAccountNumber('1234')).toBe('••••');
    expect(maskAccountNumber('12')).toBe('••••');
  });
});

describe('setPayoutAccount', () => {
  it('upserts on operatorId, encrypts accountNumber, and resets verification', async () => {
    const { prisma, upsert } = makePrisma();
    await setPayoutAccount(prisma, {
      operatorId: 'op-1',
      bankName: 'Test Bank',
      accountNumber: '0123456789',
      accountHolderName: 'Acme Buses',
    });
    expect(upsert).toHaveBeenCalledTimes(1);
    const arg = upsert.mock.calls[0][0];
    expect(arg.where).toEqual({ operatorId: 'op-1' });
    // accountNumber stored encrypted (enc:v1: prefix), never plaintext
    expect(arg.create.accountNumber).toMatch(/^enc:v1:/);
    expect(arg.create.accountNumber).not.toContain('0123456789');
    expect(arg.update.accountNumber).toMatch(/^enc:v1:/);
    // create branch starts unverified
    expect(arg.create).toMatchObject({
      operatorId: 'op-1',
      bankName: 'Test Bank',
      accountHolderName: 'Acme Buses',
      verifiedAt: null,
      verifyMethod: null,
    });
    // update branch RE-ARMS verification (security: edit resets verify)
    expect(arg.update).toMatchObject({
      bankName: 'Test Bank',
      accountHolderName: 'Acme Buses',
      verifiedAt: null,
      verifyMethod: null,
    });
  });
});

describe('getPayoutAccount (masked display)', () => {
  it('decrypts then masks the account number', async () => {
    const { prisma, findUnique } = makePrisma();
    findUnique.mockResolvedValue({
      bankName: 'Test Bank',
      accountNumber: encryptBankField('0123456789'),
      accountHolderName: 'Acme Buses',
      verifiedAt: null,
      verifyMethod: null,
    });
    const acct = await getPayoutAccount(prisma, 'op-1');
    expect(acct).toEqual({
      bankName: 'Test Bank',
      accountNumberMasked: '••••6789',
      accountHolderName: 'Acme Buses',
      verifiedAt: null,
      verifyMethod: null,
    });
    expect(JSON.stringify(acct)).not.toContain('0123456789');
  });

  it('handles plaintext backward compat (pre-encryption rows)', async () => {
    const { prisma, findUnique } = makePrisma();
    findUnique.mockResolvedValue({
      bankName: 'Test Bank',
      accountNumber: '0123456789',
      accountHolderName: 'Acme Buses',
      verifiedAt: null,
      verifyMethod: null,
    });
    const acct = await getPayoutAccount(prisma, 'op-1');
    expect(acct?.accountNumberMasked).toBe('••••6789');
  });

  it('returns null when the operator has no account', async () => {
    const { prisma, findUnique } = makePrisma();
    findUnique.mockResolvedValue(null);
    expect(await getPayoutAccount(prisma, 'op-1')).toBeNull();
  });
});

describe('getPayoutAccountInternal (unmasked rail path)', () => {
  it('decrypts and returns the full number', async () => {
    const { prisma, findUnique } = makePrisma();
    findUnique.mockResolvedValue({
      bankName: 'Test Bank',
      accountNumber: encryptBankField('0123456789'),
      accountHolderName: 'Acme Buses',
      verifiedAt: new Date('2026-05-01T00:00:00Z'),
      verifyMethod: 'name_match',
    });
    const acct = await getPayoutAccountInternal(prisma, 'op-1');
    expect(acct?.accountNumber).toBe('0123456789');
  });

  it('handles plaintext backward compat', async () => {
    const { prisma, findUnique } = makePrisma();
    findUnique.mockResolvedValue({
      bankName: 'Test Bank',
      accountNumber: '9876543210',
      accountHolderName: 'Legacy',
      verifiedAt: null,
      verifyMethod: null,
    });
    const acct = await getPayoutAccountInternal(prisma, 'op-1');
    expect(acct?.accountNumber).toBe('9876543210');
  });
});

describe('isPayoutAccountVerified', () => {
  it('true only when verifiedAt is set', async () => {
    const { prisma, findUnique } = makePrisma();
    findUnique.mockResolvedValueOnce({ verifiedAt: new Date() });
    expect(await isPayoutAccountVerified(prisma, 'op-1')).toBe(true);
    findUnique.mockResolvedValueOnce({ verifiedAt: null });
    expect(await isPayoutAccountVerified(prisma, 'op-1')).toBe(false);
    findUnique.mockResolvedValueOnce(null);
    expect(await isPayoutAccountVerified(prisma, 'op-1')).toBe(false);
  });
});
