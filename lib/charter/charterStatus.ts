/**
 * Issue 081: charter-request state-machine transition service.
 *
 * The SINGLE source of truth for legal moves of the charter lifecycle. Mirrors
 * the Issue 045 operator pattern (lib/onboarding/operatorStatus.ts): admin /
 * operator routes (Issues 082–085) MUST call transitionCharterRequest rather
 * than writing CharterRequest.status directly, so the legality check, the
 * SELECT … FOR UPDATE serialization, and the per-target side-effect field writes
 * always run together.
 *
 * LEAD-GEN scope (S15#9): there is NO charter payment rail. No Hold / Booking /
 * PaymentEvent / Payout work happens on any transition — the charter is routed to
 * an operator and settled off-platform. Side effects here are limited to the
 * CharterRequest's own columns (assignee, deadlines, publishedAt, reason).
 *
 * Legal edges:
 *   SUBMITTED        → ADMIN_REVIEW
 *   ADMIN_REVIEW     → ASSIGNED_DIRECT | PUBLISHED | REJECTED
 *   ASSIGNED_DIRECT  → ACCEPTED | DECLINED
 *   PUBLISHED        → ACCEPTED | EXPIRED
 *   DECLINED         → ADMIN_REVIEW           (re-route the freed lead)
 *   EXPIRED          → ADMIN_REVIEW           (re-route the expired lead)
 *   ACCEPTED         → COMPLETED | CANCELLED
 *   REJECTED / COMPLETED / CANCELLED → []     (terminal)
 *
 * Issue 013: transitionCharterRequest returns a DISCRIMINATED result
 * `{ ok: true, from, to, … }` for every NORMAL outcome — it throws ONLY for the
 * exceptional cases (illegal edge, missing row). Callers branch on the result,
 * never on a caught sentinel.
 */

import type { CharterStatus } from '@prisma/client';
import { writeAdminAuditLog, type AdminAuditLogClient } from '@/lib/audit/adminAuditLog';
import { CharterError } from './errors';

/**
 * Legal forward transitions. Every CharterStatus key is present (no silent
 * holes); terminal states map to an empty list. This map is the only place the
 * edge rule lives.
 */
export const LEGAL_CHARTER_TRANSITIONS: Record<CharterStatus, CharterStatus[]> = {
  SUBMITTED: ['ADMIN_REVIEW'],
  ADMIN_REVIEW: ['ASSIGNED_DIRECT', 'PUBLISHED', 'REJECTED'],
  ASSIGNED_DIRECT: ['ACCEPTED', 'DECLINED'],
  PUBLISHED: ['ACCEPTED', 'EXPIRED'],
  DECLINED: ['ADMIN_REVIEW'],
  EXPIRED: ['ADMIN_REVIEW'],
  ACCEPTED: ['COMPLETED', 'CANCELLED'],
  REJECTED: [],
  COMPLETED: [],
  CANCELLED: [],
};

/** True when `from → to` is a declared legal charter-status transition. */
export function isLegalCharterTransition(from: CharterStatus, to: CharterStatus): boolean {
  return LEGAL_CHARTER_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Minimal Prisma surface the transition service needs. Accepting it by parameter
 * (rather than importing the app singleton) mirrors writeAdminAuditLog — keeps
 * the core usable from a route handler, a cron worker, or a test client.
 */
export interface CharterTransitionClient extends AdminAuditLogClient {
  $transaction: <T>(fn: (tx: CharterTransitionTx) => Promise<T>) => Promise<T>;
}

/** The tx handle surface used inside the transaction callback. */
export interface CharterTransitionTx extends AdminAuditLogClient {
  $queryRaw: <T = unknown>(query: TemplateStringsArray, ...values: unknown[]) => Promise<T>;
  charterRequest: {
    update: (args: {
      where: { id: string };
      data: Record<string, unknown>;
      select?: Record<string, boolean>;
    }) => Promise<{ status: CharterStatus; assigneeOperatorId: string | null }>;
  };
}

export interface TransitionCharterRequestInput {
  charterId: string;
  to: CharterStatus;
  /** Required on → ASSIGNED_DIRECT: the operator the lead is directly assigned to. */
  assigneeOperatorId?: string;
  /** Required on → ASSIGNED_DIRECT: the direct-assign accept deadline (Issue 083). */
  acceptByAt?: Date;
  /** Required on → PUBLISHED: the public-pool claim deadline (Issue 084). */
  claimByAt?: Date;
  /** Set on → REJECTED; ignored otherwise. */
  rejectionReason?: string;
  /**
   * Optional admin actor (e.g. `admin:<id>`). When present, an AdminAuditLog row
   * is written INSIDE the same $transaction as the status update — they commit or
   * roll back together. Absent for system / cron callers (no audit row).
   */
  actor?: string;
}

export interface TransitionCharterRequestResult {
  ok: true;
  charterId: string;
  from: CharterStatus;
  to: CharterStatus;
  assigneeOperatorId: string | null;
}

/**
 * Transition a charter request to a new status. Asserts the edge is legal, locks
 * the row, writes status + the per-target side-effect fields inside a single
 * transaction, optionally records an admin audit row, and returns a discriminated
 * result.
 *
 * The SELECT … FOR UPDATE serializes concurrent transitions on the SAME charter
 * row — important for the Issue 084 public-pool claim race (two operators racing
 * PUBLISHED → ACCEPTED): the lock makes the legality check + status flip atomic,
 * so the second claimant sees status=ACCEPTED and its PUBLISHED→ACCEPTED edge is
 * re-evaluated against the already-moved row and rejected as illegal.
 *
 * @throws CharterError('charter_not_found') if no such charter request.
 * @throws CharterError('illegal_transition') if from→to is not a legal edge.
 */
export async function transitionCharterRequest(
  prisma: CharterTransitionClient,
  input: TransitionCharterRequestInput
): Promise<TransitionCharterRequestResult> {
  const { charterId, to, assigneeOperatorId, acceptByAt, claimByAt, rejectionReason, actor } =
    input;

  return prisma.$transaction(async (tx) => {
    // Lock the charter row so concurrent transitions serialise on the edge check
    // (the Issue 084 claim race depends on this).
    const locked = await tx.$queryRaw<{ status: CharterStatus }[]>`
      SELECT "status"
      FROM "CharterRequest"
      WHERE "id" = ${charterId}
      FOR UPDATE
    `;

    if (locked.length === 0) {
      throw new CharterError('charter_not_found');
    }

    const from = locked[0].status;

    if (!isLegalCharterTransition(from, to)) {
      throw new CharterError('illegal_transition', `${from} -> ${to}`);
    }

    // Per-target side-effect fields. Only the columns relevant to the target are
    // written; everything else is left untouched.
    const data: Record<string, unknown> = { status: to };

    switch (to) {
      case 'ASSIGNED_DIRECT':
        // Direct assign (Issue 083): record the operator + the accept deadline.
        data.assigneeOperatorId = assigneeOperatorId ?? null;
        data.acceptByAt = acceptByAt ?? null;
        break;
      case 'PUBLISHED':
        // Enter the public pool (Issue 084): stamp publishedAt + the claim deadline.
        data.publishedAt = new Date();
        data.claimByAt = claimByAt ?? null;
        break;
      case 'REJECTED':
        data.rejectionReason = rejectionReason ?? null;
        break;
      case 'DECLINED':
      case 'EXPIRED':
        // A decline (operator passes) or an expiry frees the lead: clear the
        // assignee so the next ADMIN_REVIEW re-route starts from a clean slate.
        data.assigneeOperatorId = null;
        break;
      default:
        // ADMIN_REVIEW / ACCEPTED / COMPLETED / CANCELLED: status only.
        break;
    }

    const updated = await tx.charterRequest.update({
      where: { id: charterId },
      data,
      select: { status: true, assigneeOperatorId: true },
    });

    // Optional admin audit, written off the SAME tx so it commits with the update.
    if (actor) {
      await writeAdminAuditLog(tx, {
        actor,
        action: 'charter-status:' + to,
        target: charterId,
        argsRedacted: JSON.stringify({
          from,
          to,
          ...(to === 'ASSIGNED_DIRECT' ? { assigneeOperatorId } : {}),
          ...(to === 'REJECTED' ? { rejectionReason } : {}),
        }),
      });
    }

    return {
      ok: true as const,
      charterId,
      from,
      to,
      assigneeOperatorId: updated.assigneeOperatorId,
    };
  });
}
