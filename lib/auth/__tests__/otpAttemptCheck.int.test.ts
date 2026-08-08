/**
 * Integration test for P23 (#445) — the OtpAttempt "exactly one of phone/email"
 * CHECK constraint (migration 20260806130000). Requires DATABASE_URL + the
 * migration applied. Violations raise SQLSTATE 23514.
 */

import crypto from 'crypto';
import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '@/lib/core/db/client';

const ids: string[] = [];

function base(extra: Record<string, unknown>) {
  const id = crypto.randomUUID();
  ids.push(id);
  return {
    id,
    codeHash: 'x'.repeat(64),
    salt: 'salt',
    expiresAt: new Date(Date.now() + 60_000),
    ...extra,
  };
}

afterAll(async () => {
  await prisma.otpAttempt.deleteMany({ where: { id: { in: ids } } });
});

describe('OtpAttempt exactly-one-identifier CHECK (P23)', () => {
  it('accepts an email-only row', async () => {
    await expect(
      prisma.otpAttempt.create({ data: base({ email: `p23-${crypto.randomBytes(3).toString('hex')}@t.dev` }) })
    ).resolves.toBeTruthy();
  });

  it('accepts a phone-only row', async () => {
    await expect(
      prisma.otpAttempt.create({ data: base({ phone: '+8490xxxxxx3' }) })
    ).resolves.toBeTruthy();
  });

  it('rejects a row with BOTH phone and email (23514)', async () => {
    await expect(
      prisma.otpAttempt.create({ data: base({ phone: '+8490xxxxxx3', email: 'both@t.dev' }) })
    ).rejects.toMatchObject({ message: expect.stringContaining('OtpAttempt_exactly_one_identifier') });
  });

  it('rejects a row with NEITHER phone nor email (23514)', async () => {
    await expect(prisma.otpAttempt.create({ data: base({}) })).rejects.toMatchObject({
      message: expect.stringContaining('OtpAttempt_exactly_one_identifier'),
    });
  });
});
