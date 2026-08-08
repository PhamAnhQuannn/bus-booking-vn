import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { promisify } from 'util';

// P19: argon2id is OPT-IN via AUTH_ARGON2_ENABLED (default OFF → scrypt, the pre-P19 baseline;
// the native argon2 addon can segfault on some Linux/Node runners, so CI stays on scrypt). The
// default-path tests below assert the scrypt default; the argon2-specific cases run ONLY when the
// flag is set in the environment (a runner that has verified argon2 loads) — never forced on here,
// so CI never loads the addon. Legacy `scrypt$` hashes must always verify + flag for rehash.
const ARGON2_ON = process.env.AUTH_ARGON2_ENABLED === 'true';

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

describe('password (scrypt default, argon2id opt-in + legacy compat)', () => {
  it('hashes a password with the default algorithm prefix', async () => {
    const { hash } = await import('../password');
    const stored = await hash('CorrectPassword1');
    expect(stored).toMatch(ARGON2_ON ? /^\$argon2id\$/ : /^scrypt\$/);
  });

  it('verifies a correct password (round-trip)', async () => {
    const { hash, verify } = await import('../password');
    const stored = await hash('CorrectPassword1');
    expect(await verify(stored, 'CorrectPassword1')).toBe(true);
  });

  it('rejects a wrong password', async () => {
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

  it('needsRehash: true for a legacy scrypt$ hash', async () => {
    const { needsRehash } = await import('../password');
    const legacy = await makeLegacyScryptHash('Upgrade1Me');
    expect(needsRehash(legacy)).toBe(true);
  });

  it.skipIf(!ARGON2_ON)('needsRehash: false for an argon2id hash (argon2 enabled)', async () => {
    const { hash, needsRehash } = await import('../password');
    const modern = await hash('Upgrade1Me');
    expect(modern).toMatch(/^\$argon2id\$/);
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
