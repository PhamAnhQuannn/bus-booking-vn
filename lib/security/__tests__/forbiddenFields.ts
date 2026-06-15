/**
 * Fields that must NEVER appear in API response bodies.
 * Used by response-shape tests to catch accidental field exposure.
 */
export const FORBIDDEN_RESPONSE_FIELDS = [
  'passwordHash',
  'tempPasswordPlain',
  'tempPassword',
  'otpCode',
  'codeHash',
  'refreshTokenHash',
  'totpSecret',
  'confirmationToken',
] as const;

/**
 * Recursively extract all keys from a nested object in dot-notation.
 * Example: { a: { b: 1 }, c: 2 } → ['a', 'a.b', 'c']
 */
export function flattenKeys(obj: unknown, prefix = ''): string[] {
  if (obj === null || obj === undefined || typeof obj !== 'object') return [];
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    keys.push(fullKey);
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...flattenKeys(value, fullKey));
    }
  }
  return keys;
}
