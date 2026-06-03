/**
 * getLedgerView — admin Finance tab ledger read for ONE operator (Issue 068).
 *
 * In-process Prisma read (NEVER self-fetch — AGENTS.md Issue 002/003). Returns a
 * cursor/seek-paginated page of that operator's immutable LedgerEntry rows
 * (newest first) plus the operator's derived balance summary (getOperatorBalance,
 * Issue 050).
 *
 * ── BIGINT → STRING (Issue 016 / JSON) ───────────────────────────────────────
 * LedgerEntry.amount is a BigInt (signed minor units). BigInt is NOT JSON-
 * serializable and must not round-trip through a JS number (float drift). So each
 * row's amountMinor is returned as a STRING; the page formats it for display and
 * any client island sends/receives it as a string.
 *
 * ── CURSOR (createdAt DESC, id DESC) ─────────────────────────────────────────
 * Seek paginated on (createdAt DESC, id DESC) — createdAt primary, id as a stable
 * tiebreaker so rows sharing a createdAt never duplicate/skip across pages
 * (mirrors listAllOperators, Issue 067). Cursor is the opaque last-row id.
 */

import type { LedgerEntryType } from '@prisma/client';
import { prisma as defaultPrisma } from '@/lib/core/db/client';
import { getOperatorBalance, type OperatorBalance } from '@/lib/ledger/balance';

export interface LedgerEntryRow {
  id: string;
  type: LedgerEntryType;
  /** Signed minor units (VND) as a STRING — BigInt is not JSON-serializable. */
  amountMinor: string;
  currency: string;
  bookingId: string | null;
  payoutId: string | null;
  sourceEventId: string;
  createdAt: Date;
}

export interface GetLedgerViewParams {
  operatorId: string;
  /** Opaque seek cursor — the id of the last row on the previous page. */
  cursor?: string;
  limit?: number;
}

export interface GetLedgerViewResult {
  items: LedgerEntryRow[];
  nextCursor: string | null;
  /** Derived operator balance summary (pending/available/paidOut as strings). */
  balance: { pending: string; available: string; paidOut: string };
}

/** Minimal prisma surface — lets unit tests inject a ledgerEntry.findMany stub. */
type PrismaLike = Pick<typeof defaultPrisma, 'ledgerEntry'>;

/**
 * `getOperatorBalance` is injectable for tests (it reaches the singleton via raw
 * SQL otherwise). Defaults to the real implementation.
 */
export async function getLedgerView(
  params: GetLedgerViewParams,
  prisma: PrismaLike = defaultPrisma,
  balanceFn: (operatorId: string) => Promise<OperatorBalance> = getOperatorBalance
): Promise<GetLedgerViewResult> {
  const limit = Math.min(Math.max(params.limit ?? 50, 1), 200);
  const cursor = params.cursor;
  const { operatorId } = params;

  const [rows, balance] = await Promise.all([
    prisma.ledgerEntry.findMany({
      where: { operatorId },
      select: {
        id: true,
        type: true,
        amount: true,
        currency: true,
        bookingId: true,
        payoutId: true,
        sourceEventId: true,
        createdAt: true,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    }),
    balanceFn(operatorId),
  ]);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  const items: LedgerEntryRow[] = page.map((row) => ({
    id: row.id,
    type: row.type,
    // BigInt → string (Issue 016): never coerce to a JS number.
    amountMinor: row.amount.toString(),
    currency: row.currency,
    bookingId: row.bookingId,
    payoutId: row.payoutId,
    sourceEventId: row.sourceEventId,
    createdAt: row.createdAt,
  }));

  return {
    items,
    nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
    balance: {
      pending: balance.pending.toString(),
      available: balance.available.toString(),
      paidOut: balance.paidOut.toString(),
    },
  };
}
