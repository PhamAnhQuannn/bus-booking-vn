import { describe, it, expect } from 'vitest';
import { redactPhone } from '../redactPhone';

// The single invariant that matters: a masked phone must NEVER match the project's
// gitleaks PII regex, or the mask defeats its own purpose (AGENTS.md Mistake Log 001).
// Kept in sync with .gitleaks.toml.
const GITLEAKS_VN_PHONE = /\+84[35789]\d{8}/;

describe('redactPhone', () => {
  it('keeps only the last 4 digits, masks the rest with literal x', () => {
    expect(redactPhone('+84901234567')).toBe('+xxxxxxx4567'); // doc example
  });

  it('masks a string of exactly 4 chars entirely (no negative slice)', () => {
    expect(redactPhone('1234')).toBe('xxxx');
  });

  it('masks a string shorter than 4 chars', () => {
    expect(redactPhone('12')).toBe('xx');
    expect(redactPhone('9')).toBe('x');
  });

  it('only replaces digits, preserving formatting characters', () => {
    // Last 4 digits kept; every earlier DIGIT → x, spaces/plus untouched.
    expect(redactPhone('+84 90 123 4567')).toBe('+xx xx xxx 4567');
  });

  it('INVARIANT: masked output never matches the gitleaks VN-phone regex', () => {
    // Every valid VN mobile prefix ([35789] after +84) → masked output must not match.
    const prefixes = ['3', '5', '7', '8', '9'];
    for (const p of prefixes) {
      const phone = `+84${p}01234567`; // +84 + prefix + 8 digits = valid shape
      const masked = redactPhone(phone);
      expect(GITLEAKS_VN_PHONE.test(phone)).toBe(true); // the raw value DOES match
      expect(GITLEAKS_VN_PHONE.test(masked)).toBe(false); // the masked value must NOT
    }
  });

  it('the mask leaves no 8-digit run behind the +84 (the exact collision the x defeats)', () => {
    const masked = redactPhone('+84987654321');
    // \d{8} can never consume an x — so no 8-digit run survives except the kept last-4.
    expect(masked).not.toMatch(/\d{8}/);
  });
});
