/**
 * getPayoutQueue — admin Finance tab payout-queue read (Issue 068).
 *
 * In-process Prisma read (NEVER self-fetch — AGENTS.md Issue 002/003). Returns a
 * cursor/seek-paginated page of Payout rows across ALL operators, optionally
 * filtered by status (requested | processing | paid | failed). The Finance tab
 * defaults to the actionable statuses (requested + failed) but this query takes a
 * single optional status so the caller controls the filter.
 *
 * Money fields (net) are plain Int columns on Payout (not BigInt), so they are
 * returned as numbers as-is.
 *
 * ── CURSOR (scheduledAt DESC, id DESC) ───────────────────────────────────────
 * Seek paginated on (scheduledAt DESC, id DESC) — scheduledAt primary, id as a
 * stable tiebreaker. Cursor is the opaque last-row id (mirrors listAllOperators).
 */

import type { PayoutStatus } from '@prisma/client';
import { prisma as defaultPrisma } from '@/lib/core/db/client';

export interface PayoutQueueRow {
  id: string;
  operatorId: string;
  net: number;
  status: PayoutStatus;
  scheduledAt: Date;
  settledAt: Date | null;
  failureReason: string | null;
}

export interface GetPayoutQueueParams {
  /** Optional single-status filter. Omit to list every status. */
  status?: PayoutStatus;
  /** Opaque seek cursor — the id of the last row on the previous page. */
  cursor?: string;
  limit?: number;
}

export interface GetPayoutQueueResult {
  items: PayoutQueueRow[];
  nextCursor: string | null;
}

/** Minimal prisma surface — lets unit tests inject a payout.findMany stub. */
type PrismaLike = Pick<typeof defaultPrisma, 'payout'>;

export async function getPayoutQueue(
  params: GetPayoutQueueParams,
  prisma: PrismaLike = defaultPrisma
): Promise<GetPayoutQueueResult> {
  const limit = Math.min(Math.max(params.limit ?? 20, 1), 100);
  const cursor = params.cursor;

  const rows = await prisma.payout.findMany({
    where: params.status ? { status: params.status } : {},
    select: {
      id: true,
      operatorId: true,
      net: true,
      status: true,
      scheduledAt: true,
      settledAt: true,
      failureReason: true,
    },
    orderBy: [{ scheduledAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  return {
    items: page.map((row) => ({
      id: row.id,
      operatorId: row.operatorId,
      net: row.net,
      status: row.status,
      scheduledAt: row.scheduledAt,
      settledAt: row.settledAt,
      failureReason: row.failureReason,
    })),
    nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
  };
}
