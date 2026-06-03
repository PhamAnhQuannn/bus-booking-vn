/**
 * Issue 083: operator declines a directly-assigned charter lead.
 *
 * DECLINED is a TRANSIENT state (Issue 081): the only legal edge out of it is
 * DECLINED → ADMIN_REVIEW, which re-enters the lead into the admin queue for
 * reassignment. So a decline is really TWO transitions run back-to-back:
 *
 *   ASSIGNED_DIRECT → DECLINED        (the DECLINED side-effect clears
 *                                      assigneeOperatorId — Issue 081)
 *   DECLINED        → ADMIN_REVIEW    (re-route the freed lead)
 *
 * We run both via transitionCharterRequest so each edge's legality check + lock +
 * side-effect writes apply. The first transition's DECLINED branch nulls the
 * assignee; the second only flips status. After both, the request is back in
 * ADMIN_REVIEW with no assignee — ready for admin reassignment.
 *
 * The transitions are NOT wrapped in a single outer transaction: each
 * transitionCharterRequest already owns its own $transaction + row lock, and the
 * DECLINED intermediate is itself a valid persisted state (the row is never left
 * illegal). A best-effort ops notification of the decline is enqueued after the
 * state lands.
 */

import { transitionCharterRequest, type CharterTransitionClient } from './charterStatus';
import { createNotificationLog } from '@/lib/core/db/notificationLogRepo';

export interface DeclineCharterInput {
  charterId: string;
  /** `operator:<operatorId>` — recorded on the audit rows of both transitions. */
  actor: string;
  /** Optional operator-supplied decline reason (logged to ops, not customer-facing). */
  reason?: string;
}

export interface DeclineCharterResult {
  ok: true;
  charterId: string;
  /** Final status after the DECLINED → ADMIN_REVIEW re-route. */
  to: 'ADMIN_REVIEW';
}

/**
 * Decline a directly-assigned charter: ASSIGNED_DIRECT → DECLINED → ADMIN_REVIEW.
 *
 * @throws CharterError('illegal_transition') if the lead is not in ASSIGNED_DIRECT
 *         (e.g. a stale double-click after it already moved) — mapped to 422.
 * @throws CharterError('charter_not_found') if the row is gone — mapped to 404.
 */
export async function declineCharter(
  prisma: CharterTransitionClient,
  input: DeclineCharterInput
): Promise<DeclineCharterResult> {
  const { charterId, actor, reason } = input;

  // 1) ASSIGNED_DIRECT → DECLINED (clears assigneeOperatorId via the 081 side-effect).
  await transitionCharterRequest(prisma, { charterId, to: 'DECLINED', actor });

  // 2) DECLINED → ADMIN_REVIEW (re-route the freed lead into the admin queue).
  await transitionCharterRequest(prisma, { charterId, to: 'ADMIN_REVIEW', actor });

  // Best-effort ops notification that a decline happened (the lead needs
  // reassignment). NotificationLog failure must not fail the decline.
  try {
    await createNotificationLog({
      channel: 'email',
      template: 'charterDeclined',
      recipient: 'ops',
      payload: JSON.stringify({ charterId, actor, reason: reason ?? null }),
      status: 'pending',
    });
  } catch {
    // swallow — the state change is the source of truth.
  }

  return { ok: true, charterId, to: 'ADMIN_REVIEW' };
}
