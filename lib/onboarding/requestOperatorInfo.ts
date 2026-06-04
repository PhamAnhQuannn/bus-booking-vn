/**
 * Issue 065: "request more info" — a NOTE-ONLY admin action on an operator under
 * review. The S05 approval state machine has NO dedicated request-info edge, so
 * this helper deliberately performs NO status transition: the operator stays in
 * UNDER_REVIEW. It only (1) writes an AdminAuditLog row capturing the admin's
 * note and (2) enqueues one pending NotificationLog row so the operator is told
 * what's missing.
 *
 * Kept OUT of transitionOperatorStatus (which is strictly for legal status edges)
 * so the state-machine service never grows a no-op "transition". The audit row +
 * notification are written under a $transaction so they commit together.
 *
 * @throws OperatorStatusError('operator_not_found') if no such operator exists.
 */

import { prisma } from '@/lib/core/db/client';
import { writeAdminAuditLog } from '@/lib/audit';
import { OperatorStatusError } from './errors';

export interface RequestOperatorInfoInput {
  operatorId: string;
  /** The admin's note describing what additional information is required. */
  note: string;
  /** `admin:<adminId>` — required (this is an admin-only action). */
  actor: string;
}

export async function requestOperatorInfo(input: RequestOperatorInfoInput): Promise<void> {
  const { operatorId, note, actor } = input;

  await prisma.$transaction(async (tx) => {
    // Lock the operator row so the existence check and the writes serialise with
    // any concurrent status transition on the same operator.
    const locked = await tx.$queryRaw<
      { notificationPhone: string | null; contactPhone: string }[]
    >`
      SELECT "notificationPhone", "contactPhone"
      FROM "Operator"
      WHERE "id" = ${operatorId}
      FOR UPDATE
    `;

    if (locked.length === 0) {
      throw new OperatorStatusError('operator_not_found');
    }

    await writeAdminAuditLog(tx, {
      actor,
      action: 'operator-request-info',
      target: operatorId,
      argsRedacted: JSON.stringify({ note }),
    });

    // Enqueue one pending notification (dispatcher is Wave 2). No status change.
    await tx.notificationLog.create({
      data: {
        bookingId: null,
        channel: 'sms',
        template: 'operatorUnderReview',
        recipient: locked[0].notificationPhone ?? locked[0].contactPhone,
        payload: JSON.stringify({ operatorId, requestInfo: true, note }),
        status: 'pending',
      },
    });
  });
}
