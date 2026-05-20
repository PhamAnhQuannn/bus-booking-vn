/**
 * Integration tests for lib/account/changePhone.ts (Issue 008 AC3).
 *
 * Uses real DB — requires DATABASE_URL in env.
 * PII-safe phones: +8490xxxxxx1, +8490xxxxxx2
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/db/client';
import { hash as hashPassword } from '@/lib/auth/password';
import { changePhone, ChangePhoneError } from '../changePhone';

const PHONE_A = '+8490xxxxxx1'; // original phone
const PHONE_B = '+8490xxxxxx2'; // phone already taken by another customer

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
    const newPhone = '+8490xxxxxx0';
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
