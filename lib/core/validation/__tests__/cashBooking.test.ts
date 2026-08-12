import { describe, it, expect } from 'vitest';
import { cashBookingSchema } from '../cashBooking';

const valid = {
  tripId: 'trip-1',
  buyerName: 'Nguyen Van A',
  buyerPhone: '0912345678',
  buyerEmail: 'Buyer@Example.com',
  ticketCount: 2,
};

describe('cashBookingSchema', () => {
  it('accepts a valid cash booking and normalizes email', () => {
    const r = cashBookingSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.buyerEmail).toBe('buyer@example.com');
  });

  it('rejects a missing email (Issue 042 — email required for ticket delivery)', () => {
    const { buyerEmail: _omit, ...noEmail } = valid;
    expect(cashBookingSchema.safeParse(noEmail).success).toBe(false);
  });

  it('rejects an empty / invalid email', () => {
    for (const buyerEmail of ['', '   ', 'not-an-email']) {
      expect(cashBookingSchema.safeParse({ ...valid, buyerEmail }).success).toBe(false);
    }
  });
});
