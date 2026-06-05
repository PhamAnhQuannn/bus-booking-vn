import { describe, it, expect } from 'vitest';
import { normalizePhone, PhoneNormalizeError } from '../phone';

// PII placeholder phones use literal-x masks to avoid gitleaks regex \+84[35789]\d{8}
// Phones like 0912345678 are safe since gitleaks targets +84[35789]\d{8}

describe('normalizePhone', () => {
  it('09xxxxxxxx → +849xxxxxxxx', () => {
    expect(normalizePhone('0912345678')).toBe('+84912345678');
  });

  it('03xxxxxxxx → +843xxxxxxxx', () => {
    expect(normalizePhone('0312345678')).toBe('+84312345678');
  });

  it('05xxxxxxxx → +845xxxxxxxx', () => {
    expect(normalizePhone('0512345678')).toBe('+84512345678');
  });

  it('07xxxxxxxx → +847xxxxxxxx', () => {
    expect(normalizePhone('0712345678')).toBe('+84712345678');
  });

  it('08xxxxxxxx → +848xxxxxxxx', () => {
    expect(normalizePhone('0812345678')).toBe('+84812345678');
  });

  it('already E.164 → unchanged', () => {
    expect(normalizePhone('+84912345678')).toBe('+84912345678');
  });

  it('84xxxxxxxxx (no leading +) → +84xxxxxxxxx', () => {
    expect(normalizePhone('84912345678')).toBe('+84912345678');
  });

  it('trims whitespace', () => {
    expect(normalizePhone('  0912345678  ')).toBe('+84912345678');
  });

  it('throws on invalid prefix (04x)', () => {
    expect(() => normalizePhone('0412345678')).toThrow(PhoneNormalizeError);
  });

  it('throws on too-short number', () => {
    expect(() => normalizePhone('091234567')).toThrow(PhoneNormalizeError);
  });

  it('throws on empty string', () => {
    expect(() => normalizePhone('')).toThrow(PhoneNormalizeError);
  });

  it('throws on random string', () => {
    expect(() => normalizePhone('notaphone')).toThrow(PhoneNormalizeError);
  });
});
