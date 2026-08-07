import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { promisify } from 'util';

// P19: argon2 is now installed → hash() produces argon2id. Legacy scrypt$ hashes
// (minted by makeLegacyScryptHash below, mirroring the pre-P19 scrypt params) must
// still verify, and needsRehash() flags them for upgrade-on-login.

const scryptAsync = promisify(crypto.scrypt) as (
  password: crypto.BinaryLike,
  salt: crypto.BinaryLike,
  keylen: number,
  options: crypto.ScryptOptions
) => Promise<Buffer>;

async function makeLegacyScryptHash(plain: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = await scryptAsync(plain, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt}$${derived.toString('hex')}`;
}

describe('password (argon2id primary, scrypt fallback + legacy)', () => {
  it('hashes a password with the argon2id prefix', async () => {
    const { hash } = await import('../password');
    const stored = await hash('CorrectPassword1');
    expect(stored).toMatch(/^\$argon2id\$/);
  });

  it('verifies a correct argon2 password', async () => {
    const { hash, verify } = await import('../password');
    const stored = await hash('CorrectPassword1');
    expect(await verify(stored, 'CorrectPassword1')).toBe(true);
  });

  it('rejects a wrong argon2 password', async () => {
    const { hash, verify } = await import('../password');
    const stored = await hash('CorrectPassword1');
    expect(await verify(stored, 'WrongPassword1')).toBe(false);
  });

  it('still verifies a legacy scrypt$ hash (backward compat)', async () => {
    const { verify } = await import('../password');
    const legacy = await makeLegacyScryptHash('LegacyPass1');
    expect(await verify(legacy, 'LegacyPass1')).toBe(true);
    expect(await verify(legacy, 'WrongPass1')).toBe(false);
  });

  it('needsRehash: true for a legacy scrypt$ hash, false for argon2id', async () => {
    const { hash, needsRehash } = await import('../password');
    const legacy = await makeLegacyScryptHash('Upgrade1Me');
    expect(needsRehash(legacy)).toBe(true);
    const modern = await hash('Upgrade1Me');
    expect(needsRehash(modern)).toBe(false);
  });

  it('produces different hashes for the same password', async () => {
    const { hash } = await import('../password');
    const h1 = await hash('SamePass1');
    const h2 = await hash('SamePass1');
    expect(h1).not.toBe(h2);
  });

  it('dummyVerify resolves without throwing', async () => {
    const { dummyVerify } = await import('../password');
    await expect(dummyVerify()).resolves.toBeUndefined();
  });

  it('returns false for a corrupted scrypt hash (no second $)', async () => {
    const { verify } = await import('../password');
    expect(await verify('scrypt$notvalid', 'anything')).toBe(false);
  });
});
