/**
 * Unit tests for PatchOperatorProfileSchema (lib/auth/types.ts).
 *
 * Regression: blank optional phone fields ('') must coerce to "no change"
 * (undefined), not 400 the whole PATCH. The shared phoneSchema (login) stays
 * strict — only this patch schema tolerates ''. See operator-smoke 2026-06-05.
 */

import { describe, it, expect } from 'vitest';
import { PatchOperatorProfileSchema } from '../types';

describe('PatchOperatorProfileSchema', () => {
  it('accepts blank phone fields when only displayName changes', () => {
    const parsed = PatchOperatorProfileSchema.safeParse({
      displayName: 'Seed Operator Admin',
      contactPhone: '',
      notificationPhone: '',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.contactPhone).toBeUndefined();
      expect(parsed.data.notificationPhone).toBeUndefined();
      expect(parsed.data.displayName).toBe('Seed Operator Admin');
    }
  });

  it('still validates non-blank phone format', () => {
    expect(
      PatchOperatorProfileSchema.safeParse({ contactPhone: 'not-a-phone' }).success
    ).toBe(false);
  });

  it('accepts a valid VN phone', () => {
    const parsed = PatchOperatorProfileSchema.safeParse({ contactPhone: '+84901234567' });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.contactPhone).toBe('+84901234567');
  });
});
