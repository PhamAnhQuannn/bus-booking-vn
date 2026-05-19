/**
 * Unit tests for ManualBookingSchema (Issue 015).
 */

import { describe, it, expect } from 'vitest';
import { ManualBookingSchema } from '../trip';

const VALID_BASE = {
  buyerName: 'Nguyen Van A',
  buyerPhone: '0912345678',
  ticketCount: 2,
  paymentMethod: 'paid' as const,
};

describe('ManualBookingSchema', () => {
  it('accepts valid paid payload', () => {
    expect(ManualBookingSchema.safeParse(VALID_BASE).success).toBe(true);
  });

  it('accepts valid cash payload', () => {
    expect(ManualBookingSchema.safeParse({ ...VALID_BASE, paymentMethod: 'cash' }).success).toBe(true);
  });

  describe('buyerName', () => {
    it('rejects name shorter than 4 chars', () => {
      expect(ManualBookingSchema.safeParse({ ...VALID_BASE, buyerName: 'Van' }).success).toBe(false);
    });

    it('accepts Vietnamese diacritics', () => {
      expect(ManualBookingSchema.safeParse({ ...VALID_BASE, buyerName: 'Trần Thị Bích' }).success).toBe(true);
    });

    it('rejects purely-digit string longer than 4 chars (no letter)', () => {
      expect(ManualBookingSchema.safeParse({ ...VALID_BASE, buyerName: '12345' }).success).toBe(false);
    });

    it('trims whitespace', () => {
      const r = ManualBookingSchema.safeParse({ ...VALID_BASE, buyerName: '  Nguyen Van A  ' });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.buyerName).toBe('Nguyen Van A');
    });
  });

  describe('buyerPhone', () => {
    const validPhones = [
      '0912345678',   // local 09...
      '0312345678',   // local 03...
      '+84912345678', // intl +84 9...
      '+84312345678', // intl +84 3...
    ];
    for (const p of validPhones) {
      it(`accepts ${p}`, () => {
        expect(ManualBookingSchema.safeParse({ ...VALID_BASE, buyerPhone: p }).success).toBe(true);
      });
    }

    const invalidPhones = [
      '1912345678',    // wrong prefix
      '09123456',      // too short
      '+85912345678',  // wrong country code
      '0412345678',    // 4 not a VN mobile prefix
    ];
    for (const p of invalidPhones) {
      it(`rejects ${p}`, () => {
        expect(ManualBookingSchema.safeParse({ ...VALID_BASE, buyerPhone: p }).success).toBe(false);
      });
    }
  });

  describe('ticketCount', () => {
    it('rejects 0', () => {
      expect(ManualBookingSchema.safeParse({ ...VALID_BASE, ticketCount: 0 }).success).toBe(false);
    });

    it('accepts 1', () => {
      expect(ManualBookingSchema.safeParse({ ...VALID_BASE, ticketCount: 1 }).success).toBe(true);
    });

    it('rejects non-integer', () => {
      expect(ManualBookingSchema.safeParse({ ...VALID_BASE, ticketCount: 1.5 }).success).toBe(false);
    });

    it('accepts large integer', () => {
      expect(ManualBookingSchema.safeParse({ ...VALID_BASE, ticketCount: 50 }).success).toBe(true);
    });
  });

  describe('paymentMethod', () => {
    it('rejects unknown method', () => {
      expect(ManualBookingSchema.safeParse({ ...VALID_BASE, paymentMethod: 'momo' }).success).toBe(false);
    });

    it('rejects missing paymentMethod', () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { paymentMethod: _pm, ...rest } = VALID_BASE;
      expect(ManualBookingSchema.safeParse(rest).success).toBe(false);
    });
  });
});
