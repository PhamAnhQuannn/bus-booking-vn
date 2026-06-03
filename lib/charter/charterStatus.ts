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
 *   SUBMITTED        → ADMIN_REVIEW | CANCELLED
 *   ADMIN_REVIEW     → ASSIGNED_DIRECT | PUBLISHED | REJECTED | CANCELLED
 *   ASSIGNED_DIRECT  → ACCEPTED | DECLINED | ADMIN_REVIEW | CANCELLED
 *   PUBLISHED        → ACCEPTED | EXPIRED | CANCELLED
 *   DECLINED         → ADMIN_REVIEW           (re-route the freed lead)
 *   EXPIRED          → ADMIN_REVIEW           (re-route the expired lead)
 *   ACCEPTED         → COMPLETED | CANCELLED
 *   REJECTED / COMPLETED / CANCELLED → []     (terminal)
 *
 * Issue 086: ASSIGNED_DIRECT → ADMIN_REVIEW is the direct-assign TIMEOUT edge.
 * When the directly-assigned operator does not accept/decline before acceptByAt,
 * the charter-expiry sweeper (lib/jobs/charterExpirySweeper.ts) returns the lead
 * to admin for re-routing. The ADMIN_REVIEW side-effect CLEARS assigneeOperatorId
 * (the timeout frees the operator), mirroring how DECLINED / EXPIRED free the lead.
 * The publish-expiry timeout uses the existing two-step PUBLISHED → EXPIRED →
 * ADMIN_REVIEW path (EXPIRED already clears the assignee; ADMIN_REVIEW is a no-op
 * clear there since EXPIRED nulled it first).
 *
 * Issue 082: the CANCELLED targets on SUBMITTED / ADMIN_REVIEW / ASSIGNED_DIRECT /
 * PUBLISHED are the customer cancel-before-accept edges (AC4) — a customer may
 * withdraw their request at any pre-match stage via the public ref-keyed status
 * page. A customer CANNOT cancel once an operator has ACCEPTED (the ACCEPTED →
 * CANCELLED edge already existed from 081 and is reserved for admin/operator
 * teardown, not the customer cancel route, which gates on pre-ACCEPT status).
 *
 * Issue 082: the → ACCEPTED transition (driven by Issues 083 direct-assign accept
 * and 084 public-pool claim) enqueues a customer "match" notification — see
 * transitionCharterRequest's post-commit side-effect.
 *
 * Issue 013: transitionCharterRequest returns a DISCRIMINATED result
 * `{ ok: true, from, to, … }` for every NORMAL outcome — it throws ONLY for the
 * exceptional cases (illegal edge, missing row). Callers branch on the result,
 * never on a caught sentinel.
 */

import type { CharterStatus } from '@prisma/client';
import { writeAdminAuditLog, type AdminAuditLogClient } from '@/lib/audit/adminAuditLog';
import { createNotificationLog } from '@/lib/db/notificationLogRepo';
import { CharterError } from './errors';

/**
 * Legal forward transitions. Every CharterStatus key is present (no silent
 * holes); terminal states map to an empty list. This map is the only place the
 * edge rule lives.
 */
export const LEGAL_CHARTER_TRANSITIONS: Record<CharterStatus, CharterStatus[]> = {
  // Issue 082: CANCELLED added to every pre-ACCEPT state for customer cancel (AC4).
  SUBMITTED: ['ADMIN_REVIEW', 'CANCELLED'],
  ADMIN_REVIEW: ['ASSIGNED_DIRECT', 'PUBLISHED', 'REJECTED', 'CANCELLED'],
  // Issue 086: ADMIN_REVIEW is the direct-assign no-response TIMEOUT target.
  ASSIGNED_DIRECT: ['ACCEPTED', 'DECLINED', 'ADMIN_REVIEW', 'CANCELLED'],
  PUBLISHED: ['ACCEPTED', 'EXPIRED', 'CANCELLED'],
  DECLINED: ['ADMIN_REVIEW'],
  EXPIRED: ['ADMIN_REVIEW'],
  ACCEPTED: ['COMPLETED', 'CANCELLED'],
  REJECTED: [],
  COMPLETED: [],
  CANCELLED: [],
};

/**
 * Issue 082: pre-ACCEPT states from which a CUSTOMER may cancel their own request
 * (AC4). The public cancel route (app/api/charter/[ref]/cancel) gates on this set
 * — a request already ACCEPTED (or terminal) is NOT customer-cancellable, so the
 * route returns 422 before even calling transitionCharterRequest. (ACCEPTED →
 * CANCELLED stays a legal edge for admin/operator teardown, just not this route.)
 */
export const CUSTOMER_CANCELLABLE_STATUSES: ReadonlySet<CharterStatus> = new Set<CharterStatus>([
  'SUBMITTED',
  'ADMIN_REVIEW',
  'ASSIGNED_DIRECT',
  'PUBLISHED',
]);

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

/**
 * The charter contact + ref fields the → ACCEPTED match notification (Issue 082)
 * needs. Read off the updated row so the post-commit enqueue has everything it
 * needs without a second round-trip.
 */
interface CharterUpdateRow {
  status: CharterStatus;
  assigneeOperatorId: string | null;
  ref: string;
  contactPhone: string;
  contactEmail: string;
}

/** The tx handle surface used inside the transaction callback. */
export interface CharterTransitionTx extends AdminAuditLogClient {
  $queryRaw: <T = unknown>(query: TemplateStringsArray, ...values: unknown[]) => Promise<T>;
  charterRequest: {
    update: (args: {
      where: { id: string };
      data: Record<string, unknown>;
      select?: Record<string, boolean>;
    }) => Promise<CharterUpdateRow>;
  };
  operator: {
    findUnique: (args: {
      where: { id: string };
      select: { legalName: true };
    }) => Promise<{ legalName: string } | null>;
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

  // Carried out of the transaction so the → ACCEPTED match notification (Issue
  // 082) is enqueued AFTER commit — a NotificationLog write failure must never
  // roll back the status flip (mirrors registerOperator / createOperator). Null
  // unless the transition landed on ACCEPTED.
  let matchNotify: { ref: string; contactPhone: string; contactEmail: string; operatorName: string | null } | null =
    null;

  const result = await prisma.$transaction(async (tx) => {
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
      case 'ADMIN_REVIEW':
        // Issue 086: returning a lead to admin review (re-route) clears the
        // assignee AND both stale deadlines. This matters for the direct-assign
        // TIMEOUT edge (ASSIGNED_DIRECT → ADMIN_REVIEW): the sweeper found
        // acceptByAt elapsed, so the operator is freed and the now-meaningless
        // acceptByAt / claimByAt are nulled out — otherwise a stale acceptByAt in
        // the past would keep the row matching the sweeper's claim predicate.
        // For DECLINED/EXPIRED → ADMIN_REVIEW the assignee is already null (those
        // edges nulled it), so the clear is an idempotent no-op there.
        data.assigneeOperatorId = null;
        data.acceptByAt = null;
        data.claimByAt = null;
        break;
      default:
        // ACCEPTED / COMPLETED / CANCELLED: status only.
        break;
    }

    const updated = await tx.charterRequest.update({
      where: { id: charterId },
      data,
      select: {
        status: true,
        assigneeOperatorId: true,
        ref: true,
        contactPhone: true,
        contactEmail: true,
      },
    });

    // Issue 082: on → ACCEPTED, capture the match-notification payload. The
    // operator name is resolved from the (already-set) assigneeOperatorId inside
    // the same tx; the enqueue itself happens post-commit (see matchNotify use).
    // Triggered by Issue 083 (direct-assign accept) and Issue 084 (public-pool
    // claim), both of which drive this → ACCEPTED edge.
    if (to === 'ACCEPTED') {
      let operatorName: string | null = null;
      if (updated.assigneeOperatorId) {
        const op = await tx.operator.findUnique({
          where: { id: updated.assigneeOperatorId },
          select: { legalName: true },
        });
        operatorName = op?.legalName ?? null;
      }
      matchNotify = {
        ref: updated.ref,
        contactPhone: updated.contactPhone,
        contactEmail: updated.contactEmail,
        operatorName,
      };
    }

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

  // Issue 082: enqueue the customer match notification AFTER commit (sms + email),
  // best-effort — a NotificationLog failure must not roll back the ACCEPTED flip.
  // The Issue 058 dispatcher (NOTIFY_STUB-gated) delivers the queued rows.
  if (matchNotify) {
    const m: { ref: string; contactPhone: string; contactEmail: string; operatorName: string | null } =
      matchNotify;
    const payload = JSON.stringify({ ref: m.ref, operatorName: m.operatorName });
    await createNotificationLog({
      channel: 'sms',
      template: 'charterMatched',
      recipient: m.contactPhone,
      payload,
      status: 'pending',
    });
    await createNotificationLog({
      channel: 'email',
      template: 'charterMatched',
      recipient: m.contactEmail,
      payload,
      status: 'pending',
    });
  }

  return result;
}
