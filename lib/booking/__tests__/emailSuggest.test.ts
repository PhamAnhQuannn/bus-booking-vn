import { describe, it, expect } from 'vitest';
import { suggestEmail } from '../emailSuggest';

describe('suggestEmail', () => {
  it('fixes the reported cases: wrong TLD on a popular domain', () => {
    expect(suggestEmail('123@gmail.co')).toBe('123@gmail.com');
    expect(suggestEmail('a@gmail.con')).toBe('a@gmail.com');
    expect(suggestEmail('a@gmail.cm')).toBe('a@gmail.com');
    expect(suggestEmail('a@hotmail.co')).toBe('a@hotmail.com');
  });

  it('fixes SLD transposition/omission typos', () => {
    expect(suggestEmail('a@gmial.com')).toBe('a@gmail.com');
    expect(suggestEmail('a@gamil.com')).toBe('a@gmail.com');
    expect(suggestEmail('a@yaho.com')).toBe('a@yahoo.com');
    expect(suggestEmail('a@hotmial.com')).toBe('a@hotmail.com');
  });

  it('returns null for already-correct popular domains', () => {
    expect(suggestEmail('a@gmail.com')).toBeNull();
    expect(suggestEmail('a@yahoo.com')).toBeNull();
    expect(suggestEmail('a@yahoo.com.vn')).toBeNull();
    expect(suggestEmail('a@fpt.com.vn')).toBeNull();
  });

  it('does NOT flag unknown-but-plausible domains (no false positive)', () => {
    expect(suggestEmail('a@mycompany.xyz')).toBeNull();
    expect(suggestEmail('a@fpt.vn')).toBeNull(); // real domain, not a typo of the list
    expect(suggestEmail('a@mail.gmail.com')).toBeNull(); // legit subdomain
    expect(suggestEmail('a@somebusiness.com.vn')).toBeNull();
  });

  it('returns null for non-email / no-domain input', () => {
    expect(suggestEmail('notanemail')).toBeNull();
    expect(suggestEmail('a@localhost')).toBeNull(); // no dot in domain
    expect(suggestEmail('@gmail.com')).toBeNull(); // empty local
    expect(suggestEmail('a@')).toBeNull();
    expect(suggestEmail('')).toBeNull();
  });

  it('normalizes case + whitespace before checking', () => {
    expect(suggestEmail('  A@GMAIL.CO  ')).toBe('a@gmail.com');
    expect(suggestEmail('User@Gmail.Com')).toBeNull(); // correct once lowercased
  });

  it('preserves the local part verbatim', () => {
    expect(suggestEmail('nguyen.van.a+ve@gmail.co')).toBe('nguyen.van.a+ve@gmail.com');
  });
});
