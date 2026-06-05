/**
 * VN phone number normalizer → E.164 (+84...) format.
 *
 * Accepted input formats:
 *   - 09xxxxxxxx  → +849xxxxxxxx
 *   - 084xxxxxxxx → +849xxxxxxxx  (leading 0 before 84)  [not standard, rejected]
 *   - 849xxxxxxxx → +849xxxxxxxx  (missing leading +)
 *   - +849xxxxxxxx → +849xxxxxxxx (already E.164)
 *
 * Valid VN mobile prefixes after country code: 3, 5, 7, 8, 9
 * (maps to 03x, 05x, 07x, 08x, 09x local format)
 *
 * Throws PhoneNormalizeError on invalid input.
 */

export class PhoneNormalizeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PhoneNormalizeError';
  }
}

/**
 * Normalise a VN phone number to E.164 (+84xxxxxxxxx).
 * Returns the normalized string or throws PhoneNormalizeError.
 */
export function normalizePhone(raw: string): string {
  const trimmed = raw.trim();

  let digits: string;

  if (trimmed.startsWith('+84')) {
    // +84xxxxxxxxx
    digits = '84' + trimmed.slice(3);
  } else if (trimmed.startsWith('84') && !trimmed.startsWith('0')) {
    // 84xxxxxxxxx (no leading +)
    digits = trimmed;
  } else if (trimmed.startsWith('0')) {
    // 0xxxxxxxxx local format → replace leading 0 with 84
    digits = '84' + trimmed.slice(1);
  } else {
    throw new PhoneNormalizeError(`Invalid phone number format: ${trimmed}`);
  }

  // digits is now "84" + 9 digits = 11 chars total
  if (!/^84[35789][0-9]{8}$/.test(digits)) {
    throw new PhoneNormalizeError(`Invalid VN phone prefix or length: ${trimmed}`);
  }

  return '+' + digits;
}
