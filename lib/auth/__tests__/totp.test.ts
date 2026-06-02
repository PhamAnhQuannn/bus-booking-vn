/**
 * Unit tests for the TOTP primitive (issue 055) — RFC 6238 / RFC 4226.
 *
 * Validates against the published RFC 6238 SHA-1 test vector so the node-crypto
 * implementation is provably correct (no external otp library).
 */

import { describe, it, expect } from 'vitest';
import {
  base32Encode,
  base32Decode,
  generateTotp,
  verifyTotp,
  generateTotpSecret,
  totpAuthUri,
} from '../totp';

// RFC 6238 Appendix B seed: ASCII "12345678901234567890" → Base32.
const RFC_SECRET_B32 = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

describe('base32', () => {
  it('round-trips an arbitrary buffer', () => {
    const buf = Buffer.from('12345678901234567890', 'ascii');
    expect(base32Decode(base32Encode(buf)).equals(buf)).toBe(true);
  });

  it('decodes the RFC seed to the ASCII secret', () => {
    expect(base32Decode(RFC_SECRET_B32).toString('ascii')).toBe('12345678901234567890');
  });
});

describe('generateTotp — RFC 6238 SHA-1 vectors (6-digit)', () => {
  // The RFC publishes 8-digit codes; a 6-digit TOTP is the low 6 digits.
  // T=59s → counter 1 → 8-digit 94287082 → 6-digit 287082.
  it('T=59s (counter 1) → 287082', () => {
    expect(generateTotp(RFC_SECRET_B32, 1)).toBe('287082');
  });

  // T=1111111109 → counter 37037036 → 8-digit 07081804 → 6-digit 081804.
  it('T=1111111109 (counter 37037036) → 081804', () => {
    expect(generateTotp(RFC_SECRET_B32, 37037036)).toBe('081804');
  });

  // T=1234567890 → counter 41152263 → 8-digit 89005924 → 6-digit 005924.
  it('T=1234567890 (counter 41152263) → 005924', () => {
    expect(generateTotp(RFC_SECRET_B32, 41152263)).toBe('005924');
  });
});

describe('verifyTotp', () => {
  it('accepts the correct code at the matching time', () => {
    expect(verifyTotp(RFC_SECRET_B32, '287082', 59 * 1000)).toBe(true);
  });

  it('accepts a code from the adjacent step (±1 window)', () => {
    // Code valid at counter 1 (T=59) should still verify one step later (T=89).
    expect(verifyTotp(RFC_SECRET_B32, '287082', 89 * 1000, 1)).toBe(true);
  });

  it('rejects a code outside the window', () => {
    expect(verifyTotp(RFC_SECRET_B32, '287082', 5_000_000 * 1000, 1)).toBe(false);
  });

  it('rejects a wrong code', () => {
    expect(verifyTotp(RFC_SECRET_B32, '000000', 59 * 1000)).toBe(false);
  });

  it('rejects malformed input (non-6-digit)', () => {
    expect(verifyTotp(RFC_SECRET_B32, '12345', 59 * 1000)).toBe(false);
    expect(verifyTotp(RFC_SECRET_B32, 'abcdef', 59 * 1000)).toBe(false);
    expect(verifyTotp(RFC_SECRET_B32, '', 59 * 1000)).toBe(false);
  });
});

describe('generateTotpSecret / totpAuthUri', () => {
  it('generates a decodable base32 secret', () => {
    const s = generateTotpSecret();
    expect(s).toMatch(/^[A-Z2-7]+$/);
    expect(base32Decode(s).length).toBe(20); // 20 random bytes
  });

  it('builds an otpauth:// URI carrying the secret + issuer', () => {
    const uri = totpAuthUri('GEZDGNBVGY3TQOJQ', 'admin@example.com', 'BusBookingVN');
    expect(uri).toMatch(/^otpauth:\/\/totp\//);
    expect(uri).toContain('secret=GEZDGNBVGY3TQOJQ');
    expect(uri).toContain('issuer=BusBookingVN');
  });
});
