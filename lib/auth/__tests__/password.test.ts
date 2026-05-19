import { describe, it, expect } from 'vitest';

// argon2 is not installed — all paths use scrypt fallback

describe('password (scrypt path)', () => {
  it('hashes a password with scrypt prefix', async () => {
    const { hash } = await import('../password');
    const stored = await hash('CorrectPassword1');
    // argon2 not installed → falls back to scrypt
    expect(stored).toMatch(/^scrypt\$/);
  });

  it('verifies correct password returns true', async () => {
    const { hash, verify } = await import('../password');
    const stored = await hash('CorrectPassword1');
    expect(await verify(stored, 'CorrectPassword1')).toBe(true);
  });

  it('verifies wrong password returns false', async () => {
    const { hash, verify } = await import('../password');
    const stored = await hash('CorrectPassword1');
    expect(await verify(stored, 'WrongPassword1')).toBe(false);
  });

  it('produces different salts for same password', async () => {
    const { hash } = await import('../password');
    const h1 = await hash('SamePass1');
    const h2 = await hash('SamePass1');
    expect(h1).not.toBe(h2);
  });

  it('dummyVerify resolves without throwing', async () => {
    const { dummyVerify } = await import('../password');
    await expect(dummyVerify()).resolves.toBeUndefined();
  });

  it('returns false for corrupted scrypt hash (no second $)', async () => {
    const { verify } = await import('../password');
    expect(await verify('scrypt$notvalid', 'anything')).toBe(false);
  });
});
