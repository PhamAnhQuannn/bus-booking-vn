/**
 * Shared forbidden-field guard for e2e response-shape assertions.
 *
 * Extracted from data-leak-smoke.spec.ts so multiple specs (data-leak, account-rights)
 * assert the same never-serialize set against real HTTP JSON bodies.
 */

import { expect } from '@playwright/test';

/** Internal secrets that must never appear in any API JSON response. */
export const FORBIDDEN_FIELDS = [
  'passwordHash',
  'tempPasswordPlain',
  'tempPassword',
  'otpCode',
  'codeHash',
  'refreshTokenHash',
  'totpSecret',
  'confirmationToken',
];

/** Every leaf key-path in a nested object (arrays are descended into element-wise). */
export function collectKeys(obj: unknown, prefix = ''): string[] {
  if (!obj || typeof obj !== 'object') return [];
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const full = prefix ? `${prefix}.${key}` : key;
    keys.push(full);
    if (Array.isArray(value)) {
      for (const el of value) keys.push(...collectKeys(el, full));
    } else if (value && typeof value === 'object') {
      keys.push(...collectKeys(value, full));
    }
  }
  return keys;
}

/** Assert a parsed JSON body carries none of the forbidden fields (at any depth). */
export function expectNoForbiddenFields(json: unknown, label = 'response'): void {
  const keys = collectKeys(json);
  for (const field of FORBIDDEN_FIELDS) {
    expect(
      keys.some((k) => k === field || k.endsWith(`.${field}`)),
      `${label} leaks forbidden field: ${field}`,
    ).toBe(false);
  }
}
