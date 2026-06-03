/**
 * Issue 045: operator approval-state transition service.
 *
 * The SINGLE source of truth for legal moves of the operator approval state
 * machine. Admin approval/rejection/suspension routes (Wave 2) MUST call
 * transitionOperatorStatus rather than writing Operator.status directly, so the
 * legality check, the disabledAt sync, and the notification enqueue always run
 * together.
 *
 * Legal edges (S05 / SYS12):
 *   PENDING_REVIEW → UNDER_REVIEW
 *   UNDER_REVIEW   → APPROVED | REJECTED
 *   REJECTED       → PENDING_REVIEW   (resubmit)
 *   APPROVED       → SUSPENDED
 *   SUSPENDED      → APPROVED
 *   (any other target is terminal-none)
 *
 * disabledAt sync (back-compat): → SUSPENDED sets disabledAt=now(); → APPROVED
 * clears it. All other transitions leave disabledAt untouched.
 *
 * Each transition enqueues exactly ONE pending NotificationLog row (template per
 * target state). The dispatcher is Wave 2 — here we only enqueue.
 */

import type { OperatorStatus } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { createNotificationLog } from '@/lib/db/notificationLogRepo';
import { writeAdminAuditLog } from '@/lib/audit/adminAuditLog';
import { OperatorStatusError } from './errors';

/**
 * Legal forward transitions. Every OperatorStatus key is present (no silent
 * holes); terminal states map to an empty list. This map is the only place the
 * edge rule lives.
 */
export const LEGAL_OPERATOR_TRANSITIONS: Record<OperatorStatus, OperatorStatus[]> = {
  PENDING_REVIEW: ['UNDER_REVIEW'],
  UNDER_REVIEW: ['APPROVED', 'REJECTED'],
  REJECTED: ['PENDING_REVIEW'],
  APPROVED: ['SUSPENDED'],
  SUSPENDED: ['APPROVED'],
};

/** True when `from → to` is a declared legal operator-status transition. */
export function isLegalOperatorTransition(from: OperatorStatus, to: OperatorStatus): boolean {
  return LEGAL_OPERATOR_TRANSITIONS[from]?.includes(to) ?? false;
}

/** NotificationLog template name per target state. */
const TEMPLATE_BY_TARGET: Record<OperatorStatus, string> = {
  PENDING_REVIEW: 'operatorResubmit',
  UNDER_REVIEW: 'operatorUnderReview',
  APPROVED: 'operatorApproved',
  REJECTED: 'operatorRejected',
  SUSPENDED: 'operatorSuspended',
};

export interface TransitionOperatorStatusInput {
  operatorId: string;
  to: OperatorStatus;
  /** Set on REJECTED; ignored otherwise. */
  reason?: string;
  /**
   * Issue 065: identifies the admin who triggered the transition (e.g.
   * `admin:<adminId>`). When present, an AdminAuditLog row is written INSIDE the
   * same $transaction as the status update. Absent for CLI / system callers
   * (Issue 045 behaviour is unchanged — no audit row is written when omitted).
   */
  actor?: string;
}

export interface TransitionOperatorStatusResult {
  operatorId: string;
  from: OperatorStatus;
  to: OperatorStatus;
  rejectionReason: string | null;
  disabledAt: Date | null;
}

/**
 * Transition an operator to a new approval status. Asserts the edge is legal,
 * updates status (+ rejectionReason / disabledAt sync) inside a transaction,
 * then enqueues one pending NotificationLog row.
 *
 * @throws OperatorStatusError('operator_not_found') if no such operator.
 * @throws OperatorStatusError('illegal_transition') if from→to is not a legal edge.
 */
export async function transitionOperatorStatus(
  input: TransitionOperatorStatusInput
): Promise<TransitionOperatorStatusResult> {
  const { operatorId, to, reason, actor } = input;

  const result = await prisma.$transaction(async (tx) => {
    // Lock the operator row so concurrent transitions serialise on the edge check.
    const locked = await tx.$queryRaw<{ status: OperatorStatus }[]>`
      SELECT "status"
      FROM "Operator"
      WHERE "id" = ${operatorId}
      FOR UPDATE
    `;

    if (locked.length === 0) {
      throw new OperatorStatusError('operator_not_found');
    }

    const from = locked[0].status;

    if (!isLegalOperatorTransition(from, to)) {
      throw new OperatorStatusError('illegal_transition', `${from} -> ${to}`);
    }

    // disabledAt sync (back-compat): SUSPENDED freezes, APPROVED clears.
    const data: {
      status: OperatorStatus;
      rejectionReason?: string | null;
      disabledAt?: Date | null;
    } = { status: to };

    if (to === 'REJECTED') {
      data.rejectionReason = reason ?? null;
    } else if (to === 'PENDING_REVIEW') {
      // Resubmit clears any prior rejection reason.
      data.rejectionReason = null;
    }

    if (to === 'SUSPENDED') {
      data.disabledAt = new Date();
    } else if (to === 'APPROVED') {
      data.disabledAt = null;
    }

    const updated = await tx.operator.update({
      where: { id: operatorId },
      data,
      select: { rejectionReason: true, disabledAt: true, notificationPhone: true, contactPhone: true },
    });

    // Issue 065: when an admin actor is supplied, record the transition in the
    // append-only AdminAuditLog INSIDE the same transaction as the status write —
    // the audit row and the state change commit or roll back together. CLI/system
    // callers (no actor) leave this untouched, preserving Issue 045 behaviour.
    if (actor) {
      await writeAdminAuditLog(tx, {
        actor,
        action: 'operator-status:' + to,
        target: operatorId,
        argsRedacted: JSON.stringify({ from, to, ...(to === 'REJECTED' ? { reason } : {}) }),
      });
    }

    return { from, updated };
  });

  // One notification per transition (enqueue only; dispatcher is Wave 2).
  await createNotificationLog({
    bookingId: null,
    channel: 'sms',
    template: TEMPLATE_BY_TARGET[to],
    recipient: result.updated.notificationPhone ?? result.updated.contactPhone,
    payload: JSON.stringify({ operatorId, to, ...(to === 'REJECTED' ? { reason: reason ?? null } : {}) }),
    status: 'pending',
  });

  return {
    operatorId,
    from: result.from,
    to,
    rejectionReason: result.updated.rejectionReason,
    disabledAt: result.updated.disabledAt,
  };
}
