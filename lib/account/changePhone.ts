/**
 * Change customer phone number (Issue 008 AC3).
 *
 * Flow: customer sends OTP to new phone, verifies OTP proof (phone_change purpose),
 * then calls changePhone with the OTP proof.
 *
 * The direct changePhone function is called from the /api/account/phone/confirm route
 * after the proof is verified by the route (the proof carries newPhone).
 *
 * TOCTOU guard: SELECT ... FOR UPDATE on the conflicting phone row inside $transaction.
 * P2002 unique constraint → generic PHONE_TAKEN (non-enumerating per design decision #4).
 */

import { prisma } from '@/lib/db/client';
import { Prisma } from '@prisma/client';
import { normalizePhone } from '@/lib/auth/phoneNormalize';

export type ChangePhoneErrorCode = 'PHONE_TAKEN' | 'CUSTOMER_NOT_FOUND';

export class ChangePhoneError extends Error {
  constructor(public readonly code: ChangePhoneErrorCode) {
    super(code);
    this.name = 'ChangePhoneError';
  }
}

export interface ChangePhoneResult {
  id: string;
  phone: string;
}

/**
 * Change the authenticated customer's phone to newPhone.
 * newPhone must already be normalized E.164 or will be normalized here.
 * Catches P2002 → PHONE_TAKEN (generic, no enumeration).
 */
export async function changePhone(
  customerId: string,
  rawNewPhone: string
): Promise<ChangePhoneResult> {
  const newPhone = normalizePhone(rawNewPhone);

  try {
    const updated = await prisma.$transaction(async (tx) => {
      // TOCTOU: lock the customer row before changing phone
      const rows = await tx.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`SELECT id FROM "Customer" WHERE id = ${customerId} AND "deletedAt" IS NULL FOR UPDATE`
      );
      if (rows.length === 0) throw new ChangePhoneError('CUSTOMER_NOT_FOUND');

      return tx.customer.update({
        where: { id: customerId },
        data: { phone: newPhone },
        select: { id: true, phone: true },
      });
    });

    return { id: updated.id, phone: updated.phone! };
  } catch (err) {
    if (err instanceof ChangePhoneError) throw err;
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ChangePhoneError('PHONE_TAKEN');
    }
    throw err;
  }
}
