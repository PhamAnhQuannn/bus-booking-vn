import { describe, it, expect } from 'vitest';
import { holdInputSchema } from '../hold';

const VALID_CUID = 'clxyz1234567890abcdef1234';

describe('holdInputSchema', () => {
  const base = {
    tripId: VALID_CUID,
    ticketCount: 2,
    buyerName: 'Nguyen Van A',
    buyerPhone: '0912345678',
  };

  it('accepts a valid payload', () => {
    const result = holdInputSchema.safeParse(base);
    expect(result.success).toBe(true);
  });

  describe('tripId', () => {
    it('rejects non-cuid strings', () => {
      const result = holdInputSchema.safeParse({ ...base, tripId: 'not-a-cuid' });
      expect(result.success).toBe(false);
    });

    it('rejects empty string', () => {
      const result = holdInputSchema.safeParse({ ...base, tripId: '' });
      expect(result.success).toBe(false);
    });
  });

  describe('ticketCount', () => {
    it('rejects 0', () => {
      expect(holdInputSchema.safeParse({ ...base, ticketCount: 0 }).success).toBe(false);
    });

    it('rejects 11', () => {
      expect(holdInputSchema.safeParse({ ...base, ticketCount: 11 }).success).toBe(false);
    });

    it('accepts boundary values 1 and 10', () => {
      expect(holdInputSchema.safeParse({ ...base, ticketCount: 1 }).success).toBe(true);
      expect(holdInputSchema.safeParse({ ...base, ticketCount: 10 }).success).toBe(true);
    });

    it('rejects non-integer', () => {
      expect(holdInputSchema.safeParse({ ...base, ticketCount: 1.5 }).success).toBe(false);
    });
  });

  describe('buyerName', () => {
    it('accepts Vietnamese name with diacritics', () => {
      const result = holdInputSchema.safeParse({ ...base, buyerName: 'Nguyễn Văn Anh' });
      expect(result.success).toBe(true);
    });

    it('rejects name shorter than 4 characters', () => {
      expect(holdInputSchema.safeParse({ ...base, buyerName: 'Van' }).success).toBe(false);
    });

    it('rejects name longer than 100 characters', () => {
      expect(holdInputSchema.safeParse({ ...base, buyerName: 'a'.repeat(101) }).success).toBe(false);
    });

    it('rejects name with digits', () => {
      expect(holdInputSchema.safeParse({ ...base, buyerName: 'Nguyen123' }).success).toBe(false);
    });

    it('accepts name with apostrophe, hyphen, dot', () => {
      expect(holdInputSchema.safeParse({ ...base, buyerName: "O'Brien-Smith Jr." }).success).toBe(true);
    });

    it('trims leading/trailing whitespace', () => {
      const result = holdInputSchema.safeParse({ ...base, buyerName: '  Nguyen Van A  ' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.buyerName).toBe('Nguyen Van A');
      }
    });
  });

  describe('buyerPhone', () => {
    const validPhones = [
      '0912345678', // local 09...
      '0312345678', // local 03...
      '0512345678', // local 05...
      '0712345678', // local 07...
      '0812345678', // local 08...
      '+84912345678', // intl +84 9...
      '+84312345678', // intl +84 3...
    ];

    for (const phone of validPhones) {
      it(`accepts ${phone}`, () => {
        expect(holdInputSchema.safeParse({ ...base, buyerPhone: phone }).success).toBe(true);
      });
    }

    const invalidPhones = [
      '1912345678',   // wrong prefix
      '09123456',     // too short (7 digits after prefix)
      '091234567890', // too long
      '+85912345678', // wrong country code
      '0412345678',   // 4 is not a valid VN mobile prefix
      '+840912345678', // 0 after +84 is not valid
    ];

    for (const phone of invalidPhones) {
      it(`rejects ${phone}`, () => {
        expect(holdInputSchema.safeParse({ ...base, buyerPhone: phone }).success).toBe(false);
      });
    }

    it('trims whitespace', () => {
      const result = holdInputSchema.safeParse({ ...base, buyerPhone: ' 0912345678 ' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.buyerPhone).toBe('0912345678');
      }
    });
  });
});
