/**
 * getActionQueue — the three "needs-a-human" counts for the admin Overview
 * action queue (Issue 064).
 *
 * In-process Prisma counts (NEVER self-fetch — AGENTS.md Issue 002/003). Each
 * count links the Overview UI to the tab that resolves it:
 *   - pendingApprovals → Approvals tab (065): operators awaiting review.
 *   - pendingCharters  → Charter tab (085): charter leads awaiting dispatch.
 *   - openDisputes     → Finance tab (068): chargeback ledger entries.
 *   - failedPayouts    → Finance tab (068): payouts that failed to disburse.
 *
 * Issue 085: pendingCharters IS the admin "new charter request" surface (AC4).
 * There is no admin-notification recipient to push an email to, so the
 * dispatch-queue count on the Overview action queue is the notification surface —
 * a charter in ADMIN_REVIEW is a lead awaiting a routing decision. The dispatcher
 * checks the count + works the /admin/charter queue; no separate push channel.
 *
 * Enum sources (prisma/schema.prisma — NOT re-typed literals):
 *   - OperatorStatus.PENDING_REVIEW | UNDER_REVIEW  (UPPERCASE)
 *   - CharterStatus.ADMIN_REVIEW                     (UPPERCASE)
 *   - LedgerEntryType.chargeback                     (lowercase)
 *   - PayoutStatus.failed                            (lowercase)
 *
 * "Open disputes" is modelled as the count of chargeback ledger entries — the
 * dispute primitive in this slice (Issue 049 ledger). One chargeback row == one
 * dispute to triage; a richer dispute model (resolved/open lifecycle) lands later.
 */

import { prisma as defaultPrisma } from '@/lib/core/db/client';

/** Operator statuses that represent an approval still owed a decision. */
const PENDING_OPERATOR_STATUSES = ['PENDING_REVIEW', 'UNDER_REVIEW'] as const;

export interface ActionQueueCounts {
  pendingApprovals: number;
  pendingCharters: number;
  openDisputes: number;
  failedPayouts: number;
}

/** Minimal prisma surface — lets unit tests inject count stubs. */
type PrismaLike = Pick<
  typeof defaultPrisma,
  'operator' | 'charterRequest' | 'ledgerEntry' | 'payout'
>;

export async function getActionQueue(
  prisma: PrismaLike = defaultPrisma
): Promise<ActionQueueCounts> {
  const [pendingApprovals, pendingCharters, openDisputes, failedPayouts] = await Promise.all([
    prisma.operator.count({
      where: { status: { in: [...PENDING_OPERATOR_STATUSES] } },
    }),
    prisma.charterRequest.count({ where: { status: 'ADMIN_REVIEW' } }),
    prisma.ledgerEntry.count({ where: { type: 'chargeback' } }),
    prisma.payout.count({ where: { status: 'failed' } }),
  ]);

  return { pendingApprovals, pendingCharters, openDisputes, failedPayouts };
}
