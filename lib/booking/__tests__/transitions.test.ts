/**
 * Unit tests for the single-source booking-status transition guard (issue 034).
 *
 * The map is the ONE place legal forward transitions live; the payment webhook
 * derives its UPDATE predecessors from `legalPredecessors`, never from scattered
 * `WHERE status = 'awaiting_payment'` literals.
 */

import { describe, it, expect } from 'vitest';
import {
  isLegalTransition,
  legalPredecessors,
  LEGAL_BOOKING_TRANSITIONS,
} from '../transitions';

describe('booking transition guard — legal forward moves', () => {
  it('allows awaiting_payment → paid (webhook success)', () => {
    expect(isLegalTransition('awaiting_payment', 'paid')).toBe(true);
  });

  it('allows awaiting_payment → payment_failed_expired (webhook failure)', () => {
    expect(isLegalTransition('awaiting_payment', 'payment_failed_expired')).toBe(true);
  });

  it('allows paid → completed (trip completes)', () => {
    expect(isLegalTransition('paid', 'completed')).toBe(true);
  });

  it('allows paid → trip_cancelled (operator cancels trip)', () => {
    expect(isLegalTransition('paid', 'trip_cancelled')).toBe(true);
  });
});

describe('booking transition guard — illegal / backward moves rejected', () => {
  it('rejects paid → awaiting_payment (regress)', () => {
    expect(isLegalTransition('paid', 'awaiting_payment')).toBe(false);
  });

  it('rejects completed → paid (regress)', () => {
    expect(isLegalTransition('completed', 'paid')).toBe(false);
  });

  it('rejects a terminal state moving anywhere', () => {
    expect(isLegalTransition('payment_failed_expired', 'paid')).toBe(false);
    expect(isLegalTransition('trip_cancelled', 'completed')).toBe(false);
  });
});

describe('legalPredecessors — derives the webhook UPDATE guard', () => {
  it('paid has exactly one legal predecessor: awaiting_payment', () => {
    // The webhook WHERE clause is built from this — it must NOT widen to
    // pending_cash_payment (that path is recordCashCollected, not the webhook).
    expect(legalPredecessors('paid')).toEqual(['awaiting_payment']);
  });

  it('payment_failed_expired has exactly one legal predecessor: awaiting_payment', () => {
    expect(legalPredecessors('payment_failed_expired')).toEqual(['awaiting_payment']);
  });

  it('awaiting_payment has no predecessors (it is the entry state)', () => {
    expect(legalPredecessors('awaiting_payment')).toEqual([]);
  });
});

describe('LEGAL_BOOKING_TRANSITIONS — single source of truth', () => {
  it('declares an entry for every BookingStatus enum value (no silent holes)', () => {
    const keys = Object.keys(LEGAL_BOOKING_TRANSITIONS).sort();
    expect(keys).toEqual(
      [
        'awaiting_payment',
        'cancelled',
        'completed',
        'no_show',
        'paid',
        'payment_failed_expired',
        'pending_cash_payment',
        'trip_cancelled',
      ].sort()
    );
  });
});
