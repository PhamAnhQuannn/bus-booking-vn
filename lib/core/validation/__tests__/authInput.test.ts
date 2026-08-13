/**
 * Unit tests for lib/core/validation/auth.ts normalization guarantees.
 *
 * These are the case-normalization invariants the auth layer relies on: operator usernames
 * are matched case-sensitively against the stored value (BRAND_ACRONYM-last4phone, uppercase),
 * and customer emails are the case-stable account key.
 */

import { describe, it, expect } from 'vitest';
import { operatorLoginInput, registerInput, loginInput } from '../auth';

describe('operatorLoginInput.username normalization (#452)', () => {
  it('upper-cases a lower-case username so it matches the stored value', () => {
    const parsed = operatorLoginInput.parse({ username: 'pb-0001', password: 'x' });
    expect(parsed.username).toBe('PB-0001');
  });

  it('trims surrounding whitespace before upper-casing', () => {
    const parsed = operatorLoginInput.parse({ username: '  pb-0001  ', password: 'x' });
    expect(parsed.username).toBe('PB-0001');
  });

  it('leaves an already-upper-case username unchanged', () => {
    const parsed = operatorLoginInput.parse({ username: 'PB-0001', password: 'x' });
    expect(parsed.username).toBe('PB-0001');
  });
});

describe('customer email normalization (case-stable account key)', () => {
  it('register lower-cases + trims the email', () => {
    const parsed = registerInput.parse({ email: '  User@Example.COM  ', password: 'Password1' });
    expect(parsed.email).toBe('user@example.com');
  });

  it('login lower-cases + trims the email', () => {
    const parsed = loginInput.parse({ email: 'User@Example.COM', password: 'Password1' });
    expect(parsed.email).toBe('user@example.com');
  });
});
