import { describe, it, expect } from 'vitest';
import { bookingDetailSelect } from '@/lib/core/db/bookingSelects';

describe('bookingDetailSelect', () => {
  it('includes operator.contactPhone (UI contract)', () => {
    expect(bookingDetailSelect.trip.select.bus.select.operator.select.contactPhone).toBe(true);
  });

  it('does not leak confirmationToken (access key, never re-rendered)', () => {
    expect('confirmationToken' in bookingDetailSelect).toBe(false);
  });

  it('does not leak operator financial fields (bankAccount, takeRate)', () => {
    const operatorSelect = bookingDetailSelect.trip.select.bus.select.operator.select as Record<string, unknown>;
    expect('bankAccount' in operatorSelect).toBe(false);
    expect('takeRate' in operatorSelect).toBe(false);
  });

  it('does not leak filter-only trip columns (salesClosed, status)', () => {
    const tripSelect = bookingDetailSelect.trip.select as Record<string, unknown>;
    expect('salesClosed' in tripSelect).toBe(false);
    expect('status' in tripSelect).toBe(false);
  });
});
