import { describe, it, expect } from 'vitest';
import { encryptTotpSecret, decryptTotpSecret } from '../totpCrypto';

describe('totpCrypto', () => {
  it('round-trip: encrypt then decrypt returns original', () => {
    const secret = 'JBSWY3DPEHPK3PXP';
    expect(decryptTotpSecret(encryptTotpSecret(secret))).toBe(secret);
  });

  it('plaintext passthrough: no enc:v1: prefix returns input unchanged', () => {
    expect(decryptTotpSecret('SOME_PLAIN_SECRET')).toBe('SOME_PLAIN_SECRET');
  });

  it('encrypted format starts with enc:v1:', () => {
    expect(encryptTotpSecret('secret')).toMatch(/^enc:v1:/);
  });

  it('unique IVs: same plaintext produces different ciphertexts', () => {
    const plain = 'JBSWY3DPEHPK3PXP';
    const a = encryptTotpSecret(plain);
    const b = encryptTotpSecret(plain);
    expect(a).not.toBe(b);
  });

  it('tampered ciphertext throws on decrypt', () => {
    const encrypted = encryptTotpSecret('secret');
    const b64 = encrypted.slice('enc:v1:'.length);
    const buf = Buffer.from(b64, 'base64');
    // Flip a byte in the middle of the ciphertext (past the 12-byte IV)
    buf[14] ^= 0xff;
    const tampered = `enc:v1:${buf.toString('base64')}`;
    expect(() => decryptTotpSecret(tampered)).toThrow();
  });
});
