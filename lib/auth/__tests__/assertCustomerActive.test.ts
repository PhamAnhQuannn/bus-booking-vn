/**
 * Unit tests for lib/auth/assertCustomerActive.ts (P4) — the shared
 * "is this customer allowed to authenticate" predicate.
 */

import { describe, it, expect } from 'vitest';
import { checkCustomerActive } from '../assertCustomerActive';

describe('checkCustomerActive', () => {
  const now = new Date();

  it('is active when neither flag is set', () => {
    expect(checkCustomerActive({ suspendedAt: null, deletedAt: null })).toEqual({ active: true });
  });

  it('is inactive (suspended) when only suspendedAt is set', () => {
    expect(checkCustomerActive({ suspendedAt: now, deletedAt: null })).toEqual({
      active: false,
      reason: 'suspended',
    });
  });

  it('is inactive (deleted) when only deletedAt is set', () => {
    expect(checkCustomerActive({ suspendedAt: null, deletedAt: now })).toEqual({
      active: false,
      reason: 'deleted',
    });
  });

  it('prefers "deleted" over "suspended" when both are set', () => {
    expect(checkCustomerActive({ suspendedAt: now, deletedAt: now })).toEqual({
      active: false,
      reason: 'deleted',
    });
  });
});
