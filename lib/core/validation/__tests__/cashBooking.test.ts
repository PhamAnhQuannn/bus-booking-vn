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

  it('#527: accepts a cash walk-up with NO email (missing or empty → null)', () => {
    const { buyerEmail: _omit, ...noEmail } = valid;
    const rMissing = cashBookingSchema.safeParse(noEmail);
    expect(rMissing.success).toBe(true);
    if (rMissing.success) expect(rMissing.data.buyerEmail).toBeNull();

    const rEmpty = cashBookingSchema.safeParse({ ...valid, buyerEmail: '' });
    expect(rEmpty.success).toBe(true);
    if (rEmpty.success) expect(rEmpty.data.buyerEmail).toBeNull();
  });

  it('still rejects a present-but-malformed email', () => {
    expect(cashBookingSchema.safeParse({ ...valid, buyerEmail: 'not-an-email' }).success).toBe(false);
  });

  it('#527: rejects a malformed phone (reuses the hold VN-mobile validator, not min(1))', () => {
    expect(cashBookingSchema.safeParse({ ...valid, buyerPhone: '123' }).success).toBe(false);
    // a valid +84 international form is accepted
    expect(cashBookingSchema.safeParse({ ...valid, buyerPhone: '+84912345678' }).success).toBe(true);
  });
});
