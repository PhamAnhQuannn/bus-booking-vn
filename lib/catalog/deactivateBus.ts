/**
 * deactivateBus — soft-delete a bus by setting deactivatedAt = now.
 *
 * AC10: pre-condition checked by caller (no future trips assigned). This lib is the
 *   write-side primitive.
 * AC11: re-activation is NOT supported. Calling deactivateBus on a row that already
 *   has deactivatedAt set returns { ok: false, reason: 'already_deactivated' } — the
 *   route handler maps this to HTTP 422 'reactivation_not_supported'.
 *
 * AC6: returns { ok: false, reason: 'not_found' } when the bus does not belong to the
 *   caller's operator. Route handler maps to 404.
 */

import { prisma } from '@/lib/core/db/client';
import { withOperatorScope } from '@/lib/core/db';

export type DeactivateResult =
  | { ok: true; deactivatedAt: Date }
  | { ok: false; reason: 'not_found' | 'already_deactivated' };

export async function deactivateBus(
  operatorId: string,
  busId: string
): Promise<DeactivateResult> {
  const existing = await prisma.bus.findFirst({
    ...withOperatorScope(operatorId, { where: { id: busId } }),
    select: { id: true, deactivatedAt: true },
  });
  if (!existing) return { ok: false, reason: 'not_found' };
  if (existing.deactivatedAt !== null) {
    return { ok: false, reason: 'already_deactivated' };
  }

  const now = new Date();
  await prisma.bus.update({
    where: { id: busId },
    data: { deactivatedAt: now },
  });
  return { ok: true, deactivatedAt: now };
}
