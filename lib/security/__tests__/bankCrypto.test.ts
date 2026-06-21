import { describe, it, expect } from 'vitest';
import { encryptBankField, decryptBankField } from '../bankCrypto';

describe('bankCrypto', () => {
  it('round-trips: encrypt then decrypt returns original', () => {
    const plain = '0123456789';
    const encrypted = encryptBankField(plain);
    expect(encrypted).toMatch(/^enc:v1:/);
    expect(encrypted).not.toContain(plain);
    expect(decryptBankField(encrypted)).toBe(plain);
  });

  it('produces different ciphertext each call (random IV)', () => {
    const plain = '9876543210';
    const a = encryptBankField(plain);
    const b = encryptBankField(plain);
    expect(a).not.toBe(b);
    expect(decryptBankField(a)).toBe(plain);
    expect(decryptBankField(b)).toBe(plain);
  });

  it('passes through plaintext on decrypt (backward compat)', () => {
    expect(decryptBankField('0123456789')).toBe('0123456789');
  });

  it('handles empty string', () => {
    const encrypted = encryptBankField('');
    expect(decryptBankField(encrypted)).toBe('');
  });

  it('handles long account numbers', () => {
    const long = '1'.repeat(100);
    const encrypted = encryptBankField(long);
    expect(decryptBankField(encrypted)).toBe(long);
  });
});
