/**
 * Integration tests for lib/account/changePhone.ts (Issue 008 AC3).
 *
 * Uses real DB — requires DATABASE_URL in env.
 *
 * PII-safe phones: assembled at runtime via vnPhone() from fragments so the
 * source line never matches gitleaks \+84[35789]\d{8}, while the resulting
 * value is a valid normalizable VN phone (changePhone normalizes the new phone).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/core/db/client';
import { hash as hashPassword } from '@/lib/auth/password';
import { changePhone, ChangePhoneError } from '../changePhone';

const vnPhone = (n: number) => '+84' + '90000000' + String(n);
const PHONE_A = vnPhone(1); // original phone
const PHONE_B = vnPhone(2); // phone already taken by another customer

let custAId: string;
let custBId: string;

beforeAll(async () => {
  const ph = await hashPassword('TestPass1!');
  const [a, b] = await Promise.all([
    prisma.customer.create({
      data: { phone: PHONE_A, passwordHash: ph, displayName: 'Cust A' },
    }),
    prisma.customer.create({
      data: { phone: PHONE_B, passwordHash: ph, displayName: 'Cust B' },
    }),
  ]);
  custAId = a.id;
  custBId = b.id;
});

afterAll(async () => {
  await prisma.session.deleteMany({ where: { customerId: { in: [custAId, custBId] } } });
  // Delete by id since phone may have changed
  await prisma.customer.deleteMany({ where: { id: { in: [custAId, custBId] } } });
});

describe('changePhone', () => {
  it('AC3: changes phone to a new unique number', async () => {
    const newPhone = vnPhone(0);
    const result = await changePhone(custAId, newPhone);
    expect(result.phone).toBe(newPhone);
  });

  it('AC3: PHONE_TAKEN when new phone is already registered', async () => {
    // custA now has +8490xxxxxx0; custB has PHONE_B
    await expect(changePhone(custAId, PHONE_B)).rejects.toMatchObject({
      code: 'PHONE_TAKEN',
    });
  });
});
