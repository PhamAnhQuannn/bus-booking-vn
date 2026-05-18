import { describe, it, expect } from 'vitest';
import { generateConfirmationToken, CONFIRMATION_TOKEN_REGEX } from '../confirmationToken';

describe('generateConfirmationToken', () => {
  it('produces a 32-char base64url string', () => {
    const t = generateConfirmationToken();
    expect(t).toMatch(CONFIRMATION_TOKEN_REGEX);
  });

  it('is non-repeating across 500 calls', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) seen.add(generateConfirmationToken());
    expect(seen.size).toBe(500);
  });

  it('uses url-safe alphabet only (no + / =)', () => {
    for (let i = 0; i < 50; i++) {
      const t = generateConfirmationToken();
      expect(t.includes('+')).toBe(false);
      expect(t.includes('/')).toBe(false);
      expect(t.includes('=')).toBe(false);
    }
  });
});
