/**
 * Issue 078: unit tests for lib/onboarding/payoutVerify.ts.
 *
 * Covers:
 *   - nameMatchScore: exact match=1; case/diacritic/space/punctuation insensitive;
 *     company-suffix stripped; unrelated names low; empty → 0.
 *   - confirmPayoutAccountOwnership: sets verifiedAt+verifyMethod + writes audit;
 *     throws payout_account_not_found when no account; audit args carry method only.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  nameMatchScore,
  confirmPayoutAccountOwnership,
  PayoutVerifyError,
  NAME_MATCH_VERIFY_THRESHOLD,
} from '../payoutVerify';

describe('nameMatchScore', () => {
  it('scores an exact match as 1 and suggests verified', () => {
    const r = nameMatchScore('Acme Buses', 'Acme Buses');
    expect(r.score).toBe(1);
    expect(r.suggestVerified).toBe(true);
  });

  it('is case / whitespace / punctuation insensitive', () => {
    expect(nameMatchScore('  acme   buses ', 'ACME, BUSES.').score).toBe(1);
  });

  it('is diacritic insensitive (Vietnamese)', () => {
    // "Công ty Vận Tải" vs "CONG TY VAN TAI" — strip diacritics + đ.
    const r = nameMatchScore('Vận Tải Đông', 'VAN TAI DONG');
    expect(r.score).toBe(1);
    expect(r.suggestVerified).toBe(true);
  });

  it('strips common company-form suffixes (TNHH/CTY/CO/LTD/JSC)', () => {
    // Significant tokens reduce to "ACME BUSES" on both sides.
    const r = nameMatchScore('Acme Buses', 'CTY TNHH Acme Buses JSC');
    expect(r.score).toBe(1);
    expect(r.suggestVerified).toBe(true);
  });

  it('scores a partial overlap below 1 (token Jaccard)', () => {
    // {ACME, BUSES} vs {ACME, COACHES} → intersection 1 / union 3 ≈ 0.333.
    const r = nameMatchScore('Acme Buses', 'Acme Coaches');
    expect(r.score).toBeCloseTo(1 / 3, 5);
    expect(r.suggestVerified).toBe(false);
  });

  it('scores unrelated names at 0', () => {
    const r = nameMatchScore('Acme Buses', 'Zenith Travel');
    expect(r.score).toBe(0);
    expect(r.suggestVerified).toBe(false);
  });

  it('returns 0 when either side has no significant tokens', () => {
    expect(nameMatchScore('', 'Acme').score).toBe(0);
    expect(nameMatchScore('CTY TNHH', 'Acme Buses').score).toBe(0); // all suffix tokens
  });

  it('suggestVerified threshold is 0.8', () => {
    expect(NAME_MATCH_VERIFY_THRESHOLD).toBe(0.8);
  });
});

describe('confirmPayoutAccountOwnership', () => {
  function makePrisma(account: unknown) {
    const findUnique = vi.fn().mockResolvedValue(account);
    const update = vi.fn().mockResolvedValue(undefined);
    const create = vi.fn().mockResolvedValue(undefined);
    return {
      prisma: {
        payoutAccount: { findUnique, update },
        adminAuditLog: { create },
      } as never,
      findUnique,
      update,
      auditCreate: create,
    };
  }

  beforeEach(() => vi.clearAllMocks());

  it('sets verifiedAt + verifyMethod and writes the audit row', async () => {
    const { prisma, update, auditCreate } = makePrisma({ id: 'pa-1' });
    await confirmPayoutAccountOwnership(prisma, {
      operatorId: 'op-1',
      method: 'name_match',
      actor: 'admin:adm-1',
    });

    expect(update).toHaveBeenCalledTimes(1);
    const upd = update.mock.calls[0][0];
    expect(upd.where).toEqual({ operatorId: 'op-1' });
    expect(upd.data.verifyMethod).toBe('name_match');
    expect(upd.data.verifiedAt).toBeInstanceOf(Date);

    expect(auditCreate).toHaveBeenCalledTimes(1);
    const audit = auditCreate.mock.calls[0][0].data;
    expect(audit).toMatchObject({
      actor: 'admin:adm-1',
      action: 'verify-payout-account',
      target: 'op-1',
    });
    // args carry the method ONLY — never the account number.
    expect(audit.argsRedacted).toBe(JSON.stringify({ method: 'name_match' }));
  });

  it('throws payout_account_not_found when the operator has no account', async () => {
    const { prisma, update } = makePrisma(null);
    await expect(
      confirmPayoutAccountOwnership(prisma, {
        operatorId: 'op-x',
        method: 'name_match',
        actor: 'admin:adm-1',
      })
    ).rejects.toMatchObject({ code: 'payout_account_not_found' });
    await expect(
      confirmPayoutAccountOwnership(prisma, {
        operatorId: 'op-x',
        method: 'name_match',
        actor: 'admin:adm-1',
      })
    ).rejects.toBeInstanceOf(PayoutVerifyError);
    expect(update).not.toHaveBeenCalled();
  });

  it('records micro_deposit method when supplied', async () => {
    const { prisma, auditCreate } = makePrisma({ id: 'pa-1' });
    await confirmPayoutAccountOwnership(prisma, {
      operatorId: 'op-1',
      method: 'micro_deposit',
      actor: 'admin:adm-1',
    });
    expect(auditCreate.mock.calls[0][0].data.argsRedacted).toBe(
      JSON.stringify({ method: 'micro_deposit' })
    );
  });
});
