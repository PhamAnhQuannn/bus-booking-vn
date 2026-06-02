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
  it('allows awaiting_payment → paid_operator_notified (webhook success)', () => {
    expect(isLegalTransition('awaiting_payment', 'paid_operator_notified')).toBe(true);
  });

  it('allows awaiting_payment → payment_failed_expired (webhook failure)', () => {
    expect(isLegalTransition('awaiting_payment', 'payment_failed_expired')).toBe(true);
  });

  it('allows paid_operator_notified → completed (trip completes)', () => {
    expect(isLegalTransition('paid_operator_notified', 'completed')).toBe(true);
  });

  it('allows paid_operator_notified → trip_cancelled (operator cancels trip)', () => {
    expect(isLegalTransition('paid_operator_notified', 'trip_cancelled')).toBe(true);
  });
});

describe('booking transition guard — illegal / backward moves rejected', () => {
  it('rejects paid_operator_notified → awaiting_payment (regress)', () => {
    expect(isLegalTransition('paid_operator_notified', 'awaiting_payment')).toBe(false);
  });

  it('rejects completed → paid_operator_notified (regress)', () => {
    expect(isLegalTransition('completed', 'paid_operator_notified')).toBe(false);
  });

  it('rejects a terminal state moving anywhere', () => {
    expect(isLegalTransition('payment_failed_expired', 'paid_operator_notified')).toBe(false);
    expect(isLegalTransition('trip_cancelled', 'completed')).toBe(false);
  });
});

describe('legalPredecessors — derives the webhook UPDATE guard', () => {
  it('paid_operator_notified has exactly one legal predecessor: awaiting_payment', () => {
    // The webhook WHERE clause is built from this — it must NOT widen to
    // pending_cash_payment (that path is recordCashCollected, not the webhook).
    expect(legalPredecessors('paid_operator_notified')).toEqual(['awaiting_payment']);
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
        'paid_operator_notified',
        'payment_failed_expired',
        'pending_cash_payment',
        'trip_cancelled',
      ].sort()
    );
  });
});
