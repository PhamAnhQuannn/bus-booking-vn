import { describe, it, expect } from 'vitest';
import { FORBIDDEN_RESPONSE_FIELDS } from './forbiddenFields';

// These imports pull the actual select whitelists used by production queries.
// If a forbidden field is added to any of these, this test fails.

describe('response shape - forbidden field assertions', () => {
  it('bookingDetailSelect has no forbidden fields', async () => {
    const { bookingDetailSelect } = await import('../../booking/bookingSelects');
    const keys = collectSelectKeys(bookingDetailSelect);
    for (const field of FORBIDDEN_RESPONSE_FIELDS) {
      expect(keys, `bookingDetailSelect leaks: ${field}`).not.toContain(field);
    }
  });

  it('searchResultSelect has no forbidden fields', async () => {
    const { searchResultSelect } = await import('../../core/db/selects');
    const keys = collectSelectKeys(searchResultSelect);
    for (const field of FORBIDDEN_RESPONSE_FIELDS) {
      expect(keys, `searchResultSelect leaks: ${field}`).not.toContain(field);
    }
  });

  it('bookingDetailSelect does not expose confirmationToken', async () => {
    const { bookingDetailSelect } = await import('../../booking/bookingSelects');
    const keys = collectSelectKeys(bookingDetailSelect);
    expect(keys).not.toContain('confirmationToken');
  });

  it('searchResultSelect does not expose internal status fields', async () => {
    const { searchResultSelect } = await import('../../core/db/selects');
    const keys = collectSelectKeys(searchResultSelect);
    expect(keys).not.toContain('salesClosed');
    expect(keys).not.toContain('cancelledAt');
  });
});

/**
 * Extract all field names from a Prisma select object (including nested selects).
 * For `{ id: true, trip: { select: { price: true } } }` returns ['id', 'trip', 'price'].
 */
function collectSelectKeys(select: Record<string, unknown>): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(select)) {
    keys.push(key);
    if (value && typeof value === 'object' && 'select' in (value as Record<string, unknown>)) {
      const nested = (value as { select: Record<string, unknown> }).select;
      keys.push(...collectSelectKeys(nested));
    }
  }
  return keys;
}
