import { describe, it, expect } from 'vitest';
import { customerFormSchema } from '../customerFormSchema';

describe('customerFormSchema', () => {
  it('accepts a valid buyer', () => {
    const r = customerFormSchema.safeParse({
      buyerName: 'Nguyễn Văn Test',
      buyerPhone: '0912345678',
      buyerEmail: 'Test@Gmail.com',
    });
    expect(r.success).toBe(true);
    // email is trimmed + lowercased
    if (r.success) expect(r.data.buyerEmail).toBe('test@gmail.com');
  });

  it('accepts +84 mobile format', () => {
    expect(
      customerFormSchema.safeParse({
        buyerName: 'Tran Thi B',
        buyerPhone: '+84987654321',
        buyerEmail: 'b@example.com',
      }).success,
    ).toBe(true);
  });

  it('rejects a too-short name (presence/format ordered)', () => {
    const r = customerFormSchema.safeParse({
      buyerName: 'Al',
      buyerPhone: '0912345678',
      buyerEmail: 'a@example.com',
    });
    expect(r.success).toBe(false);
  });

  it('rejects a non-VN / landline phone', () => {
    for (const buyerPhone of ['0212345678', '123', '09123']) {
      const r = customerFormSchema.safeParse({
        buyerName: 'Valid Name',
        buyerPhone,
        buyerEmail: 'a@example.com',
      });
      expect(r.success).toBe(false);
    }
  });

  it('rejects a syntactically invalid email', () => {
    expect(
      customerFormSchema.safeParse({
        buyerName: 'Valid Name',
        buyerPhone: '0912345678',
        buyerEmail: 'not-an-email',
      }).success,
    ).toBe(false);
  });
});
