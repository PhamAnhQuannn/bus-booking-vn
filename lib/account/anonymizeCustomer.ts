/**
 * Soft-delete / anonymize customer account (Issue 008 AC5).
 *
 * Design decision #3: retain Booking rows (snapshot buyerPhone/buyerName stay per PDPD 2023).
 * Design decision #1: NULL the phone (Postgres allows multiple NULLs on @unique).
 *
 * Returns a discriminated result { customer, alreadyDeleted } for idempotent 200.
 * Does NOT throw on second call — per plan rule "idempotent ops whose AC specifies 200+discriminator".
 */

import { prisma } from '@/lib/db/client';

export interface DeleteAccountResult {
  customer: {
    id: string;
    deletedAt: Date | null;
    anonymizedAt: Date | null;
    phone: string | null;
  };
  alreadyDeleted: boolean;
}

export async function deleteAccount(customerId: string): Promise<DeleteAccountResult> {
  // Idempotent check: if already deleted, return discriminated result
  const existing = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true, deletedAt: true, anonymizedAt: true, phone: true },
  });

  if (!existing) {
    // Non-existent customer treated as already-deleted (idempotent)
    return {
      customer: { id: customerId, deletedAt: null, anonymizedAt: null, phone: null },
      alreadyDeleted: true,
    };
  }

  if (existing.deletedAt !== null) {
    return { customer: existing, alreadyDeleted: true };
  }

  const now = new Date();

  const customer = await prisma.$transaction(async (tx) => {
    const updated = await tx.customer.update({
      where: { id: customerId },
      data: {
        phone: null,        // freed — Postgres allows multiple NULLs on @unique
        displayName: 'Deleted user',  // AC5: anonymize buyer-name identity
        deletedAt: now,
        anonymizedAt: now,
      },
      select: { id: true, deletedAt: true, anonymizedAt: true, phone: true },
    });

    // Revoke all sessions (design decision #2)
    await tx.session.updateMany({
      where: { customerId },
      data: { revokedAt: now },
    });

    return updated;
  });

  return { customer, alreadyDeleted: false };
}
